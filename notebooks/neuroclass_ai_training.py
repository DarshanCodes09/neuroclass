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
    """
    q = (
        supabase.table("student_queries")
        .select("id, student_id, course_id, query_text, ai_reply, thread_id, provider, created_at")
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
    """
    q = (
        supabase.table("uploaded_files")
        .select("id, file_name, file_type, storage_bucket, storage_path, course_id, is_public, created_at")
        .order("created_at", desc=False)
    )
    if course_id:
        q = q.eq("course_id", course_id)
    if file_type:
        q = q.eq("file_type", file_type)
    return q.execute().data

files = fetch_files_metadata()
print(f"📁 Fetched {len(files)} file records")
for f in files[:5]:
    print(f"  [{f['file_type']}] {f['file_name']} — {f['storage_path']}")

# ── CELL 5: Download file from Supabase Storage ─────────────
def download_file(storage_bucket: str, storage_path: str) -> bytes:
    """Download raw bytes of a file from Supabase Storage."""
    return supabase.storage.from_(storage_bucket).download(storage_path)

# ── CELL 6: LangChain PDF Loader from Supabase ──────────────
from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
import io

def load_pdf_from_supabase(file_record: dict) -> list:
    """Download a PDF from Supabase Storage and return LangChain Documents."""
    try:
        from pypdf import PdfReader
        raw = download_file(file_record["storage_bucket"], file_record["storage_path"])
        reader = PdfReader(io.BytesIO(raw))
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return [Document(
            page_content=full_text,
            metadata={
                "source":    file_record["file_name"],
                "course_id": file_record["course_id"],
                "file_id":   file_record["id"],
                "file_type": file_record["file_type"],
            }
        )]
    except Exception as e:
        print(f"  ⚠️  Could not load {file_record['file_name']}: {e}")
        return []

# Load all PDFs (limit for demo — remove limit for full training)
pdf_files = [f for f in files if f.get("file_type") == "pdf"]
all_docs = []
for f in pdf_files:
    docs = load_pdf_from_supabase(f)
    all_docs.extend(docs)
    print(f"  ✅ Loaded: {f['file_name']} ({len(docs)} doc)")

print(f"\n📄 Total documents loaded: {len(all_docs)}")

# ── CELL 7: Build FAISS Vector Store ────────────────────────
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import OpenAIEmbeddings

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
chunks = splitter.split_documents(all_docs)
print(f"🔪 Split into {len(chunks)} chunks")

embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
vectorstore = FAISS.from_documents(chunks, embeddings)
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
print("🔍 FAISS vector store built!")

# Optional: Save vectorstore to disk
# vectorstore.save_local("/content/neuroclass_vectorstore")

# ── CELL 8: LangGraph Agent — RAG + Auto Query Logging ──────
from langgraph.graph import StateGraph, END
from langchain_community.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from typing import TypedDict, Optional
import uuid

llm = ChatOpenAI(model="gpt-4o-mini", openai_api_key=OPENAI_API_KEY, temperature=0)
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True,
)

class AgentState(TypedDict):
    query:      str
    student_id: Optional[str]
    course_id:  Optional[str]
    thread_id:  str
    response:   Optional[str]
    sources:    Optional[list]
    db_id:      Optional[str]

def save_query_node(state: AgentState) -> AgentState:
    """Node 1 — Save incoming query to Supabase before answering."""
    result = supabase.table("student_queries").insert({
        "student_id": state.get("student_id"),
        "course_id":  state.get("course_id"),
        "query_text": state["query"],
        "thread_id":  state["thread_id"],
        "provider":   "langchain-rag",
    }).execute()
    state["db_id"] = result.data[0]["id"] if result.data else None
    print(f"  💾 Query saved to DB (id={state['db_id']})")
    return state

def retrieve_and_answer_node(state: AgentState) -> AgentState:
    """Node 2 — Run RAG over Supabase-loaded course documents."""
    result = qa_chain.invoke({"query": state["query"]})
    state["response"] = result["result"]
    state["sources"]   = [
        d.metadata.get("source", "unknown")
        for d in result.get("source_documents", [])
    ]
    print(f"  🤖 Answer generated ({len(state['sources'])} sources)")
    return state

def save_response_node(state: AgentState) -> AgentState:
    """Node 3 — Write AI reply back to the same DB row."""
    if state.get("db_id"):
        supabase.table("student_queries") \
            .update({"ai_reply": state["response"]}) \
            .eq("id", state["db_id"]) \
            .execute()
        print(f"  ✅ AI reply saved to DB")
    return state

# Build the graph
graph = StateGraph(AgentState)
graph.add_node("save_query",    save_query_node)
graph.add_node("answer",        retrieve_and_answer_node)
graph.add_node("save_response", save_response_node)

graph.set_entry_point("save_query")
graph.add_edge("save_query",    "answer")
graph.add_edge("answer",        "save_response")
graph.add_edge("save_response", END)

agent = graph.compile()
print("\n🤖 LangGraph RAG agent compiled and ready!")

# ── CELL 9: Run the agent ────────────────────────────────────
result = agent.invoke({
    "query":      "Summarise the main topics covered in the uploaded course materials.",
    "student_id": None,           # replace with real student UUID if needed
    "course_id":  None,           # replace with real course UUID if needed
    "thread_id":  str(uuid.uuid4()),
    "response":   None,
    "sources":    None,
    "db_id":      None,
})

print("\n🎯 Final Answer:")
print(result["response"])
print("\n📎 Sources used:", result["sources"])

# ── CELL 10: Export queries to CSV for offline analysis ─────
import pandas as pd

df_queries = pd.DataFrame(queries)
df_queries.to_csv("/content/neuroclass_student_queries.csv", index=False)
print(f"\n📊 Exported {len(df_queries)} queries to /content/neuroclass_student_queries.csv")
print(df_queries[["query_text", "ai_reply", "created_at"]].head(10))
