"""
Embedding-based semantic router.
Uses cosine similarity between query embeddings and pre-computed route embeddings
to classify queries without an LLM call. ~10ms vs ~500ms for LLM routing.
"""

from __future__ import annotations

import json
import logging
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import ollama

from .classifier import TaskType

logger = logging.getLogger(__name__)


@dataclass
class RouteExample:
    """An example query associated with a route."""
    text: str
    task_type: TaskType


@dataclass
class RouteEmbedding:
    """Pre-computed centroid embedding for a route."""
    task_type: TaskType
    centroid: List[float]
    example_count: int


# Default example queries for each route — used to compute initial centroids
DEFAULT_ROUTE_EXAMPLES: Dict[TaskType, List[str]] = {
    TaskType.SIMPLE_CHAT: [
        "hello", "hi there", "how are you", "thanks", "goodbye",
        "what's up", "hey", "nice to meet you", "ok", "sure",
        "yes", "no", "good morning", "good night", "thank you",
    ],
    TaskType.GENERAL: [
        "what is photosynthesis", "tell me about the history of Rome",
        "how does a car engine work", "what are the planets in our solar system",
        "explain quantum mechanics in simple terms",
        "what is the capital of France", "who invented the telephone",
        "what is climate change", "describe how vaccines work",
        "what are the benefits of meditation",
    ],
    TaskType.REASONING: [
        "why do some countries have higher GDP than others",
        "analyze the pros and cons of remote work",
        "compare and contrast capitalism and socialism",
        "what would happen if the Earth stopped rotating",
        "explain the trolley problem and its implications",
        "how does inflation affect purchasing power step by step",
        "what are the logical fallacies in this argument",
        "prove that the square root of 2 is irrational",
        "what are the second-order effects of universal basic income",
    ],
    TaskType.CODING: [
        "write a Python function to sort a list",
        "how do I fix this TypeError in JavaScript",
        "create a REST API endpoint in FastAPI",
        "debug this SQL query that returns wrong results",
        "implement a binary search tree in C++",
        "write unit tests for this function",
        "how to use async/await in Python",
        "refactor this code to use the strategy pattern",
        "explain what this regex does: ^[a-zA-Z0-9]+$",
        "write a docker-compose.yml for a web app",
    ],
    TaskType.VISION: [
        "what's in this image", "describe this picture",
        "analyze this screenshot", "what does this diagram show",
        "read the text in this photo", "identify objects in this image",
        "what color is the car in the image", "describe the scene",
    ],
    TaskType.CREATIVE: [
        "write a short story about a dragon",
        "create a poem about the ocean",
        "brainstorm names for a coffee shop",
        "write marketing copy for a new app",
        "imagine a world where gravity is reversed",
        "write a song about falling in love",
        "create a character for a fantasy novel",
        "design a logo concept for a tech startup",
    ],
    TaskType.RESEARCH: [
        "search the web for recent AI developments",
        "find the latest news about climate change",
        "what happened in the stock market today",
        "look up the current weather in Tokyo",
        "research the latest treatments for depression",
        "find recent studies on intermittent fasting",
        "what are the trending topics on social media right now",
    ],
}


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _compute_centroid(embeddings: List[List[float]]) -> List[float]:
    """Compute centroid (mean) of a list of embeddings."""
    if not embeddings:
        return []
    dim = len(embeddings[0])
    centroid = [0.0] * dim
    for emb in embeddings:
        for i, v in enumerate(emb):
            centroid[i] += v
    n = len(embeddings)
    return [v / n for v in centroid]


