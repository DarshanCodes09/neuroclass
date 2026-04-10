# NeuroClass — Supabase + LangChain + LangGraph (Google Colab Ready)
# ================================================================
# This script connects to your NeuroClass Supabase project,
# loads student queries and course files, builds a vector store,
# and runs a LangGraph agent that stores every Q&A back to Supabase.
#
# HOW TO USE IN GOOGLE COLAB:
#   1. Go to Colab → Secrets (key icon on left)
#   2. Add: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
#   3. Run cells top to bottom
# ================================================================

# ──────────────────────────────────────────────────────────────────
# CELL 1 — Install dependencies
# ──────────────────────────────────────────────────────────────────
# !pip install -q supabase langchain langchain-community langgraph \
#              langchain-openai openai pypdf faiss-cpu python-dotenv

# ──────────────────────────────────────────────────────────────────
# CELL 2 — Environment & Supabase connection
# ──────────────────────────────────────────────────────────────────
import os
import io
import uuid
from supabase import create_client, Client

# --- Load secrets (works in Colab with Secrets, or .env locally) ---
try:
    from google.colab import userdata
    SUPABASE_URL        = userdata.get('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = userdata.get('SUPABASE_SERVICE_KEY')
    OPENAI_API_KEY      = userdata.get('OPENAI_API_KEY')
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()
    SUPABASE_URL        = os.environ['SUPABASE_URL']
    SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    OPENAI_API_KEY      = os.environ['OPENAI_API_KEY']

# Service-role client — bypasses RLS, full read access for AI training
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
print('Connected to Supabase:', SUPABASE_URL)

# ──────────────────────────────────────────────────────────────────
# CELL 3 — Fetch student queries (uses the v_training_queries view)
# ──────────────────────────────────────────────────────────────────
def fetch_training_queries(limit: int = 5000) -> list[dict]:
    """Fetch all student queries from Supabase for AI training."""
    res = (
        supabase.table('v_training_queries')
        .select('id, query_text, ai_reply, response_text, query_type, context, session_id, course_title, student_name, created_at')
        .order('created_at', desc=False)
        .limit(limit)
        .execute()
    )
    return res.data

queries = fetch_training_queries()
print(f'Fetched {len(queries)} student queries for training')

# ──────────────────────────────────────────────────────────────────
# CELL 4 — Fetch file inventory (v_file_inventory view)
# ──────────────────────────────────────────────────────────────────
def fetch_file_inventory(course_id: str = None) -> list[dict]:
    """Get all uploaded files metadata."""
    q = (
        supabase.table('v_file_inventory')
        .select('id, file_name, file_type, category, storage_bucket, storage_path, course_title, is_public, created_at')
    )
    if course_id:
        q = q.eq('course_id', course_id)
    return q.execute().data

files = fetch_file_inventory()
print(f'Found {len(files)} files in the inventory')
for f in files[:10]:
    print(f'  [{f["file_type"]}] {f["file_name"]} — Course: {f["course_title"]}')

# ──────────────────────────────────────────────────────────────────
# CELL 5 — Download a file from Supabase Storage
# ──────────────────────────────────────────────────────────────────
def download_file_bytes(storage_bucket: str, storage_path: str) -> bytes:
    """Download raw bytes from Supabase Storage (service-role, bypasses RLS)."""
    return supabase.storage.from_(storage_bucket).download(storage_path)

# ──────────────────────────────────────────────────────────────────
# CELL 6 — Load PDFs as LangChain Documents
# ──────────────────────────────────────────────────────────────────
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pypdf import PdfReader

def load_pdf_document(file_record: dict) -> list[Document]:
    """Download a PDF from storage and return LangChain Documents."""
    try:
        raw   = download_file_bytes(file_record['storage_bucket'], file_record['storage_path'])
        reader = PdfReader(io.BytesIO(raw))
        text  = '\n'.join(page.extract_text() or '' for page in reader.pages)
        return [Document(
            page_content=text,
            metadata={
                'source':    file_record['file_name'],
                'course':    file_record.get('course_title', ''),
                'file_id':   file_record['id'],
                'file_type': file_record['file_type'],
            }
        )]
    except Exception as e:
        print(f'  Warning: Could not load {file_record["file_name"]}: {e}')
        return []

all_docs = []
pdf_files = [f for f in files if f['file_type'] in ('pdf', 'document')]
print(f'Loading {len(pdf_files)} PDF/document files...')
for f in pdf_files:
    all_docs.extend(load_pdf_document(f))
print(f'Loaded {len(all_docs)} LangChain documents')

# ──────────────────────────────────────────────────────────────────
# CELL 7 — Also load query history as documents (for fine-tuning context)
# ──────────────────────────────────────────────────────────────────
def queries_to_documents(queries: list[dict]) -> list[Document]:
    """Convert Q&A pairs into LangChain Documents for RAG context."""
    docs = []
    for q in queries:
        if not q.get('query_text'):
            continue
        answer = q.get('ai_reply') or q.get('response_text') or ''
        content = f"Q: {q['query_text']}\nA: {answer}" if answer else f"Q: {q['query_text']}"
        docs.append(Document(
            page_content=content,
            metadata={
                'source':     'student_query',
                'course':     q.get('course_title', ''),
                'query_type': q.get('query_type', 'general'),
                'created_at': str(q.get('created_at', '')),
            }
        ))
    return docs

qa_docs  = queries_to_documents(queries)
all_docs += qa_docs
print(f'Total documents for RAG: {len(all_docs)} ({len(qa_docs)} from query history)')

# ──────────────────────────────────────────────────────────────────
# CELL 8 — Build FAISS Vector Store
# ──────────────────────────────────────────────────────────────────
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
chunks   = splitter.split_documents(all_docs)

embeddings   = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vectorstore  = FAISS.from_documents(chunks, embeddings)
retriever    = vectorstore.as_retriever(search_type='mmr', search_kwargs={'k': 5, 'fetch_k': 20})
print(f'Vector store built — {len(chunks)} chunks indexed')

# Optional: save locally for reuse
vectorstore.save_local('neuroclass_faiss_index')
print('Vector store saved to neuroclass_faiss_index/')

# ──────────────────────────────────────────────────────────────────
# CELL 9 — LangGraph Agent (RAG + auto-save Q&A to Supabase)
# ──────────────────────────────────────────────────────────────────
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

llm      = ChatOpenAI(model='gpt-4o-mini', openai_api_key=OPENAI_API_KEY, temperature=0.2)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type='stuff',
    retriever=retriever,
    return_source_documents=True,
)

