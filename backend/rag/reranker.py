"""
Reranking module for RAG search results.
Uses cross-encoder models or LLM-based reranking for improved precision.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class LLMReranker:
    """Rerank search results using a local LLM for relevance scoring."""

    def __init__(self, ollama_client, model: str = "qwen3:4b"):
        self.client = ollama_client
        self.model = model

    def rerank(
        self,
        query: str,
        results: List[Dict[str, Any]],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Rerank results using LLM relevance scoring.

        Args:
            query: The original search query
            results: List of dicts with at least a 'text' key
            top_k: Number of results to return after reranking

        Returns:
            Reranked list of results with added 'rerank_score'
        """
        if len(results) <= 1:
            return results

        scored = []
        for result in results:
            text = result.get("text", "")[:500]
            score = self._score_relevance(query, text)
            result_copy = dict(result)
            result_copy["rerank_score"] = score
            scored.append(result_copy)

        scored.sort(key=lambda x: x["rerank_score"], reverse=True)
        return scored[:top_k]

    def _score_relevance(self, query: str, passage: str) -> float:
        """Score the relevance of a passage to a query using LLM."""
        prompt = f"""Rate the relevance of this passage to the query on a scale of 0-10.
Respond with ONLY a number.

Query: {query}
Passage: {passage}

Relevance score:"""

        try:
            response = self.client.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.0, "num_predict": 5},
            )
            text = response.get("message", {}).get("content", "0").strip()
            # Extract number
            import re
            match = re.search(r"(\d+(?:\.\d+)?)", text)
            if match:
                return min(float(match.group(1)) / 10.0, 1.0)
            return 0.0
        except Exception as e:
            logger.debug(f"Reranking failed: {e}")
            return 0.0


def reciprocal_rank_fusion(
    *result_lists: List[Dict[str, Any]],
    k: int = 60,
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    """
    Merge multiple ranked result lists using Reciprocal Rank Fusion (RRF).
    RRF is simple and effective: score = sum(1 / (k + rank)) across all lists.

    Args:
        *result_lists: Multiple lists of results, each with at least 'text' key
        k: RRF parameter (higher = less weight to top results)
        top_n: Number of results to return

    Returns:
        Merged and re-ranked list of results
    """
    # Build a map: text -> {merged result, rrf_score}
    merged: Dict[str, Dict[str, Any]] = {}

    for results in result_lists:
        for rank, result in enumerate(results):
            text = result.get("text", "")
            key = text[:200]  # Use first 200 chars as dedup key

            if key not in merged:
                merged[key] = dict(result)
                merged[key]["rrf_score"] = 0.0

            merged[key]["rrf_score"] += 1.0 / (k + rank + 1)

    # Sort by RRF score
    ranked = sorted(merged.values(), key=lambda x: x["rrf_score"], reverse=True)
    return ranked[:top_n]
