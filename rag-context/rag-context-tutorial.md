# RAG Context System — Step-by-Step Implementation Tutorial

A guide to building a local RAG (Retrieval-Augmented Generation) system that allows AI coding agents
(Claude Code, Gemini CLI, Devin, etc.) to query your project knowledge base before executing any task.

---

## Architecture Overview

```
Sources                 Ingestion              Storage       Serving
──────────────────────────────────────────────────────────────────
.cs / .vue files   ┐
.md docs           ├──  Python script  ──►  Chroma  ──►  FastAPI  ──►  MCP server
Confluence pages   ┘    (LangChain)          (local)
```

The pipeline has two flows:

- **Ingestion (offline):** Crawl source files and pages, chunk them, generate embeddings, store in vector DB.
- **Query (runtime):** Agent receives a task → queries vector DB for relevant context → uses context in execution.

---

## Prerequisites

- Python 3.12+
- Git
- Ollama installed and running ([https://ollama.com/download](https://ollama.com/download))
- A GitHub Personal Access Token (for issues loader, if used)
- A Confluence Personal Access Token (for Confluence loader, if used)

### Install Ollama embedding model

After installing Ollama, pull the embedding model:

```powershell
ollama pull nomic-embed-text
```

Verify Ollama is running (the installer starts it as a background service automatically on Windows).

---

## Step 1 — Define Your Chunking Strategy

Before writing code, decide how to break source material into chunks. Bad chunking produces noisy retrieval.

| Source | Strategy |
|---|---|
| C# backend | By method/property. Each method = one chunk. Store class name + namespace as metadata. |
| Vue frontend | By component. Split `<script>` and `<template>` for large files (>150 lines). |
| Markdown docs | By heading. Each heading + body = one chunk. Split long sections at paragraph boundaries. |
| Confluence pages | By heading, same as markdown. Prepend page title as `# heading`. |

### Required metadata per chunk

| Field | Description |
|---|---|
| `source_type` | `code`, `spec`, `architecture`, `issue` |
| `file_path` | Relative file path or page URL |
| `repo` | Which repo or space the chunk came from |
| `last_updated` | ISO date string |
| `chunk_id` | Deterministic MD5 hash for deduplication |

---

## Step 2 — Choose Your Tooling

| Layer | Tool | Reason |
|---|---|---|
| Ingestion | Python + LangChain | Ready-made loaders, splitters, Chroma integration |
| Embeddings | Ollama `nomic-embed-text` | Fully local, no API costs |
| Vector DB | Chroma (local persistent) | No server needed, pip install only |
| REST API | FastAPI | Async, auto OpenAPI docs |
| MCP server | `mcp` Python SDK | Native tool interface for AI agents |

---

## Step 3 — Project Structure and Environment Setup

### Folder structure

```
rag-context/
├── ingestion/
│   ├── __init__.py
│   ├── loaders/
│   │   ├── __init__.py
│   │   ├── code_loader.py
│   │   ├── docs_loader.py
│   │   └── confluence_loader.py
│   └── chunkers/
│       ├── __init__.py
│       ├── code_chunker.py
│       └── markdown_chunker.py
├── storage/
│   ├── __init__.py
│   └── chroma_store.py
├── api/
│   ├── __init__.py
│   └── main.py
├── mcp_server/
│   ├── __init__.py
│   └── server.py
├── data/
│   └── chroma/          ← Chroma writes here, git-ignored
├── .env
├── .gitignore
├── requirements.txt
└── ingest.py
```

### Create folders (PowerShell)

```powershell
mkdir rag-context; cd rag-context

mkdir ingestion\loaders, ingestion\chunkers, storage, api, mcp_server, data\chroma

New-Item ingestion\__init__.py,
         ingestion\loaders\__init__.py,
         ingestion\loaders\code_loader.py,
         ingestion\loaders\docs_loader.py,
         ingestion\loaders\confluence_loader.py,
         ingestion\chunkers\__init__.py,
         ingestion\chunkers\code_chunker.py,
         ingestion\chunkers\markdown_chunker.py,
         storage\__init__.py,
         storage\chroma_store.py,
         api\__init__.py,
         api\main.py,
         mcp_server\__init__.py,
         mcp_server\server.py,
         .env,
         .gitignore,
         ingest.py -ItemType File
```

### Virtual environment

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### `requirements.txt`

```txt
# Ingestion
langchain
langchain-community
langchain-text-splitters

# Embeddings (local via Ollama)
langchain-ollama

# Vector DB
chromadb

# Confluence
httpx

# REST API
fastapi
uvicorn

# MCP server
mcp

# Utilities
python-dotenv
```

Install:

```powershell
pip install -r requirements.txt
```

### `.gitignore`

```
.venv/
data/
.env
__pycache__/
*.pyc
```

### `.env`

```env
# GitHub (optional, only if using GitHub issues loader)
GITHUB_TOKEN=your_github_token_here
GITHUB_REPO=your-org/your-repo

# Confluence (optional, only if using Confluence loader)
CONFLUENCE_BASE_URL=https://your-domain.atlassian.net/wiki
CONFLUENCE_TOKEN=your_personal_access_token
CONFLUENCE_SPACE_KEYS=DEV,ARCH,PROJ

# Paths to your local repos (absolute paths)
BACKEND_PATH=C:/path/to/backend
FRONTEND_PATH=C:/path/to/frontend

# Chroma
CHROMA_PATH=./data/chroma

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text

# API
API_BASE_URL=http://localhost:8000
```

---

## Step 4 — Chroma Store Wrapper

**`storage/chroma_store.py`**

```python
import chromadb
from chromadb.config import Settings
from langchain_ollama import OllamaEmbeddings
from dotenv import load_dotenv
import os

load_dotenv()

CHROMA_PATH = os.getenv("CHROMA_PATH", "./data/chroma")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
COLLECTION_NAME = "project_context"


def get_embedding_function():
    return OllamaEmbeddings(
        model=EMBEDDING_MODEL,
        base_url=OLLAMA_BASE_URL,
    )


def get_collection():
    client = chromadb.PersistentClient(
        path=CHROMA_PATH,
        settings=Settings(anonymized_telemetry=False),
    )
    embeddings = get_embedding_function()
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )
    return collection, embeddings


def upsert_chunks(chunks: list[dict]):
    if not chunks:
        return

    collection, embeddings = get_collection()

    texts = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = [
        {
            "source_type":  c["source_type"],
            "file_path":    c["file_path"],
            "repo":         c["repo"],
            "last_updated": c["last_updated"],
        }
        for c in chunks
    ]

    vectors = embeddings.embed_documents(texts)
    collection.upsert(ids=ids, documents=texts, embeddings=vectors, metadatas=metadatas)
    print(f"  ✓ Upserted {len(chunks)} chunks")


def search(query: str, n_results: int = 8, source_type: str = None, max_distance: float = 0.5) -> list[dict]:
    collection, embeddings = get_collection()
    query_vector = embeddings.embed_query(query)
    where = {"source_type": source_type} if source_type else None

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=n_results,
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for i, doc in enumerate(results["documents"][0]):
        distance = results["distances"][0][i]
        if distance <= max_distance:
            output.append({
                "text":     doc,
                "metadata": results["metadatas"][0][i],
                "distance": distance,
            })

    return output


def delete_by_source(file_path: str):
    collection, _ = get_collection()
    collection.delete(where={"file_path": file_path})
```

---

## Step 5 — Loaders and Chunkers

### `ingestion/chunkers/markdown_chunker.py`

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

HEADERS_TO_SPLIT_ON = [
    ("#",   "h1"),
    ("##",  "h2"),
    ("###", "h3"),
]

def chunk_markdown(text: str, file_path: str) -> list[str]:
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=HEADERS_TO_SPLIT_ON,
        strip_headers=False,
    )
    header_chunks = header_splitter.split_text(text)

    char_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

    final_chunks = []
    for chunk in header_chunks:
        sub_chunks = char_splitter.split_text(chunk.page_content)
        for sub in sub_chunks:
            if sub.strip():
                final_chunks.append(sub.strip())

    return final_chunks
```

### `ingestion/chunkers/code_chunker.py`

```python
import re
from langchain_text_splitters import RecursiveCharacterTextSplitter

CSHARP_BOUNDARIES = re.compile(
    r'(?=\s*(?:public|private|protected|internal|static|async|override|virtual)'
    r'\s+[\w<>\[\]]+\s+\w+\s*[\(\{])',
    re.MULTILINE,
)

VUE_BOUNDARIES = re.compile(r'(?=<template|<script|<style)', re.MULTILINE)


def chunk_csharp(text: str) -> list[str]:
    return _filter_and_trim(CSHARP_BOUNDARIES.split(text))


def chunk_vue(text: str) -> list[str]:
    return _filter_and_trim(VUE_BOUNDARIES.split(text))


def chunk_generic(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    return [c.strip() for c in splitter.split_text(text) if c.strip()]


def _filter_and_trim(parts: list[str]) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
    result = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) > 500:
            result.extend(splitter.split_text(part))
        else:
            result.append(part)
    return result
```

### `ingestion/loaders/code_loader.py`

```python
import os
import hashlib
from datetime import datetime
from ingestion.chunkers.code_chunker import chunk_csharp, chunk_vue, chunk_generic
from dotenv import load_dotenv

load_dotenv()

BACKEND_PATH  = os.getenv("BACKEND_PATH")
FRONTEND_PATH = os.getenv("FRONTEND_PATH")

EXTENSIONS = {
    ".cs":  "csharp",
    ".vue": "vue",
    ".ts":  "typescript",
    ".js":  "javascript",
}

IGNORE_DIRS = {"node_modules", "dist", "bin", "obj", ".git", ".venv", "migrations"}


def load_code_chunks() -> list[dict]:
    chunks = []
    for repo_name, base_path in [("backend", BACKEND_PATH), ("frontend", FRONTEND_PATH)]:
        if not base_path or not os.path.exists(base_path):
            print(f"  ⚠ Skipping {repo_name}: path not set or does not exist")
            continue
        print(f"  → Scanning {repo_name} at {base_path}")
        for root, dirs, files in os.walk(base_path):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in EXTENSIONS:
                    continue
                full_path = os.path.join(root, file)
                rel_path  = os.path.relpath(full_path, base_path)
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                    if not text.strip():
                        continue
                    lang = EXTENSIONS[ext]
                    if lang == "csharp":
                        raw_chunks = chunk_csharp(text)
                    elif lang == "vue":
                        raw_chunks = chunk_vue(text)
                    else:
                        raw_chunks = chunk_generic(text)

                    mtime = datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()

                    for i, chunk_text in enumerate(raw_chunks):
                        chunk_id = _make_id(repo_name, rel_path, i, chunk_text)
                        chunks.append({
                            "text":         chunk_text,
                            "source_type":  "code",
                            "file_path":    rel_path.replace("\\", "/"),
                            "repo":         repo_name,
                            "last_updated": mtime,
                            "chunk_id":     chunk_id,
                        })
                except Exception as e:
                    print(f"  ⚠ Could not read {rel_path}: {e}")

    print(f"  ✓ Code chunks collected: {len(chunks)}")
    return chunks


def _make_id(repo: str, path: str, index: int, text: str) -> str:
    raw = f"{repo}::{path}::{index}::{text[:64]}"
    return hashlib.md5(raw.encode()).hexdigest()
```

### `ingestion/loaders/docs_loader.py`

```python
import os
import hashlib
from datetime import datetime
from ingestion.chunkers.markdown_chunker import chunk_markdown
from dotenv import load_dotenv

load_dotenv()

BACKEND_PATH  = os.getenv("BACKEND_PATH")
FRONTEND_PATH = os.getenv("FRONTEND_PATH")

IGNORE_DIRS = {".git", ".venv", "node_modules"}


def load_docs_chunks() -> list[dict]:
    chunks = []
    for repo_name, base_path in [("backend", BACKEND_PATH), ("frontend", FRONTEND_PATH)]:
        if not base_path or not os.path.exists(base_path):
            continue
        print(f"  → Scanning docs in {repo_name}")
        for root, dirs, files in os.walk(base_path):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            for file in files:
                if not file.endswith(".md"):
                    continue
                full_path = os.path.join(root, file)
                rel_path  = os.path.relpath(full_path, base_path)
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                    if not text.strip():
                        continue

                    raw_chunks = chunk_markdown(text, rel_path)
                    mtime = datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()

                    for i, chunk_text in enumerate(raw_chunks):
                        chunk_id = _make_id(repo_name, rel_path, i, chunk_text)
                        chunks.append({
                            "text":         chunk_text,
                            "source_type":  "architecture",
                            "file_path":    rel_path.replace("\\", "/"),
                            "repo":         repo_name,
                            "last_updated": mtime,
                            "chunk_id":     chunk_id,
                        })
                except Exception as e:
                    print(f"  ⚠ Could not read {rel_path}: {e}")

    print(f"  ✓ Docs chunks collected: {len(chunks)}")
    return chunks


def _make_id(repo: str, path: str, index: int, text: str) -> str:
    raw = f"{repo}::{path}::{index}::{text[:64]}"
    return hashlib.md5(raw.encode()).hexdigest()
```

### `ingestion/loaders/confluence_loader.py`

```python
import hashlib
import httpx
import os
import re
from ingestion.chunkers.markdown_chunker import chunk_markdown
from dotenv import load_dotenv

load_dotenv()

BASE_URL   = os.getenv("CONFLUENCE_BASE_URL")
TOKEN      = os.getenv("CONFLUENCE_TOKEN")
SPACE_KEYS = [s.strip() for s in os.getenv("CONFLUENCE_SPACE_KEYS", "").split(",") if s.strip()]


def _headers():
    return {"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"}


def _html_to_text(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()


def _get_pages_in_space(space_key: str) -> list[dict]:
    pages = []
    start = 0
    limit = 50
    with httpx.Client(headers=_headers(), timeout=30) as client:
        while True:
            response = client.get(
                f"{BASE_URL}/rest/api/content",
                params={
                    "spaceKey": space_key, "type": "page", "status": "current",
                    "start": start, "limit": limit, "expand": "version,ancestors",
                },
            )
            response.raise_for_status()
            data = response.json()
            pages.extend(data.get("results", []))
            if data["_links"].get("next"):
                start += limit
            else:
                break
    return pages


def _get_page_body(page_id: str) -> str:
    with httpx.Client(headers=_headers(), timeout=30) as client:
        response = client.get(
            f"{BASE_URL}/rest/api/content/{page_id}",
            params={"expand": "body.storage"},
        )
        response.raise_for_status()
        data = response.json()
        return _html_to_text(data["body"]["storage"]["value"])


def _get_child_pages(page_id: str) -> list[dict]:
    children = []
    with httpx.Client(headers=_headers(), timeout=30) as client:
        response = client.get(
            f"{BASE_URL}/rest/api/content/{page_id}/child/page",
            params={"limit": 50, "expand": "version"},
        )
        response.raise_for_status()
        results = response.json().get("results", [])
    for child in results:
        children.append(child)
        children.extend(_get_child_pages(child["id"]))
    return children


def load_confluence_chunks() -> list[dict]:
    if not BASE_URL or not TOKEN:
        print("  ⚠ Skipping Confluence: CONFLUENCE_BASE_URL or CONFLUENCE_TOKEN not set")
        return []
    if not SPACE_KEYS:
        print("  ⚠ Skipping Confluence: CONFLUENCE_SPACE_KEYS not set")
        return []

    all_chunks = []
    for space_key in SPACE_KEYS:
        print(f"  → Fetching Confluence space: {space_key}")
        try:
            pages = _get_pages_in_space(space_key)
            all_pages = {p["id"]: p for p in pages}
            for page in pages:
                for child in _get_child_pages(page["id"]):
                    all_pages[child["id"]] = child

            for page in all_pages.values():
                try:
                    body = _get_page_body(page["id"])
                    if not body.strip():
                        continue
                    full_text  = f"# {page['title']}\n\n{body}"
                    page_url   = f"{BASE_URL}/pages/{page['id']}"
                    raw_chunks = chunk_markdown(full_text, page_url)
                    for i, chunk_text in enumerate(raw_chunks):
                        all_chunks.append({
                            "text":         chunk_text,
                            "source_type":  "spec",
                            "file_path":    page_url,
                            "repo":         f"confluence:{space_key}",
                            "last_updated": page["version"]["when"],
                            "chunk_id":     _make_id(page["id"], i, chunk_text),
                        })
                except Exception as e:
                    print(f"    ⚠ Could not process page {page.get('title', page['id'])}: {e}")
        except Exception as e:
            print(f"  ⚠ Could not fetch space {space_key}: {e}")

    print(f"  ✓ Confluence chunks collected: {len(all_chunks)}")
    return all_chunks


def _make_id(page_id: str, index: int, text: str) -> str:
    raw = f"confluence::{page_id}::{index}::{text[:64]}"
    return hashlib.md5(raw.encode()).hexdigest()
```

---

## Step 6 — Ingestion Entry Point

**`ingest.py`**

```python
import time
from ingestion.loaders.code_loader import load_code_chunks
from ingestion.loaders.docs_loader import load_docs_chunks
from ingestion.loaders.confluence_loader import load_confluence_chunks
from storage.chroma_store import upsert_chunks


def run_ingestion(sources: list[str] = None):
    if sources is None:
        sources = ["code", "docs", "confluence"]

    start = time.time()
    print("\n=== RAG Ingestion Pipeline ===\n")

    if "code" in sources:
        print("[1/3] Loading code...")
        chunks = load_code_chunks()
        upsert_chunks(chunks)

    if "docs" in sources:
        print("\n[2/3] Loading docs...")
        chunks = load_docs_chunks()
        upsert_chunks(chunks)

    if "confluence" in sources:
        print("\n[3/3] Loading Confluence pages...")
        chunks = load_confluence_chunks()
        upsert_chunks(chunks)

    elapsed = time.time() - start
    print(f"\n=== Done in {elapsed:.1f}s ===\n")


if __name__ == "__main__":
    import sys
    args = [a for a in sys.argv[1:] if a in ("code", "docs", "confluence")]
    run_ingestion(args if args else None)
```

### Run ingestion

Test with a single source first:

```powershell
python ingest.py docs
```

Then run full ingestion:

```powershell
python ingest.py
```

### Verify data with a quick search test

Create `test_search.py`:

```python
from storage.chroma_store import search

results = search("authentication", n_results=3)
for r in results:
    print(f"--- [{r['metadata']['source_type']}] {r['metadata']['file_path']}")
    print(f"    distance: {r['distance']:.4f}")
    print(f"    {r['text'][:200]}")
    print()
```

Run it:

```powershell
python test_search.py
```

Delete it when done:

```powershell
Remove-Item test_search.py
```

---

## Step 7 — FastAPI REST API

**`api/main.py`**

```python
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from storage.chroma_store import search, upsert_chunks
from ingestion.loaders.code_loader import load_code_chunks
from ingestion.loaders.docs_loader import load_docs_chunks
from ingestion.loaders.confluence_loader import load_confluence_chunks
import os

app = FastAPI(
    title="RAG Context API",
    description="Project context retrieval for AI agents",
    version="1.0.0",
)

API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(key: str = Security(api_key_header)):
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/search", response_model=SearchResponse, dependencies=[Depends(verify_api_key)])
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


@app.post("/ingest", dependencies=[Depends(verify_api_key)])
def trigger_ingest(req: IngestRequest):
    sources = req.sources or ["code", "docs", "confluence"]
    total = 0

    if "code" in sources:
        chunks = load_code_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    if "docs" in sources:
        chunks = load_docs_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    if "confluence" in sources:
        chunks = load_confluence_chunks()
        upsert_chunks(chunks)
        total += len(chunks)

    return {"status": "ok", "chunks_upserted": total, "sources": sources}
```

### Start the API

```powershell
python -m uvicorn api.main:app --reload --port 8000
```

### Test

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:8000/health"

# Search
$body = '{"query": "authentication", "n_results": 3}'
Invoke-RestMethod -Uri "http://localhost:8000/search" -Method Post -Body $body -ContentType "application/json"
```

Swagger UI available at: `http://localhost:8000/docs`

---

## Step 8 — MCP Server

**`mcp_server/server.py`**

```python
import httpx
from mcp.server.fastmcp import FastMCP
from dotenv import load_dotenv
import os

load_dotenv()

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

mcp = FastMCP("rag-context")


@mcp.tool()
def search_project_context(query: str, source_type: str = None, n_results: int = 8) -> str:
    """
    Search the project knowledge base for relevant context before implementing
    any feature, fixing any bug, or making any architectural decision.

    Use this tool to find:
    - Existing patterns and conventions in the codebase
    - Architecture decisions and documentation
    - Confluence specs, plans, and team decisions
    - Similar code in the backend (C#) or frontend (Vue)

    Args:
        query:       Natural language description of what you are looking for
        source_type: Optional filter - one of: code, architecture, spec
        n_results:   Number of results to return (default 8)
    """
    payload = {"query": query, "n_results": n_results}
    if source_type:
        payload["source_type"] = source_type

    with httpx.Client() as client:
        response = client.post(f"{API_BASE_URL}/search", json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()

    if not data["results"]:
        return "No relevant context found for this query."

    lines = [f"## Project context for: '{query}'\n"]
    for i, r in enumerate(data["results"], 1):
        lines.append(f"### [{i}] {r['source_type'].upper()} — {r['file_path']}")
        lines.append(f"Repo: {r['repo']} | Last updated: {r['last_updated'][:10]} | Distance: {r['distance']:.4f}")
        lines.append(f"\n{r['text']}\n")

    return "\n".join(lines)


@mcp.tool()
def trigger_reindex(sources: list[str] = None) -> str:
    """
    Re-index the project knowledge base. Call after significant code changes.

    Args:
        sources: List of sources to reindex: code, docs, confluence. Defaults to all.
    """
    payload = {"sources": sources or ["code", "docs", "confluence"]}
    with httpx.Client(timeout=300) as client:
        response = client.post(f"{API_BASE_URL}/ingest", json=payload)
        response.raise_for_status()
        data = response.json()
    return f"Reindex complete. Upserted {data['chunks_upserted']} chunks from {data['sources']}."


if __name__ == "__main__":
    mcp.run()
```

### Run the MCP server

In a separate PowerShell window (keep FastAPI running):

```powershell
python -m mcp_server.server
```

The server runs silently over stdio — this is normal. It only produces output when a tool is called.

### Wire to Gemini CLI / Antigravity CLI

Open or create `%USERPROFILE%\.gemini\settings.json`:

```json
{
  "systemPrompt": "You have access to a tool called search_project_context. Before implementing any feature, fixing any bug, or making any architectural decision, always call this tool with the key concepts from the task to retrieve relevant patterns, conventions, and prior decisions from the codebase.",
  "mcpServers": {
    "rag-context": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "C:\\projects\\rag-context",
      "env": {
        "PYTHONPATH": "C:\\projects\\rag-context"
      }
    }
  }
}
```

### Wire to Claude Code

Open or create `%USERPROFILE%\.claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rag-context": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "C:\\projects\\rag-context"
    }
  }
}
```

---

## Step 9 — Hardening and Next Steps

### Keep the index fresh with a git hook

In each repo (backend / frontend), create `.git/hooks/post-commit`:

```bash
#!/bin/sh
echo "→ Re-indexing RAG context..."
cd C:/projects/rag-context && .venv/Scripts/python ingest.py code docs
```

### Tuning chunk size

| Symptom | Fix |
|---|---|
| Chunks cut mid-method | Increase `chunk_size` to `800` |
| Chunks too broad | Decrease `chunk_size` to `300` |
| Too much overlap between results | Decrease `chunk_overlap` to `20` |

Edit values in `code_chunker.py` and `markdown_chunker.py`, then re-run `python ingest.py`.

### Relevance threshold

The `max_distance` parameter (default `0.5`) filters out low-relevance results. For `nomic-embed-text` with cosine similarity:

- `0.5` — balanced, good starting point
- `0.35` — high confidence matches only
- `0.6` — more permissive, more noise

### What to add next

**Short term**
- Re-index only changed files using `git diff --name-only` in the hook
- Add a `/stats` endpoint showing chunk counts per `source_type`

**Medium term**
- Store AI-generated one-line summaries alongside raw chunks for better retrieval
- Add GitHub issues back as an additional source type alongside Confluence

**Longer term**
- Graduate from local Chroma to Qdrant for team-shared access
- Add a re-ranking step (retrieve top-20, re-rank to top-5 with a cross-encoder)

---

## Team Sharing — Architecture Overview

When ready to share the RAG DB across a team, the architecture evolves to:

```
GitHub (push)
     ↓
GitHub Actions (calls /ingest endpoint)
     ↓
Qdrant server (shared, Docker/Kubernetes)
     ↓
FastAPI (shared, hosted, protected by API key)
     ↓
MCP server (local on each developer's machine)
     ↓
Agent CLI (Gemini, Claude Code, Devin...)
```

### Key changes for team setup

| Layer | Local | Team |
|---|---|---|
| Vector DB | Chroma (file) | Qdrant (server, StatefulSet) |
| Ingestion trigger | Git hook | GitHub Actions on push to main |
| FastAPI | localhost:8000 | Hosted behind nginx ingress |
| Auth | None | API key via `X-API-Key` header |
| MCP server | Points to localhost | Points to shared API URL |

### Kubernetes deployment order

```powershell
kubectl apply -f namespace.yaml
kubectl apply -f qdrant.yaml
kubectl apply -f secrets.yaml
kubectl apply -f rag-api.yaml
kubectl apply -f ingress.yaml
```

Each developer updates their local `.env`:

```env
API_BASE_URL=https://rag.yourdomain.internal
API_KEY=your_team_api_key
```

---

*End of tutorial*
