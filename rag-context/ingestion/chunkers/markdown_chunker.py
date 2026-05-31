from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from config import cfg

HEADERS_TO_SPLIT_ON = [
    ("#",  "h1"),
    ("##", "h2"),
    ("###","h3"),
]

def chunk_markdown(text: str, file_path: str, source_type: str = "docs") -> list[str]:
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=HEADERS_TO_SPLIT_ON,
        strip_headers=False,
    )
    header_chunks = header_splitter.split_text(text)

    size = cfg.get(f"sources.{source_type}.chunk_size", 500)
    overlap = cfg.get(f"sources.{source_type}.chunk_overlap", 50)
    char_splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
    )

    final_chunks = []
    for chunk in header_chunks:
        sub_chunks = char_splitter.split_text(chunk.page_content)
        for sub in sub_chunks:
            if sub.strip():
                final_chunks.append(sub.strip())

    return final_chunks