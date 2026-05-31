import os
import hashlib
from datetime import datetime
from ingestion.chunkers.code_chunker import chunk_csharp, chunk_vue, chunk_generic
from config import cfg

SUPPORTED_LANGUAGES = {
    ".cs":   "csharp",
    ".vue":  "vue",
    ".ts":   "typescript",
    ".js":   "javascript",
}


def load_code_chunks() -> list[dict]:
    chunks = []
    
    projects = cfg.get("sources.code.projects", [])
    if not projects:
        # Fallback to env variables if not defined in config
        backend = os.getenv("BACKEND_PATH")
        if backend:
            projects.append({"name": "backend", "path": backend})
        frontend = os.getenv("FRONTEND_PATH")
        if frontend:
            projects.append({"name": "frontend", "path": frontend})

    extensions = cfg.get("sources.code.extensions", [".cs", ".vue", ".ts", ".js"])
    ignore_dirs = set(cfg.get("sources.code.ignore_dirs", ["node_modules", "dist", "bin", "obj", ".git", ".venv", "migrations"]))

    for proj in projects:
        repo_name = proj.get("name")
        base_path = proj.get("path")
        if not base_path or not os.path.exists(base_path):
            print(f"  ⚠ Skipping {repo_name}: path not set or does not exist")
            continue
        print(f"  → Scanning {repo_name} at {base_path}")
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
                    
                    lang = SUPPORTED_LANGUAGES.get(ext, "generic")
                    if lang == "csharp":
                        raw_chunks = chunk_csharp(text)
                    elif lang == "vue":
                        raw_chunks = chunk_vue(text)
                    else:
                        raw_chunks = chunk_generic(text)

                    mtime = datetime.fromtimestamp(
                        os.path.getmtime(full_path)
                    ).isoformat()

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