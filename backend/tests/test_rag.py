"""Tests for the RAG system (chunking, reranker, graph_store, vector_store BM25)."""

import pytest
import pytest_asyncio

from backend.rag.chunking import (
    Chunk,
    chunk_fixed_size,
    chunk_recursive,
    chunk_semantic,
    add_contextual_prefix,
)
from backend.rag.reranker import reciprocal_rank_fusion
from backend.rag.vector_store import BM25Index


# ── Chunking ──────────────────────────────────────────────────────────────


class TestFixedSizeChunking:
    def test_fixed_size_chunking(self):
        """chunk_fixed_size should split text into word-count-based chunks."""
        text = " ".join(f"word{i}" for i in range(100))  # 100 words
        chunks = chunk_fixed_size(text, chunk_size=30, overlap=5)

        assert len(chunks) > 1
        for c in chunks:
            assert isinstance(c, Chunk)
            assert c.metadata["chunk_method"] == "fixed_size"
            # Each chunk should have at most 30 words
            assert len(c.text.split()) <= 30

    def test_fixed_size_empty(self):
        """Empty text should return no chunks."""
        assert chunk_fixed_size("") == []

    def test_fixed_size_overlap(self):
        """Chunks should share overlapping words when overlap > 0."""
        text = " ".join(f"w{i}" for i in range(20))
        chunks = chunk_fixed_size(text, chunk_size=10, overlap=3)
        assert len(chunks) >= 2
        # Last words of first chunk should overlap with first words of second
        first_words = chunks[0].text.split()
        second_words = chunks[1].text.split()
        overlap_words = set(first_words[-3:]) & set(second_words[:3])
        assert len(overlap_words) > 0


class TestRecursiveChunking:
    def test_recursive_chunking(self):
        """chunk_recursive should split at natural boundaries."""
        text = (
            "# Introduction\n\n"
            "This is the first paragraph with enough text to stand alone.\n\n"
            "## Section Two\n\n"
            "Another paragraph that discusses a different topic entirely.\n\n"
            "## Section Three\n\n"
            "And yet another section with its own content."
        )
        chunks = chunk_recursive(text, max_chunk_size=120, min_chunk_size=10)
        assert len(chunks) >= 1
        for c in chunks:
            assert isinstance(c, Chunk)
            assert len(c.text) > 0
            assert c.metadata.get("chunk_method") in ("recursive",)

    def test_recursive_empty(self):
        assert chunk_recursive("") == []


class TestSemanticChunking:
    def test_semantic_chunking(self):
        """chunk_semantic should split at heading boundaries."""
        text = (
            "# Title\n\n"
            "Content under title.\n\n"
            "## Heading A\n\n"
            "Paragraph under heading A.\n\n"
            "## Heading B\n\n"
            "Paragraph under heading B."
        )
        chunks = chunk_semantic(text, max_chunk_size=500)
        assert len(chunks) >= 1
        for c in chunks:
            assert isinstance(c, Chunk)

    def test_semantic_empty(self):
        assert chunk_semantic("") == []


class TestContextualPrefix:
    def test_contextual_prefix(self):
        """add_contextual_prefix should prepend document context to each chunk."""
        chunks = [
            Chunk(text="Some content here.", index=0),
            Chunk(text="More content here.", index=1),
        ]
        result = add_contextual_prefix(
            chunks,
            document_title="Test Doc",
            document_summary="A test document.",
        )
        assert len(result) == 2
        for c in result:
            assert c.text.startswith("Document: Test Doc")
            assert "Summary: A test document." in c.text

    def test_contextual_prefix_no_title(self):
        """Without title/summary the chunks should be unchanged."""
        chunks = [Chunk(text="Hello", index=0)]
        result = add_contextual_prefix(chunks)
        assert result[0].text == "Hello"


# ── BM25 ──────────────────────────────────────────────────────────────────


class TestBM25:
    def test_bm25_search(self):
        """BM25Index should add documents and return relevant results."""
        idx = BM25Index()
        idx.add("d1", "Python programming language guide")
        idx.add("d2", "JavaScript frameworks overview")
        idx.add("d3", "Machine learning with Python and TensorFlow")

        results = idx.search("Python programming", top_k=2)
        assert len(results) > 0
        # The top result should contain "Python"
        assert "Python" in results[0]["text"]
        assert results[0]["score"] > 0

    def test_bm25_empty_index(self):
        """Searching an empty BM25 index should return empty list."""
        idx = BM25Index()
        assert idx.search("anything") == []


# ── Reciprocal Rank Fusion ────────────────────────────────────────────────


class TestReciprocalRankFusion:
    def test_reciprocal_rank_fusion(self):
        """RRF should merge two ranked lists and produce a combined ranking."""
        list_a = [
            {"text": "doc about python", "score": 0.9},
            {"text": "doc about java", "score": 0.7},
            {"text": "doc about rust", "score": 0.5},
        ]
        list_b = [
            {"text": "doc about java", "score": 0.8},
            {"text": "doc about python", "score": 0.6},
            {"text": "doc about go", "score": 0.4},
        ]

        merged = reciprocal_rank_fusion(list_a, list_b, k=60, top_n=5)
        assert len(merged) > 0
        # All results should have an rrf_score
        for r in merged:
            assert "rrf_score" in r
            assert r["rrf_score"] > 0

        # Items appearing in both lists should score higher
        texts = [r["text"] for r in merged]
        # python and java appear in both, so they should be in the top results
        assert "doc about python" in texts[:3]
        assert "doc about java" in texts[:3]

    def test_rrf_single_list(self):
        """RRF with a single list should return that list (with rrf_scores)."""
        single = [{"text": "only one", "score": 1.0}]
        merged = reciprocal_rank_fusion(single, top_n=5)
        assert len(merged) == 1
        assert merged[0]["text"] == "only one"


# ── KnowledgeGraph ────────────────────────────────────────────────────────


class TestGraphStore:
    @pytest.mark.asyncio
    async def test_graph_store_tables(self, tmp_db_path):
        """_ensure_tables should create entities and relationships tables."""
        from backend.rag.graph_store import KnowledgeGraph

        kg = KnowledgeGraph(db_path=tmp_db_path)
        await kg._ensure_tables()

        # Verify tables exist by querying sqlite_master
        import aiosqlite

        async with aiosqlite.connect(tmp_db_path) as db:
            cursor = await db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = {row[0] for row in await cursor.fetchall()}

        assert "entities" in tables
        assert "relationships" in tables

    @pytest.mark.asyncio
    async def test_graph_store_search_empty(self, tmp_db_path):
        """Searching an empty graph should return an empty GraphSearchResult."""
        from backend.rag.graph_store import KnowledgeGraph

        kg = KnowledgeGraph(db_path=tmp_db_path)
        result = await kg.search("nonexistent entity")

        assert result.entities == []
        assert result.relationships == []
        assert result.context == ""
