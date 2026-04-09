"""
NeuroClass — Supabase + LangChain + LangGraph AI Agent
Google Colab ready: set SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
                    in Colab Secrets (Tools → Secrets)
"""

# ── CELL 1: Install ───────────────────────────────────────────────────────────
# !pip install supabase langchain langchain-community langgraph openai pypdf faiss-cpu

# ── CELL 2: Connect to Supabase ───────────────────────────────────────────────
import os
from supabase import create_client, Client

try:
    from google.colab import userdata
    SUPABASE_URL     = userdata.get('SUPABASE_URL')
    SUPABASE_KEY     = userdata.get('SUPABASE_SERVICE_KEY')
    OPENAI_API_KEY   = userdata.get('OPENAI_API_KEY')
except Exception:
    SUPABASE_URL   = os.environ['SUPABASE_URL']
    SUPABASE_KEY   = os.environ['SUPABASE_SERVICE_KEY']
    OPENAI_API_KEY = os.environ['OPENAI_API_KEY']

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print('Connected to Supabase')

# ── CELL 3: Fetch student queries for training ────────────────────────────────
def fetch_queries(limit=5000, course_id=None):
    q = (supabase.table('student_queries')
         .select('id, query_text, response_text, context, course_id, created_at')
         .order('created_at', desc=False)
         .limit(limit))
    if course_id:
        q = q.eq('course_id', course_id)
    return q.execute().data

queries = fetch_queries()
print(f'Fetched {len(queries)} student queries')

# ── CELL 4: Fetch uploaded file metadata ─────────────────────────────────────
def fetch_files(course_id=None, role=None):
    q = (supabase.table('uploaded_files')
         .select('id, file_name, file_type, storage_bucket, storage_path, course_id, uploader_role, uploader_name, created_at'))
    if course_id:
        q = q.eq('course_id', course_id)
    if role:   # 'INSTRUCTOR' or 'STUDENT'
        q = q.eq('uploader_role', role)
    return q.execute().data

teacher_files  = fetch_files(role='INSTRUCTOR')
student_files  = fetch_files(role='STUDENT')
print(f'Teacher files: {len(teacher_files)} | Student submissions: {len(student_files)}')

# ── CELL 5: Download a file from Supabase Storage ────────────────────────────
def download_file(bucket: str, path: str) -> bytes:
    return supabase.storage.from_(bucket).download(path)

# ── CELL 6: Build LangChain Documents from teacher PDFs ──────────────────────
import io
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter

def load_pdf(file_record: dict) -> list:
    try:
        from pypdf import PdfReader
        raw    = download_file(file_record['storage_bucket'], file_record['storage_path'])
        reader = PdfReader(io.BytesIO(raw))
        text   = '\n'.join(p.extract_text() or '' for p in reader.pages)
        return [Document(
            page_content=text,
            metadata={
                'source':        file_record['file_name'],
                'course_id':     file_record['course_id'],
                'file_id':       file_record['id'],
                'uploader_role': file_record['uploader_role'],
            }
        )]
    except Exception as e:
        print(f'Could not load {file_record["file_name"]}: {e}')
        return []

pdf_files = [f for f in teacher_files if f['file_type'] in ('document', 'pdf')]
all_docs  = []
for f in pdf_files[:10]:          # increase limit as needed
    all_docs.extend(load_pdf(f))
print(f'Loaded {len(all_docs)} documents')

# ── CELL 7: Build Vector Store ────────────────────────────────────────────────
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings  import OpenAIEmbeddings

splitter   = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
chunks     = splitter.split_documents(all_docs)
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vectorstore = FAISS.from_documents(chunks, embeddings)
retriever   = vectorstore.as_retriever(search_kwargs={'k': 5})
print(f'Vector store: {len(chunks)} chunks')

# ── CELL 8: LangGraph Agent ───────────────────────────────────────────────────
from langgraph.graph import StateGraph, END
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from typing import TypedDict, Optional
import uuid

llm      = ChatOpenAI(model='gpt-4o-mini', openai_api_key=OPENAI_API_KEY)
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

class AgentState(TypedDict):
    query:      str
    student_id: Optional[str]
    course_id:  Optional[str]
    session_id: str
    response:   Optional[str]
    db_id:      Optional[str]

def save_query(state: AgentState) -> AgentState:
    """Save the incoming query to Supabase student_queries."""
    res = supabase.table('student_queries').insert({
        'student_id': state.get('student_id'),
        'course_id':  state.get('course_id'),
        'query_text': state['query'],
        'session_id': state['session_id'],
        'query_type': 'rag',
    }).execute()
    state['db_id'] = res.data[0]['id']
    return state

def answer(state: AgentState) -> AgentState:
    """RAG answer from Supabase-loaded documents."""
    state['response'] = qa_chain.invoke(state['query'])['result']
    return state

def save_response(state: AgentState) -> AgentState:
    """Persist AI response back to DB row."""
    if state.get('db_id'):
        supabase.table('student_queries') \
            .update({'response_text': state['response']}) \
            .eq('id', state['db_id']) \
            .execute()
    return state

graph = StateGraph(AgentState)
graph.add_node('save_query',    save_query)
graph.add_node('answer',        answer)
graph.add_node('save_response', save_response)
graph.set_entry_point('save_query')
graph.add_edge('save_query',    'answer')
graph.add_edge('answer',        'save_response')
graph.add_edge('save_response', END)
agent = graph.compile()
print('LangGraph agent ready!')

# ── CELL 9: Run the Agent ─────────────────────────────────────────────────────
result = agent.invoke({
    'query':      'What are the main topics covered in this course?',
    'student_id': None,               # replace with real UUID
    'course_id':  None,               # replace with real course UUID
    'session_id': str(uuid.uuid4()),
    'response':   None,
    'db_id':      None,
})
print('Answer:', result['response'])
