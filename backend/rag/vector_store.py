"""ChromaDB-based vector store with Ollama embeddings and hybrid search."""

from __future__ import annotations

import math
import re
import uuid
from collections import Counter
from typing import List, Dict, Any, Optional
import logging
from pathlib import Path

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    logging.warning("chromadb not available")

import ollama

from .reranker import reciprocal_rank_fusion

logger = logging.getLogger(__name__)


class BM25Index:
    """Simple in-memory BM25 index for keyword search."""

    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs: Dict[str, str] = {}  # id -> text
        self.doc_freqs: Dict[str, int] = {}  # term -> number of docs containing term
        self.doc_lens: Dict[str, int] = {}  # id -> word count
        self.avg_dl: float = 0.0
        self.N: int = 0
        self._tf_cache: Dict[str, Counter] = {}  # id -> term frequency counter

    def add(self, doc_id: str, text: str) -> None:
        """Add a document to the BM25 index."""
        tokens = self._tokenize(text)
        self.docs[doc_id] = text
        self.doc_lens[doc_id] = len(tokens)
        tf = Counter(tokens)
        self._tf_cache[doc_id] = tf

        for term in set(tokens):
            self.doc_freqs[term] = self.doc_freqs.get(term, 0) + 1

        self.N = len(self.docs)
        self.avg_dl = sum(self.doc_lens.values()) / max(self.N, 1)

    def search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """Search the BM25 index."""
        if not self.docs:
            return []

        query_tokens = self._tokenize(query)
        scores: Dict[str, float] = {}

        for doc_id in self.docs:
            score = 0.0
            dl = self.doc_lens[doc_id]
            tf = self._tf_cache[doc_id]

            for term in query_tokens:
                if term not in self.doc_freqs:
                    continue
                df = self.doc_freqs[term]
                idf = math.log((self.N - df + 0.5) / (df + 0.5) + 1)
                term_freq = tf.get(term, 0)
                numerator = term_freq * (self.k1 + 1)
                denominator = term_freq + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
                score += idf * numerator / denominator

            if score > 0:
                scores[doc_id] = score

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [
            {
                "text": self.docs[doc_id],
                "score": score,
                "metadata": {"search_method": "bm25"},
            }
            for doc_id, score in ranked
        ]

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization: lowercase, alphanumeric, remove stopwords."""
        tokens = re.findall(r'\b\w+\b', text.lower())
        # Minimal stopword removal
        stopwords = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                      "being", "have", "has", "had", "do", "does", "did", "will",
                      "would", "could", "should", "may", "might", "can", "shall",
                      "to", "of", "in", "for", "on", "with", "at", "by", "from",
                      "it", "this", "that", "and", "or", "but", "not", "if"}
        return [t for t in tokens if t not in stopwords and len(t) > 1]

    def clear(self) -> None:
        """Clear the BM25 index."""
        self.docs.clear()
        self.doc_freqs.clear()
        self.doc_lens.clear()
        self._tf_cache.clear()
        self.avg_dl = 0.0
        self.N = 0


class VectorStore:
    """Vector store using ChromaDB and Ollama embeddings with hybrid BM25+vector search."""

    def __init__(
        self,
        persist_directory: str = "./data/chromadb",
        embedding_model: str = "nomic-embed-text",
        ollama_base_url: Optional[str] = None,
        collection_name: str = "knowledge_base",
    ):
        if not CHROMADB_AVAILABLE:
            raise ImportError("chromadb is required. Install with: pip install chromadb")

        self.embedding_model = embedding_model
        self.persist_directory = Path(persist_directory)
        self.persist_directory.mkdir(parents=True, exist_ok=True)

        # Initialize Ollama client
        if ollama_base_url:
            self.ollama_client = ollama.Client(host=ollama_base_url)
        else:
            self.ollama_client = ollama.Client()

        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=str(self.persist_directory),
            settings=Settings(anonymized_telemetry=False, allow_reset=True),
        )

        # Get or create collection
        self.collection_name = collection_name
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

        # Initialize BM25 index
        self.bm25 = BM25Index()
        self._rebuild_bm25()

        self.ready = True
        logger.info(
            f"VectorStore initialized: {self.collection.count()} docs, "
            f"BM25 index: {self.bm25.N} docs"
        )

    def _rebuild_bm25(self) -> None:
        """Rebuild BM25 index from ChromaDB documents."""
        try:
            count = self.collection.count()
            if count == 0:
                return
            # Fetch all documents
            result = self.collection.get(
                limit=count,
                include=["documents"],
            )
            if result.get("ids") and result.get("documents"):
                for doc_id, text in zip(result["ids"], result["documents"]):
                    if text:
                        self.bm25.add(doc_id, text)
            logger.info(f"BM25 index rebuilt with {self.bm25.N} documents")
        except Exception as e:
            logger.warning(f"BM25 rebuild failed: {e}")

    def _embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings using Ollama."""
        embeddings = []
        for text in texts:
            try:
                response = self.ollama_client.embeddings(
                    model=self.embedding_model, prompt=text
                )
                embedding = response.get("embedding", [])
                if embedding:
                    embeddings.append(embedding)
                else:
                    logger.warning(f"No embedding generated for text: {text[:50]}...")
                    embeddings.append([0.0] * 768)
            except Exception as e:
                logger.error(f"Embedding error: {e}")
                embeddings.append([0.0] * 768)

        return embeddings

    async def search(
        self,
        query: str,
        top_k: int = 5,
        use_hybrid: bool = True,
        use_rerank: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar documents using hybrid BM25 + vector search.

        Args:
            query: Search query
            top_k: Number of results to return
            use_hybrid: If True, combine BM25 and vector results via RRF
            use_rerank: If True, rerank results using LLM (slower but more precise)

        Returns:
            List of results with text, metadata, and score
        """
        if not self.ready:
            return []

        try:
            # Vector search
            vector_results = await self._vector_search(query, top_k=top_k * 2)

            if not use_hybrid or self.bm25.N == 0:
                return vector_results[:top_k]

            # BM25 search
            bm25_results = self.bm25.search(query, top_k=top_k * 2)

            # Merge with Reciprocal Rank Fusion
            merged = reciprocal_rank_fusion(
                vector_results, bm25_results, top_n=top_k
            )

            # Optional LLM reranking
            if use_rerank and merged:
                from .reranker import LLMReranker
                reranker = LLMReranker(self.ollama_client)
                merged = reranker.rerank(query, merged, top_k=top_k)

            logger.info(
                f"Hybrid search '{query[:50]}': {len(vector_results)} vector + "
                f"{len(bm25_results)} BM25 → {len(merged)} merged"
            )
            return merged

        except Exception as e:
            logger.error(f"Hybrid search error: {e}")
            return []

    async def _vector_search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """Pure vector similarity search."""
        query_embeddings = self._embed([query])
        if not query_embeddings:
            return []

        results = self.collection.query(
            query_embeddings=query_embeddings,
            n_results=top_k,
        )

        formatted = []
        if results.get("documents") and results["documents"][0]:
            for i, doc in enumerate(results["documents"][0]):
                formatted.append({
                    "text": doc,
                    "metadata": results.get("metadatas", [[]])[0][i]
                    if results.get("metadatas")
                    else {},
                    "score": 1.0
                    - (results.get("distances", [[]])[0][i] if results.get("distances") else 0.0),
                })
        return formatted

    async def add_documents(
        self,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None,
    ) -> int:
        """
        Add documents to both vector store and BM25 index.

        Args:
            documents: List of document texts
            metadatas: Optional list of metadata dicts
            ids: Optional list of document IDs

        Returns:
            Number of documents added
        """
        if not self.ready or not documents:
            return 0

        try:
            if not ids:
                ids = [str(uuid.uuid4()) for _ in documents]

            if not metadatas:
                metadatas = [{"source": "unknown"} for _ in documents]

            # Generate embeddings
            embeddings = self._embed(documents)

            # Add to ChromaDB
            self.collection.add(
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )

            # Add to BM25 index
            for doc_id, text in zip(ids, documents):
                self.bm25.add(doc_id, text)

            logger.info(f"Added {len(documents)} documents to vector store + BM25")
            return len(documents)

        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return 0

    def get_count(self) -> int:
        """Get the number of documents in the collection."""
        if not self.ready:
            return 0
        return self.collection.count()

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        return {
            "collection_name": self.collection_name,
            "document_count": self.get_count(),
            "bm25_index_size": self.bm25.N,
            "embedding_model": self.embedding_model,
        }

    def clear(self):
        """Clear all documents from both stores."""
        if not self.ready:
            return
        self.client.delete_collection(self.collection_name)
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self.bm25.clear()
        logger.info("Vector store and BM25 index cleared")