class EmbeddingRouter:
    """Routes queries using embedding similarity to pre-computed route centroids."""

    def __init__(
        self,
        embedding_model: str = "nomic-embed-text",
        ollama_base_url: Optional[str] = None,
        cache_path: Optional[str] = None,
        confidence_threshold: float = 0.45,
    ):
        self.embedding_model = embedding_model
        self.confidence_threshold = confidence_threshold
        self.cache_path = Path(cache_path) if cache_path else Path("data/route_embeddings.json")

        if ollama_base_url:
            self.client = ollama.Client(host=ollama_base_url)
        else:
            self.client = ollama.Client()

        self.route_centroids: Dict[TaskType, RouteEmbedding] = {}
        self.ready = False

        # Try to load cached centroids, else build from defaults
        if not self._load_cached():
            self._build_from_defaults()

    def _embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts."""
        embeddings = []
        for text in texts:
            try:
                response = self.client.embeddings(
                    model=self.embedding_model, prompt=text
                )
                emb = response.get("embedding", [])
                if emb:
                    embeddings.append(emb)
            except Exception as e:
                logger.warning(f"Embedding failed for '{text[:50]}': {e}")
        return embeddings

    def _embed_single(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text."""
        try:
            response = self.client.embeddings(
                model=self.embedding_model, prompt=text
            )
            return response.get("embedding")
        except Exception as e:
            logger.warning(f"Single embedding failed: {e}")
            return None

    def _build_from_defaults(self) -> None:
        """Build route centroids from default example queries."""
        logger.info("Building route embeddings from default examples...")
        for task_type, examples in DEFAULT_ROUTE_EXAMPLES.items():
            embeddings = self._embed_texts(examples)
            if embeddings:
                centroid = _compute_centroid(embeddings)
                self.route_centroids[task_type] = RouteEmbedding(
                    task_type=task_type,
                    centroid=centroid,
                    example_count=len(embeddings),
                )
                logger.debug(
                    f"Route '{task_type.value}': centroid from {len(embeddings)} examples"
                )

        if self.route_centroids:
            self.ready = True
            self._save_cached()
            logger.info(
                f"Embedding router ready with {len(self.route_centroids)} routes"
            )
        else:
            logger.warning("Embedding router: no routes built (embedding model may be unavailable)")

    def _load_cached(self) -> bool:
        """Load cached route centroids from disk."""
        if not self.cache_path.exists():
            return False
        try:
            data = json.loads(self.cache_path.read_text())
            for entry in data:
                task_type = TaskType(entry["task_type"])
                self.route_centroids[task_type] = RouteEmbedding(
                    task_type=task_type,
                    centroid=entry["centroid"],
                    example_count=entry["example_count"],
                )
            self.ready = len(self.route_centroids) > 0
            logger.info(f"Loaded {len(self.route_centroids)} cached route embeddings")
            return self.ready
        except Exception as e:
            logger.warning(f"Failed to load cached route embeddings: {e}")
            return False

    def _save_cached(self) -> None:
        """Save route centroids to disk."""
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            data = [
                {
                    "task_type": re.task_type.value,
                    "centroid": re.centroid,
                    "example_count": re.example_count,
                }
                for re in self.route_centroids.values()
            ]
            self.cache_path.write_text(json.dumps(data))
            logger.debug("Saved route embeddings cache")
        except Exception as e:
            logger.warning(f"Failed to save route embeddings: {e}")

    def classify(self, query: str) -> Optional[Tuple[TaskType, float]]:
        """
        Classify a query by embedding similarity to route centroids.

        Returns:
            Tuple of (TaskType, confidence) if above threshold, else None.
        """
        if not self.ready:
            return None

        query_embedding = self._embed_single(query)
        if not query_embedding:
            return None

        best_type = TaskType.GENERAL
        best_score = -1.0

        for task_type, route_emb in self.route_centroids.items():
            score = _cosine_similarity(query_embedding, route_emb.centroid)
            if score > best_score:
                best_score = score
                best_type = task_type

        if best_score >= self.confidence_threshold:
            return (best_type, best_score)

        return None

    def classify_with_scores(self, query: str) -> Dict[str, float]:
        """Classify query and return scores for all routes (useful for debugging)."""
        if not self.ready:
            return {}

        query_embedding = self._embed_single(query)
        if not query_embedding:
            return {}

        scores = {}
        for task_type, route_emb in self.route_centroids.items():
            scores[task_type.value] = round(
                _cosine_similarity(query_embedding, route_emb.centroid), 4
            )
        return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True))

    def update_route(self, task_type: TaskType, new_example: str) -> None:
        """
        Online learning: update a route centroid with a new confirmed example.
        Uses exponential moving average to gradually shift the centroid.
        """
        emb = self._embed_single(new_example)
        if not emb:
            return

        if task_type in self.route_centroids:
            route = self.route_centroids[task_type]
            # Exponential moving average: weight new example less as more examples accumulate
            alpha = 1.0 / (route.example_count + 1)
            new_centroid = [
                (1 - alpha) * c + alpha * e
                for c, e in zip(route.centroid, emb)
            ]
            route.centroid = new_centroid
            route.example_count += 1
        else:
            self.route_centroids[task_type] = RouteEmbedding(
                task_type=task_type,
                centroid=emb,
                example_count=1,
            )

        self._save_cached()
