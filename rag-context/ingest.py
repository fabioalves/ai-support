import time
from ingestion.loaders.code_loader import load_code_chunks
from ingestion.loaders.docs_loader import load_docs_chunks
from ingestion.loaders.issues_loader import load_issues_chunks
from storage.chroma_store import upsert_chunks


def run_ingestion(sources: list[str] = None):
    """
    sources: list of source types to ingest.
             Defaults to all: ['code', 'docs', 'issues']
    """
    if sources is None:
        sources = ["code", "docs", "issues"]

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

    if "issues" in sources:
        print("\n[3/3] Loading GitHub issues...")
        chunks = load_issues_chunks()
        upsert_chunks(chunks)

    elapsed = time.time() - start
    print(f"\n=== Done in {elapsed:.1f}s ===\n")


if __name__ == "__main__":
    import sys

    # Optional: pass source types as args
    # e.g. python ingest.py code docs
    # Default: all sources
    args = [a for a in sys.argv[1:] if a in ("code", "docs", "issues")]
    run_ingestion(args if args else None)