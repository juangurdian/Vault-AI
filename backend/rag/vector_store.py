"""ChromaDB-based vector store with Ollama embeddings."""

from __future__ import annotations

from typing import List, Dict, Any, Optional
import logging
from pathlib import Path
import os

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    logging.warning("chromadb not available")

import ollama

logger = logging.getLogger(__name__)


class VectorStore:
    """Vector store using ChromaDB and Ollama embeddings."""

    def __init__(
        self,
        persist_directory: str = "./data/chromadb",
        embedding_model: str = "nomic-embed-text",
        ollama_base_url: Optional[str] = None,
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
        self.collection = self.client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"},
        )

        self.ready = True
        logger.info(f"VectorStore initialized with {self.collection.count()} documents")

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
                    # Fallback: zero vector
                    embeddings.append([0.0] * 768)
            except Exception as e:
                logger.error(f"Embedding error: {e}")
                # Fallback: zero vector
                embeddings.append([0.0] * 768)

        return embeddings

    async def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Search for similar documents.

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of results with text, metadata, and score
        """
        if not self.ready:
            return []

        try:
            # Generate query embedding
            query_embeddings = self._embed([query])
            if not query_embeddings:
                return []

            # Search ChromaDB
            results = self.collection.query(
                query_embeddings=query_embeddings,
                n_results=top_k,
            )

            # Format results
            formatted_results = []
            if results.get("documents") and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    formatted_results.append(
                        {
                            "text": doc,
                            "metadata": results.get("metadatas", [[]])[0][i]
                            if results.get("metadatas")
                            else {},
                            "score": 1.0
                            - (results.get("distances", [[]])[0][i] if results.get("distances") else 0.0),
                        }
                    )

            logger.info(f"Vector search '{query}': Found {len(formatted_results)} results")
            return formatted_results

        except Exception as e:
            logger.error(f"Vector search error: {e}")
            return []

    async def add_documents(
        self,
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None,
    ) -> int:
        """
        Add documents to the vector store.

        Args:
            documents: List of document texts
            metadatas: Optional list of metadata dicts
            ids: Optional list of document IDs

        Returns:
            Number of documents added
        """
        if not self.ready:
            return 0

        if not documents:
            return 0

        try:
            # Generate IDs if not provided
            if not ids:
                import uuid

                ids = [str(uuid.uuid4()) for _ in documents]

            # Generate metadata if not provided
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

            logger.info(f"Added {len(documents)} documents to vector store")
            return len(documents)

        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return 0

    def get_count(self) -> int:
        """Get the number of documents in the collection."""
        if not self.ready:
            return 0
        return self.collection.count()

    def clear(self):
        """Clear all documents from the collection."""
        if not self.ready:
            return
        self.client.delete_collection("knowledge_base")
        self.collection = self.client.get_or_create_collection(
            name="knowledge_base",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("Vector store cleared")
