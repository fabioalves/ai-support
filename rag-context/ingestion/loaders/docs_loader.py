import os
import hashlib
from datetime import datetime
from ingestion.chunkers.markdown_chunker import chunk_markdown
from config import cfg


def load_docs_chunks() -> list[dict]:
    chunks = []
    
    projects = cfg.get("sources.docs.projects", [])
    if not projects:
        # Fallback to env variables if not defined in config
        backend = os.getenv("BACKEND_PATH")
        if backend:
            projects.append({"name": "backend", "path": backend})
        frontend = os.getenv("FRONTEND_PATH")
        if frontend:
            projects.append({"name": "frontend", "path": frontend})

    extensions = cfg.get("sources.docs.extensions", [".md"])
    ignore_dirs = set(cfg.get("sources.docs.ignore_dirs", [".git", ".venv", "node_modules"]))

    for proj in projects:
        repo_name = proj.get("name")
        base_path = proj.get("path")
        if not base_path or not os.path.exists(base_path):
            continue
        print(f"  → Scanning docs in {repo_name}")
        for root, dirs, files in os.walk(base_path):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in extensions:
                    continue
                full_path = os.path.join(root, file)
                rel_path  = os.path.relpath(full_path, base_path)
                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        text = f.read()
                    if not text.strip():
                        continue

                    raw_chunks = chunk_markdown(text, rel_path, source_type="docs")
                    mtime = datetime.fromtimestamp(
                        os.path.getmtime(full_path)
                    ).isoformat()

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