class AgentState(TypedDict):
    query:      str
    student_id: Optional[str]
    course_id:  Optional[str]
    session_id: str
    query_type: str
    db_id:      Optional[str]
    response:   Optional[str]
    sources:    Optional[list]

def node_save_query(state: AgentState) -> AgentState:
    """Save the incoming query to Supabase before answering."""
    res = supabase.table('student_queries').insert({
        'student_id': state.get('student_id'),
        'course_id':  state.get('course_id'),
        'query_text': state['query'],
        'session_id': state['session_id'],
        'query_type': state.get('query_type', 'rag'),
        'provider':   'langchain',
    }).execute()
    state['db_id'] = res.data[0]['id'] if res.data else None
    return state

def node_rag_answer(state: AgentState) -> AgentState:
    """Retrieve relevant context and generate an answer."""
    result = qa_chain.invoke({'query': state['query']})
    state['response'] = result['result']
    state['sources']  = [
        doc.metadata.get('source', 'unknown')
        for doc in result.get('source_documents', [])
    ]
    return state

def node_save_response(state: AgentState) -> AgentState:
    """Persist the AI response back to Supabase."""
    if state.get('db_id') and state.get('response'):
        supabase.table('student_queries').update({
            'ai_reply':      state['response'],
            'response_text': state['response'],
        }).eq('id', state['db_id']).execute()
    return state

# Build the graph
graph = StateGraph(AgentState)
graph.add_node('save_query',    node_save_query)
graph.add_node('rag_answer',    node_rag_answer)
graph.add_node('save_response', node_save_response)
graph.set_entry_point('save_query')
graph.add_edge('save_query',    'rag_answer')
graph.add_edge('rag_answer',    'save_response')
graph.add_edge('save_response', END)
agent = graph.compile()
print('LangGraph agent compiled and ready')

# ──────────────────────────────────────────────────────────────────
# CELL 10 — Run the agent
# ──────────────────────────────────────────────────────────────────
def ask(question: str, course_id: str = None, student_id: str = None) -> str:
    """Ask a question and get an answer grounded in course materials."""
    result = agent.invoke({
        'query':      question,
        'student_id': student_id,
        'course_id':  course_id,
        'session_id': str(uuid.uuid4()),
        'query_type': 'rag',
        'db_id':      None,
        'response':   None,
        'sources':    None,
    })
    print(f'Q: {question}')
    print(f'A: {result["response"]}')
    if result.get('sources'):
        print(f'Sources: {", ".join(set(result["sources"]))}')
    return result['response']

# Example usage:
# answer = ask('What topics are covered in this course?')
# answer = ask('Explain neural networks', course_id='your-course-uuid')

# ──────────────────────────────────────────────────────────────────
# CELL 11 — Export training data as CSV
# ──────────────────────────────────────────────────────────────────
import pandas as pd

df = pd.DataFrame(queries)
if not df.empty:
    df.to_csv('neuroclass_training_data.csv', index=False)
    print(f'Exported {len(df)} rows to neuroclass_training_data.csv')
    print(df[['query_text', 'ai_reply', 'course_title']].head(10))
else:
    print('No queries to export yet — start using the app!')
