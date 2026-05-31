import httpx
from mcp.server.fastmcp import FastMCP
from config import cfg
import os

API_BASE_URL = cfg.get("api.base_url", os.getenv("API_BASE_URL", "http://localhost:8000"))

mcp = FastMCP("rag-context")


@mcp.tool()
def search_project_context(query: str, source_type: str = None, n_results: int = 8) -> str:
    """
    Search the project knowledge base for relevant context before implementing
    any feature, fixing any bug, or making any architectural decision.

    Use this tool to find:
    - Existing patterns and conventions in the codebase
    - Architecture decisions and documentation
    - Related GitHub issues and their resolutions
    - Similar code in the backend (C#) or frontend (Vue)

    Args:
        query:       Natural language description of what you are looking for
        source_type: Optional filter - one of: code, architecture, issue
        n_results:   Number of results to return (default 8)

    Returns:
        Formatted context chunks with source file and relevance distance
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
    Re-index the project knowledge base. Call this after significant code changes
    to keep the RAG context up to date.

    Args:
        sources: Optional list of sources to reindex - code, architecture, issue.
                 Defaults to all sources.

    Returns:
        Summary of chunks upserted
    """
    payload = {"sources": sources or ["code", "docs", "issues"]}

    with httpx.Client(timeout=300) as client:
        response = client.post(f"{API_BASE_URL}/ingest", json=payload)
        response.raise_for_status()
        data = response.json()

    return f"Reindex complete. Upserted {data['chunks_upserted']} chunks from {data['sources']}."


if __name__ == "__main__":
    mcp.run()