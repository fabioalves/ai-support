import chromadb
from chromadb.config import Settings
from langchain_ollama import OllamaEmbeddings
from config import cfg
import os
import uuid

CHROMA_PATH = cfg.get("chroma.path", os.getenv("CHROMA_PATH", "./data/chroma"))
OLLAMA_BASE_URL = cfg.get("ollama.base_url", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
EMBEDDING_MODEL = cfg.get("ollama.embedding_model", os.getenv("EMBEDDING_MODEL", "nomic-embed-text"))
COLLECTION_NAME = cfg.get("chroma.collection_name", "project_context")


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
    """
    Each chunk must be a dict with:
      - text:         str
      - source_type:  code | spec | architecture | issue
      - file_path:    str (relative path or issue URL)
      - repo:         str
      - last_updated: str (ISO date)
      - chunk_id:     str (stable, deterministic ID)
    """
    if not chunks:
        return

    collection, embeddings = get_collection()

    texts = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = [
        {
            "source_type": c["source_type"],
            "file_path":   c["file_path"],
            "repo":        c["repo"],
            "last_updated": c["last_updated"],
        }
        for c in chunks
    ]

    vectors = embeddings.embed_documents(texts)

    collection.upsert(
        ids=ids,
        documents=texts,
        embeddings=vectors,
        metadatas=metadatas,
    )

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
        if distance <= max_distance:          # ← filter noise
            output.append({
                "text":     doc,
                "metadata": results["metadatas"][0][i],
                "distance": distance,
            })

    return output


def delete_by_source(file_path: str):
    """
    Removes all chunks from a given file path.
    Useful for re-indexing a single file.
    """
    collection, _ = get_collection()
    collection.delete(where={"file_path": file_path})