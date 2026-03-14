"""
Document ingestion pipeline with smart chunking and format support.
Supports PDF, DOCX, Markdown, HTML, CSV, and plain text.
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .chunking import Chunk, chunk_recursive, chunk_semantic, add_contextual_prefix
from .vector_store import VectorStore

logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF bytes."""
    try:
        import fitz  # pymupdf
        doc = fitz.open(stream=content, filetype="pdf")
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n\n".join(text_parts)
    except ImportError:
        logger.warning("pymupdf not installed. Install with: pip install pymupdf")
        return ""
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return ""


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from DOCX bytes."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        logger.warning("python-docx not installed. Install with: pip install python-docx")
        return ""
    except Exception as e:
        logger.error(f"DOCX extraction failed: {e}")
        return ""


def extract_text_from_html(html: str) -> str:
    """Strip HTML tags and extract plain text."""
    # Remove script and style blocks
    html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove tags
    text = re.sub(r'<[^>]+>', ' ', html)
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_text_from_csv(content: str) -> str:
    """Convert CSV to readable text."""
    import csv
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        return ""
    # Use first row as headers
    headers = rows[0]
    text_parts = []
    for row in rows[1:]:
        pairs = [f"{h}: {v}" for h, v in zip(headers, row) if v.strip()]
        text_parts.append(". ".join(pairs))
    return "\n".join(text_parts)


class DocumentIngestion:
    """Enhanced document ingestion with chunking, format support, and deduplication."""

    def __init__(
        self,
        store: VectorStore,
        chunk_size: int = 1000,
        chunk_method: str = "recursive",  # "recursive", "semantic", "fixed"
    ):
        self.store = store
        self.chunk_size = chunk_size
        self.chunk_method = chunk_method
        self._seen_hashes: set = set()

    async def ingest(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ingest documents into the vector store.

        Each document dict should have:
        - 'content' or 'text': The document text (or raw bytes for PDF/DOCX)
        - Optional: 'filename', 'source', 'title', 'format'
        - Optional: 'id' for deduplication

        Returns:
            Dict with ingestion statistics
        """
        total_chunks = 0
        total_docs = 0
        skipped_dupes = 0
        errors = []

        for doc in documents:
            try:
                text = self._extract_text(doc)
                if not text or len(text.strip()) < 10:
                    continue

                # Deduplication
                content_hash = hashlib.md5(text.encode()).hexdigest()
                if content_hash in self._seen_hashes:
                    skipped_dupes += 1
                    continue
                self._seen_hashes.add(content_hash)

                # Chunk the document
                title = doc.get("title", doc.get("filename", ""))
                base_metadata = {
                    k: v for k, v in doc.items()
                    if k not in ("content", "text", "id", "raw_bytes")
                    and isinstance(v, (str, int, float, bool))
                }
                base_metadata["content_hash"] = content_hash

                chunks = self._chunk_text(text, metadata=base_metadata)

                # Add contextual prefix if title is available
                if title:
                    chunks = add_contextual_prefix(chunks, document_title=title)

                if not chunks:
                    continue

                # Add to vector store
                texts = [c.text for c in chunks]
                metas = [c.metadata for c in chunks]
                ids = [f"{content_hash}_{c.index}" for c in chunks]

                count = await self.store.add_documents(
                    documents=texts, metadatas=metas, ids=ids
                )
                total_chunks += count
                total_docs += 1

            except Exception as e:
                errors.append(str(e))
                logger.error(f"Ingestion error for doc: {e}")

        return {
            "documents_ingested": total_docs,
            "chunks_created": total_chunks,
            "duplicates_skipped": skipped_dupes,
            "errors": errors,
        }

    def _extract_text(self, doc: Dict[str, Any]) -> str:
        """Extract text from a document based on its format."""
        # If raw bytes provided (for PDF/DOCX uploads)
        if "raw_bytes" in doc:
            fmt = doc.get("format", "").lower()
            filename = doc.get("filename", "").lower()
            if fmt == "pdf" or filename.endswith(".pdf"):
                return extract_text_from_pdf(doc["raw_bytes"])
            elif fmt == "docx" or filename.endswith(".docx"):
                return extract_text_from_docx(doc["raw_bytes"])

        text = doc.get("content") or doc.get("text") or ""

        # Auto-detect format
        fmt = doc.get("format", "").lower()
        filename = doc.get("filename", "").lower()

        if fmt == "html" or filename.endswith((".html", ".htm")):
            text = extract_text_from_html(text)
        elif fmt == "csv" or filename.endswith(".csv"):
            text = extract_text_from_csv(text)
        # Markdown and plain text need no special extraction

        return text

    def _chunk_text(
        self,
        text: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Chunk]:
        """Chunk text using the configured strategy."""
        if self.chunk_method == "semantic":
            return chunk_semantic(text, max_chunk_size=self.chunk_size, metadata=metadata)
        else:
            return chunk_recursive(
                text,
                max_chunk_size=self.chunk_size,
                min_chunk_size=100,
                overlap=50,
                metadata=metadata,
            )
