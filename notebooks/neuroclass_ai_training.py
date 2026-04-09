# =============================================================
# NeuroClass — Supabase + LangChain + LangGraph AI Training
# Google Colab Ready
# =============================================================
# SETUP: In Colab, go to Secrets (key icon) and add:
#   SUPABASE_URL          = https://tvizwaysproajwebglwv.supabase.co
#   SUPABASE_SERVICE_KEY  = <your service role key from Supabase dashboard>
#   OPENAI_API_KEY        = <your OpenAI key>  (or use Gemini — see below)
# =============================================================

# ── CELL 1: Install dependencies ────────────────────────────
# !pip install -q supabase langchain langchain-community langgraph openai pypdf faiss-cpu python-dotenv

# ── CELL 2: Connect to Supabase ─────────────────────────────
import os
from supabase import create_client, Client

# Load from Colab Secrets
try:
    from google.colab import userdata
    os.environ["SUPABASE_URL"]         = userdata.get("SUPABASE_URL")
    os.environ["SUPABASE_SERVICE_KEY"] = userdata.get("SUPABASE_SERVICE_KEY")
    os.environ["OPENAI_API_KEY"]       = userdata.get("OPENAI_API_KEY")
except Exception:
    pass  # running locally — set env vars manually

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
print("✅ Connected to Supabase:", SUPABASE_URL)

# ── CELL 3: Fetch student queries ───────────────────────────
def fetch_all_queries(course_id: str = None, limit: int = 2000):
    """
    Fetch student queries from Supabase for AI training.
    Uses service role key — bypasses RLS to get ALL queries.
    Columns: id, student_id, course_id, query_text, ai_reply,
             context, thread_id, provider, query_type, created_at
    """
    q = (
        supabase.table("student_queries")
        .select("id, student_id, course_id, query_text, ai_reply, context, thread_id, provider, query_type, created_at")
        .order("created_at", desc=False)
        .limit(limit)
    )
    if course_id:
        q = q.eq("course_id", course_id)
    return q.execute().data

queries = fetch_all_queries()
print(f"📚 Fetched {len(queries)} student queries")

# ── CELL 4: Fetch uploaded file metadata ────────────────────
def fetch_files_metadata(course_id: str = None, file_type: str = None):
    """
    Fetch metadata for all uploaded files.
    Use storage_bucket + storage_path to download actual files.
    Columns: id, file_name, file_type, storage_bucket, storage_path,
             course_id, is_public, metadata, created_at
    """
    q = (
        supabase.table("uploaded_files")
        .select("id, file_name, file_type, storage_bucket, storage_path, course_id, is_public, metadata, created_at")
        .order("created_at", desc=False)
    )
    if course_id:
        q = q.eq("course_id", course_id)
    if file_type:
        q = q.eq("file_type", file_type)
    return q.execute().data

files = fetch_files_metadata()
print(f"📁 Fetched {len(files)} file records")

# ── CELL 5: Download a file from Supabase Storage ───────────
def download_file(storage_bucket: str, storage_path: str) -> bytes:
    """Download raw bytes of any file from Supabase Storage."""
    return supabase.storage.from_(storage_bucket).download(storage_path)

# ── CELL 6: LangChain Document Loader from Supabase Storage ─
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import io

def load_pdf_from_supabase(file_record: dict) -> list:
    """Download a PDF from Supabase Storage and return LangChain Documents."""
    try:
        from pypdf import PdfReader
        raw    = download_file(file_record["storage_bucket"], file_record["storage_path"])
        reader = PdfReader(io.BytesIO(raw))
        text   = "\n".join(p.extract_text() or "" for p in reader.pages)
        return [Document(
            page_content=text,
            metadata={
                "source":    file_record["file_name"],
                "course_id": file_record["course_id"],
                "file_id":   file_record["id"],
            }
        )]
    except Exception as e:
        print(f"⚠️  Could not load {file_record['file_name']}: {e}")
        return []

# Load all PDFs as LangChain documents (limit to 5 for demo)
pdf_files = [f for f in files if f["file_type"] in ("pdf", "document")]
all_docs  = []
for f in pdf_files[:5]:
    all_docs.extend(load_pdf_from_supabase(f))
print(f"📄 Loaded {len(all_docs)} document pages")

# ── CELL 7: Build FAISS Vector Store ────────────────────────
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OpenAIEmbeddings

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

splitter    = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
chunks      = splitter.split_documents(all_docs)
embeddings  = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vectorstore = FAISS.from_documents(chunks, embeddings)
retriever   = vectorstore.as_retriever(search_kwargs={"k": 5})
print(f"🔍 Vector store built with {len(chunks)} chunks")

# ── CELL 8: LangGraph Agent (RAG + auto query logging) ──────
from langgraph.graph import StateGraph, END
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from typing import TypedDict, Optional
import uuid

llm      = ChatOpenAI(model="gpt-4o-mini", openai_api_key=OPENAI_API_KEY)
qa_chain = RetrievalQA.from_chain_type(llm=llm, retriever=retriever)

class AgentState(TypedDict):
    query:      str
    student_id: Optional[str]
    course_id:  Optional[str]
    session_id: str
    response:   Optional[str]
    db_id:      Optional[str]

def save_query_node(state: AgentState) -> AgentState:
    """Node 1: Save incoming query to student_queries table."""
    result = supabase.table("student_queries").insert({
        "student_id": state.get("student_id"),
        "course_id":  state.get("course_id"),
        "query_text": state["query"],
        "thread_id":  state["session_id"],
        "provider":   "openai",
        "query_type": "rag",
    }).execute()
    state["db_id"] = result.data[0]["id"]
    return state

def retrieve_and_answer_node(state: AgentState) -> AgentState:
    """Node 2: RAG — retrieve from vector store and generate answer."""
    response       = qa_chain.invoke(state["query"])
    state["response"] = response["result"]
    return state

def save_response_node(state: AgentState) -> AgentState:
    """Node 3: Write AI reply back to the same DB row."""
    if state.get("db_id"):
        supabase.table("student_queries") \
            .update({"ai_reply": state["response"]}) \
            .eq("id", state["db_id"]) \
            .execute()
    return state

# Build the LangGraph pipeline
graph = StateGraph(AgentState)
graph.add_node("save_query",   save_query_node)
graph.add_node("answer",       retrieve_and_answer_node)
graph.add_node("save_response", save_response_node)

graph.set_entry_point("save_query")
graph.add_edge("save_query",   "answer")
graph.add_edge("answer",        "save_response")
graph.add_edge("save_response", END)

agent = graph.compile()
print("🤖 LangGraph agent compiled!")

# ── CELL 9: Run the Agent ────────────────────────────────────
result = agent.invoke({
    "query":      "What is the main topic covered in the uploaded course material?",
    "student_id": None,   # replace with real auth.users UUID
    "course_id":  None,   # replace with real courses UUID
    "session_id": str(uuid.uuid4()),
    "response":   None,
    "db_id":      None,
})
print("🎯 Answer:", result["response"])

# ── CELL 10: Export queries as CSV for offline training ──────
import pandas as pd

df = pd.DataFrame(fetch_all_queries())
df.to_csv("neuroclass_queries_export.csv", index=False)
print(f"💾 Exported {len(df)} rows to neuroclass_queries_export.csv")
print(df[["query_text", "ai_reply", "provider", "created_at"]].head(10))
