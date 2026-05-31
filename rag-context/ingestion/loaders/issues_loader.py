import hashlib
from github import Github
from ingestion.chunkers.markdown_chunker import chunk_markdown
from config import cfg
import os


def load_issues_chunks() -> list[dict]:
    github_token = os.getenv("GITHUB_TOKEN")
    github_repo  = cfg.get("github.repository", os.getenv("GITHUB_REPO"))

    if not github_token or not github_repo:
        print("  ⚠ Skipping issues: GITHUB_TOKEN or github.repository not set")
        return []

    print(f"  → Fetching issues from {github_repo}")
    g    = Github(github_token)
    repo = g.get_repo(github_repo)

    chunks = []
    for issue in repo.get_issues(state="all"):
        if issue.pull_request:
            continue  # skip PRs

        body = issue.body or ""
        full_text = f"# {issue.title}\n\n{body}"

        raw_chunks = chunk_markdown(full_text, str(issue.number), source_type="issues")

        for i, chunk_text in enumerate(raw_chunks):
            chunk_id = _make_id(issue.number, i, chunk_text)
            chunks.append({
                "text":         chunk_text,
                "source_type":  "issue",
                "file_path":    issue.html_url,
                "repo":         github_repo,
                "last_updated": issue.updated_at.isoformat(),
                "chunk_id":     chunk_id,
            })

    print(f"  ✓ Issue chunks collected: {len(chunks)}")
    return chunks


def _make_id(issue_number: int, index: int, text: str) -> str:
    raw = f"issue::{issue_number}::{index}::{text[:64]}"
    return hashlib.md5(raw.encode()).hexdigest()