import re
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import cfg

CSHARP_BOUNDARIES = re.compile(
    r'(?=\s*(?:public|private|protected|internal|static|async|override|virtual)'
    r'\s+[\w<>\[\]]+\s+\w+\s*[\(\{])',
    re.MULTILINE,
)

VUE_BOUNDARIES = re.compile(
    r'(?=<template|<script|<style)',
    re.MULTILINE,
)


def chunk_csharp(text: str) -> list[str]:
    parts = CSHARP_BOUNDARIES.split(text)
    return _filter_and_trim(parts)


def chunk_vue(text: str) -> list[str]:
    parts = VUE_BOUNDARIES.split(text)
    return _filter_and_trim(parts)


def chunk_generic(text: str) -> list[str]:
    size = cfg.get("sources.code.chunk_size", 500)
    overlap = cfg.get("sources.code.chunk_overlap", 50)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
    )
    return [c.strip() for c in splitter.split_text(text) if c.strip()]


def _filter_and_trim(parts: list[str]) -> list[str]:
    size = cfg.get("sources.code.chunk_size", 500)
    overlap = cfg.get("sources.code.chunk_overlap", 50)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
    )
    result = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) > size:
            result.extend(splitter.split_text(part))
        else:
            result.append(part)
    return result