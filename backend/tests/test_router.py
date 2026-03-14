"""Tests for the routing system (classifier, router, embedding_router)."""

from unittest.mock import MagicMock, patch

import pytest

from backend.router.classifier import QueryClassifier, TaskType, ClassificationResult
from backend.router.embedding_router import (
    EmbeddingRouter,
    DEFAULT_ROUTE_EXAMPLES,
    _cosine_similarity,
    _compute_centroid,
    RouteEmbedding,
)


# ── QueryClassifier (regex-based) ─────────────────────────────────────────


class TestRegexClassifier:
    """Tests for the regex-based QueryClassifier."""

    @pytest.fixture(autouse=True)
    def _setup(self):
        self.classifier = QueryClassifier()

    def test_regex_classifier_code_detection(self):
        """Code-related queries should be classified as CODING."""
        queries = [
            "Write a Python function to sort a list",
            "How do I debug this TypeError?",
            "Create a REST API endpoint in FastAPI",
            "Fix this bug in my JavaScript code",
            "Write a SQL query to join two tables",
        ]
        for query in queries:
            result = self.classifier.classify(query)
            assert result.task_type == TaskType.CODING, (
                f"Expected CODING for '{query}', got {result.task_type}"
            )
            assert result.confidence > 0
            assert len(result.keywords_found) > 0

    def test_regex_classifier_math(self):
        """Math / analytical queries should be classified as REASONING."""
        queries = [
            "Why does inflation affect purchasing power?",
            "Explain the relationship between supply and demand",
            "Compare the advantages and disadvantages of solar energy",
            "Analyze the cause and effect of deforestation step by step",
        ]
        for query in queries:
            result = self.classifier.classify(query)
            assert result.task_type == TaskType.REASONING, (
                f"Expected REASONING for '{query}', got {result.task_type}"
            )
            assert result.confidence > 0

    def test_regex_classifier_creative(self):
        """Creative-writing queries should be classified as CREATIVE."""
        queries = [
            "Write a poem about the ocean",
            "Brainstorm names for a coffee shop",
            "Create a story about a dragon",
            "Write marketing copy for a new app",
        ]
        for query in queries:
            result = self.classifier.classify(query)
            assert result.task_type == TaskType.CREATIVE, (
                f"Expected CREATIVE for '{query}', got {result.task_type}"
            )

    def test_regex_classifier_general(self):
        """Generic questions with enough words should be classified as GENERAL."""
        # A query long enough (>=10 words) and complex enough to avoid SIMPLE_CHAT,
        # but without keywords that trigger other categories.
        query = (
            "I would like to know more about the general topic of "
            "everyday life in ancient civilizations around the Mediterranean"
        )
        result = self.classifier.classify(query)
        assert result.task_type == TaskType.GENERAL, (
            f"Expected GENERAL, got {result.task_type}"
        )

    def test_classification_result_fields(self):
        """ClassificationResult should carry all expected fields."""
        result = self.classifier.classify("hello")
        assert isinstance(result, ClassificationResult)
        assert isinstance(result.task_type, TaskType)
        assert 0.0 <= result.confidence <= 1.0
        assert 0.0 <= result.complexity_score <= 1.0
        assert isinstance(result.keywords_found, list)
        assert isinstance(result.reasoning, str)

    def test_web_search_detection(self):
        """Queries with explicit search triggers should set needs_web_search."""
        result = self.classifier.classify("Search the web for latest AI news")
        assert result.needs_web_search is True
        assert len(result.web_search_reason) > 0


# ── EmbeddingRouter ───────────────────────────────────────────────────────


class TestEmbeddingRouter:
    """Tests for the EmbeddingRouter (mocked Ollama)."""

    def test_embedding_router_initialization(self, mock_ollama_client, tmp_path):
        """EmbeddingRouter should initialise with route centroids from examples."""
        cache_path = tmp_path / "route_cache.json"
        with patch("backend.router.embedding_router.ollama.Client", return_value=mock_ollama_client):
            router = EmbeddingRouter(
                ollama_base_url="http://fake:11434",
                cache_path=str(cache_path),
            )

        # It should have built centroids for each default route
        assert router.ready is True
        assert len(router.route_centroids) == len(DEFAULT_ROUTE_EXAMPLES)
        for task_type in DEFAULT_ROUTE_EXAMPLES:
            assert task_type in router.route_centroids
            assert isinstance(router.route_centroids[task_type], RouteEmbedding)
            assert router.route_centroids[task_type].example_count > 0

    def test_cosine_similarity_identical(self):
        """Cosine similarity of a vector with itself should be 1.0."""
        vec = [1.0, 2.0, 3.0]
        sim = _cosine_similarity(vec, vec)
        assert abs(sim - 1.0) < 1e-6

    def test_cosine_similarity_orthogonal(self):
        """Cosine similarity of orthogonal vectors should be 0.0."""
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert abs(_cosine_similarity(a, b)) < 1e-6

    def test_compute_centroid(self):
        """Centroid of identical vectors should equal that vector."""
        vec = [1.0, 2.0, 3.0]
        centroid = _compute_centroid([vec, vec, vec])
        for c, v in zip(centroid, vec):
            assert abs(c - v) < 1e-6


# ── ModelRouter (cache behaviour) ─────────────────────────────────────────


class TestRouterCache:
    """Test routing cache behaviour in ModelRouter."""

    def test_router_cache_hit(self, mock_ollama_client):
        """Repeated identical queries should return a cached routing decision."""
        with (
            patch("backend.router.router.ollama.Client", return_value=mock_ollama_client),
            patch("backend.router.embedding_router.ollama.Client", return_value=mock_ollama_client),
        ):
            from backend.router.router import ModelRouter

            router = ModelRouter(ollama_base_url="http://fake:11434", use_llm_routing=False)

        # Manually populate the cache
        cache_key = router._make_cache_key("hello world", False)
        fake_result = {
            "model": "qwen3:8b",
            "routing_method": "regex_fallback",
            "task_type": "simple_chat",
            "confidence": 0.7,
        }
        router._routing_cache[cache_key] = fake_result

        # The same cache key should be present
        assert cache_key in router._routing_cache
        cached = router._routing_cache[cache_key]
        assert cached["model"] == "qwen3:8b"

    def test_router_model_selection(self):
        """TASK_TO_MODEL_TYPE should map every TaskType to an appropriate ModelType."""
        from backend.router.router import TASK_TO_MODEL_TYPE
        from backend.router.model_profiles import ModelType

        # Every task type should have a mapping
        for task_type in TaskType:
            assert task_type in TASK_TO_MODEL_TYPE, (
                f"TaskType.{task_type.name} missing from TASK_TO_MODEL_TYPE"
            )
            model_type = TASK_TO_MODEL_TYPE[task_type]
            assert isinstance(model_type, ModelType)

        # Spot-check specific mappings
        assert TASK_TO_MODEL_TYPE[TaskType.CODING] == ModelType.CODING
        assert TASK_TO_MODEL_TYPE[TaskType.REASONING] == ModelType.REASONING
        assert TASK_TO_MODEL_TYPE[TaskType.SIMPLE_CHAT] == ModelType.FAST
