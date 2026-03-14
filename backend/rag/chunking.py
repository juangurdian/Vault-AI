"""
Smart chunking strategies for document ingestion.
Supports semantic, recursive, and fixed-size chunking.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A chunk of text with metadata."""
    text: str
    index: int
    metadata: Dict[str, Any] = field(default_factory=dict)
    content_hash: str = ""

    def __post_init__(self):
        if not self.content_hash:
            self.content_hash = hashlib.md5(self.text.encode()).hexdigest()


def chunk_fixed_size(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
    metadata: Optional[Dict[str, Any]] = None,
) -> List[Chunk]:
    """Split text into fixed-size chunks with overlap."""
    if not text:
        return []

    words = text.split()
    chunks = []
    start = 0
    idx = 0

    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)

        meta = dict(metadata or {})
        meta["chunk_index"] = idx
        meta["chunk_method"] = "fixed_size"

        chunks.append(Chunk(text=chunk_text, index=idx, metadata=meta))
        start = end - overlap
        idx += 1

    return chunks


def chunk_recursive(
    text: str,
    max_chunk_size: int = 1000,
    min_chunk_size: int = 100,
    overlap: int = 50,
    metadata: Optional[Dict[str, Any]] = None,
) -> List[Chunk]:
    """
    Recursively split text using hierarchical separators.
    Tries to preserve natural document structure (headers, paragraphs, sentences).
    """
    if not text:
        return []

    separators = [
        "\n## ",     # Markdown H2
        "\n### ",    # Markdown H3
        "\n\n",      # Paragraph
        "\n",        # Line
        ". ",        # Sentence
        " ",         # Word (last resort)
    ]

    def _split(text: str, sep_idx: int) -> List[str]:
        if len(text) <= max_chunk_size:
            return [text]

        if sep_idx >= len(separators):
            # Last resort: hard split
            return [text[i:i + max_chunk_size] for i in range(0, len(text), max_chunk_size - overlap)]

        sep = separators[sep_idx]
        parts = text.split(sep)

        # Merge small parts back together
        merged = []
        current = ""
        for part in parts:
            candidate = current + sep + part if current else part
            if len(candidate) <= max_chunk_size:
                current = candidate
            else:
                if current:
                    merged.append(current)
                if len(part) > max_chunk_size:
                    # Recurse with finer separator
                    merged.extend(_split(part, sep_idx + 1))
                    current = ""
                else:
                    current = part
        if current:
            merged.append(current)

        return merged

    raw_chunks = _split(text, 0)

    chunks = []
    for idx, chunk_text in enumerate(raw_chunks):
        chunk_text = chunk_text.strip()
        if len(chunk_text) < min_chunk_size and chunks:
            # Merge tiny chunks with previous
            chunks[-1].text += " " + chunk_text
            chunks[-1].content_hash = hashlib.md5(chunks[-1].text.encode()).hexdigest()
            continue

        meta = dict(metadata or {})
        meta["chunk_index"] = idx
        meta["chunk_method"] = "recursive"

        chunks.append(Chunk(text=chunk_text, index=idx, metadata=meta))

    # Re-index after merging
    for i, chunk in enumerate(chunks):
        chunk.index = i
        chunk.metadata["chunk_index"] = i

    return chunks


def chunk_semantic(
    text: str,
    max_chunk_size: int = 1000,
    metadata: Optional[Dict[str, Any]] = None,
) -> List[Chunk]:
    """
    Split text at semantic boundaries (sections, paragraphs, topic shifts).
    Uses heading detection and paragraph boundary analysis.
    """
    if not text:
        return []

    # Detect sections by headings (Markdown or all-caps lines)
    section_pattern = re.compile(
        r'^(?:#{1,6}\s+.+|[A-Z][A-Z\s]{3,}[A-Z])$',
        re.MULTILINE,
    )

    sections = []
    last_end = 0
    for match in section_pattern.finditer(text):
        if match.start() > last_end:
            sections.append(text[last_end:match.start()])
        last_end = match.start()

    if last_end < len(text):
        sections.append(text[last_end:])

    if not sections:
        sections = [text]

    # Further split large sections
    chunks = []
    idx = 0
    for section in sections:
        if len(section) <= max_chunk_size:
            section = section.strip()
            if section:
                meta = dict(metadata or {})
                meta["chunk_index"] = idx
                meta["chunk_method"] = "semantic"
                chunks.append(Chunk(text=section, index=idx, metadata=meta))
                idx += 1
        else:
            # Fall back to recursive for oversized sections
            sub_chunks = chunk_recursive(
                section, max_chunk_size=max_chunk_size, metadata=metadata
            )
            for sc in sub_chunks:
                sc.index = idx
                sc.metadata["chunk_index"] = idx
                chunks.append(sc)
                idx += 1

    return chunks


def add_contextual_prefix(
    chunks: List[Chunk],
    document_title: str = "",
    document_summary: str = "",
) -> List[Chunk]:
    """
    Prepend document context to each chunk (Anthropic's contextual retrieval pattern).
    This improves embedding quality by giving each chunk document-level context.
    """
    prefix_parts = []
    if document_title:
        prefix_parts.append(f"Document: {document_title}")
    if document_summary:
        prefix_parts.append(f"Summary: {document_summary}")

    if not prefix_parts:
        return chunks

    prefix = ". ".join(prefix_parts) + ". "

    for chunk in chunks:
        chunk.text = prefix + chunk.text
        chunk.content_hash = hashlib.md5(chunk.text.encode()).hexdigest()

    return chunks
