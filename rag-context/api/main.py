from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from storage.chroma_store import search, upsert_chunks
from ingestion.loaders.code_loader import load_code_chunks
from ingestion.loaders.docs_loader import load_docs_chunks
from ingestion.loaders.issues_loader import load_issues_chunks

app = FastAPI(
    title="RAG Context API",
    description="Project context retrieval for AI agents",
    version="1.0.0",
)


# --- Models ---

class SearchRequest(BaseModel):
    query: str
    n_results: int = 8
    source_type: str | None = None
    max_distance: float = 0.5


class SearchResult(BaseModel):
    text: str
    source_type: str
    file_path: str
    repo: str
    last_updated: str
    distance: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]


class IngestRequest(BaseModel):
    sources: list[str] | None = None


# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse)
def search_context(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    raw = search(
        query=req.query,
        n_results=req.n_results,
        source_type=req.source_type,
        max_distance=req.max_distance, 
    )

    results = [
        SearchResult(
            text=r["text"],
            source_type=r["metadata"]["source_type"],
            file_path=r["metadata"]["file_path"],
            repo=r["metadata"]["repo"],
            last_updated=r["metadata"]["last_updated"],
            distance=r["distance"],
        )
        for r in raw
    ]

    return SearchResponse(query=req.query, results=results)


@app.post("/ingest")
def trigger_ingest(req: IngestRequest):
    sources = req.sources or ["code", "docs", "issues"]
    total = 0

    if "code" in sources:
        chunks = load_code_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    if "docs" in sources:
        chunks = load_docs_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    if "issues" in sources:
        chunks = load_issues_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    return {"status": "ok", "chunks_upserted": total, "sources": sources}