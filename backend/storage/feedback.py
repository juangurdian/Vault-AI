"""SQLite-based feedback persistence."""

from __future__ import annotations

import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")


class FeedbackStore:
    """Async SQLite store for user feedback on model responses."""

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False

    async def _ensure_tables(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query TEXT NOT NULL,
                    model_used TEXT NOT NULL,
                    rating REAL NOT NULL,
                    created_at INTEGER NOT NULL
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_feedback_model ON feedback(model_used)"
            )
            await db.commit()
        self._initialized = True

    async def add_feedback(self, query: str, model_used: str, rating: float) -> int:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "INSERT INTO feedback (query, model_used, rating, created_at) VALUES (?, ?, ?, ?)",
                (query, model_used, rating, int(time.time() * 1000)),
            )
            await db.commit()
            return cursor.lastrowid or 0

    async def get_stats_by_model(self) -> List[Dict[str, Any]]:
        """Get aggregate feedback statistics per model."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT
                    model_used,
                    COUNT(*) as total_ratings,
                    ROUND(AVG(rating), 2) as avg_rating,
                    MIN(rating) as min_rating,
                    MAX(rating) as max_rating
                FROM feedback
                GROUP BY model_used
                ORDER BY avg_rating DESC
            """)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_priority_adjustments(self) -> Dict[str, float]:
        """Calculate priority adjustments based on feedback.

        Models with avg rating >= 4.0 get a boost, those <= 2.0 get penalized.
        Returns a dict of model_name -> priority_delta.
        """
        stats = await self.get_stats_by_model()
        adjustments: Dict[str, float] = {}
        for s in stats:
            if s["total_ratings"] < 3:
                continue
            avg = s["avg_rating"]
            if avg >= 4.0:
                adjustments[s["model_used"]] = (avg - 3.0) * 0.1  # up to +0.2
            elif avg <= 2.0:
                adjustments[s["model_used"]] = (avg - 3.0) * 0.1  # down to -0.3
        return adjustments
