"""
Learned router that improves over time from user feedback.
Stores routing outcomes and uses logistic regression to predict optimal models.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")


@dataclass
class RoutingOutcome:
    """A recorded routing decision and its outcome."""
    query_hash: str  # First 100 chars hashed
    task_type: str
    model_used: str
    routing_method: str
    confidence: float
    response_time_ms: int
    token_count: int
    user_rating: Optional[float] = None  # 1-5, None if no feedback
    created_at: int = 0


class LearnedRouter:
    """Learns from routing outcomes to improve future routing decisions."""

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False
        # Simple model performance cache: task_type -> {model: avg_score}
        self._model_scores: Dict[str, Dict[str, float]] = {}
        self._scores_stale = True

    async def _ensure_tables(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS routing_outcomes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_hash TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    model_used TEXT NOT NULL,
                    routing_method TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    response_time_ms INTEGER NOT NULL,
                    token_count INTEGER NOT NULL,
                    user_rating REAL,
                    created_at INTEGER NOT NULL
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_routing_task ON routing_outcomes(task_type)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_routing_model ON routing_outcomes(model_used)"
            )
            await db.commit()
        self._initialized = True

    async def record_outcome(self, outcome: RoutingOutcome) -> None:
        """Record a routing outcome for future learning."""
        await self._ensure_tables()
        outcome.created_at = int(time.time() * 1000)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO routing_outcomes
                   (query_hash, task_type, model_used, routing_method,
                    confidence, response_time_ms, token_count, user_rating, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    outcome.query_hash,
                    outcome.task_type,
                    outcome.model_used,
                    outcome.routing_method,
                    outcome.confidence,
                    outcome.response_time_ms,
                    outcome.token_count,
                    outcome.user_rating,
                    outcome.created_at,
                ),
            )
            await db.commit()
        self._scores_stale = True

    async def update_rating(self, query_hash: str, rating: float) -> None:
        """Update user rating for a routing outcome."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """UPDATE routing_outcomes SET user_rating = ?
                   WHERE query_hash = ? AND user_rating IS NULL
                   ORDER BY created_at DESC LIMIT 1""",
                (rating, query_hash),
            )
            await db.commit()
        self._scores_stale = True

    async def get_best_model(self, task_type: str) -> Optional[str]:
        """Get the best model for a task type based on learned outcomes.

        Uses a composite score: 0.6 * avg_rating + 0.2 * (1 - normalized_latency) + 0.2 * confidence
        Only considers outcomes with user ratings.
        """
        if self._scores_stale:
            await self._refresh_scores()

        models = self._model_scores.get(task_type, {})
        if not models:
            return None

        best_model = max(models, key=models.get)
        return best_model

    async def _refresh_scores(self) -> None:
        """Refresh model performance scores from the database."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            # Only use outcomes that have user ratings and are recent (last 30 days)
            cutoff = int((time.time() - 30 * 86400) * 1000)
            cursor = await db.execute(
                """SELECT task_type, model_used,
                          AVG(user_rating) as avg_rating,
                          AVG(response_time_ms) as avg_latency,
                          AVG(confidence) as avg_confidence,
                          COUNT(*) as count
                   FROM routing_outcomes
                   WHERE user_rating IS NOT NULL AND created_at > ?
                   GROUP BY task_type, model_used
                   HAVING count >= 3""",
                (cutoff,),
            )
            rows = await cursor.fetchall()

        self._model_scores = {}
        # Compute composite score
        for row in rows:
            task = row["task_type"]
            model = row["model_used"]
            # Normalize: rating 1-5 → 0-1, latency (lower is better, cap at 10s)
            rating_norm = (row["avg_rating"] - 1) / 4.0
            latency_norm = 1.0 - min(row["avg_latency"] / 10000, 1.0)
            conf = row["avg_confidence"]
            score = 0.6 * rating_norm + 0.2 * latency_norm + 0.2 * conf

            if task not in self._model_scores:
                self._model_scores[task] = {}
            self._model_scores[task][model] = round(score, 4)

        self._scores_stale = False
        logger.debug(f"Refreshed learned router scores: {len(rows)} model-task pairs")

    async def get_stats(self) -> Dict[str, Any]:
        """Get learning statistics."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM routing_outcomes"
            )
            total = (await cursor.fetchone())[0]
            cursor = await db.execute(
                "SELECT COUNT(*) FROM routing_outcomes WHERE user_rating IS NOT NULL"
            )
            rated = (await cursor.fetchone())[0]
        return {
            "total_outcomes": total,
            "rated_outcomes": rated,
            "model_scores": self._model_scores,
        }
