"""Document ingestion pipeline."""

from __future__ import annotations

from typing import List, Dict, Any

from .vector_store import VectorStore


class DocumentIngestion:
    def __init__(self, store: VectorStore):
        self.store = store

    async def ingest(self, documents: List[Dict[str, Any]]) -> Dict[str, int]:
        """Ingest documents into the vector store.

        Each document dict should have at least a 'content' (or 'text') key.
        Optional keys: 'id', 'source', 'title', and any other metadata.
        """
        texts: List[str] = []
        metadatas: List[Dict[str, Any]] = []
        ids: List[str] = []

        for doc in documents:
            text = doc.get("content") or doc.get("text") or ""
            if not text:
                continue
            texts.append(text)
            meta = {k: v for k, v in doc.items() if k not in ("content", "text", "id")}
            metadatas.append(meta if meta else {"source": "upload"})
            if doc.get("id"):
                ids.append(str(doc["id"]))

        if not texts:
            return {"ingested": 0}

        count = await self.store.add_documents(
            documents=texts,
            metadatas=metadatas,
            ids=ids if ids else None,
        )
        return {"ingested": count}

