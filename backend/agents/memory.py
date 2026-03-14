"""
Agent memory system for persistent learning.
Supports short-term (conversation), working (task), long-term (facts), and episodic (past interactions).
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import aiosqlite
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")


@dataclass
class MemoryEntry:
    """A single memory entry."""
    key: str
    value: str
    category: str  # "fact", "preference", "learned", "episodic"
    confidence: float = 1.0
    access_count: int = 0
    created_at: int = 0
    updated_at: int = 0


class AgentMemory:
    """
    Persistent memory system for agents.
    Stores facts, preferences, and learned patterns in SQLite.
    """

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False

    async def _ensure_tables(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS agent_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'fact',
                    confidence REAL NOT NULL DEFAULT 1.0,
                    access_count INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_memory_cat ON agent_memory(category)"
            )
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_memory_key ON agent_memory(key)"
            )
            await db.commit()
        self._initialized = True

    async def store(
        self,
        key: str,
        value: str,
        category: str = "fact",
        confidence: float = 1.0,
    ) -> None:
        """Store or update a memory entry."""
        await self._ensure_tables()
        now = int(time.time() * 1000)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO agent_memory (key, value, category, confidence, access_count, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 0, ?, ?)
                   ON CONFLICT(key) DO UPDATE SET
                       value = excluded.value,
                       category = excluded.category,
                       confidence = excluded.confidence,
                       updated_at = excluded.updated_at""",
                (key, value, category, confidence, now, now),
            )
            await db.commit()

    async def recall(self, key: str) -> Optional[str]:
        """Recall a specific memory by key."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            # Update access count
            await db.execute(
                "UPDATE agent_memory SET access_count = access_count + 1 WHERE key = ?",
                (key,),
            )
            await db.commit()
            cursor = await db.execute(
                "SELECT value FROM agent_memory WHERE key = ?", (key,)
            )
            row = await cursor.fetchone()
            return row[0] if row else None

    async def search(
        self,
        query: str,
        category: Optional[str] = None,
        limit: int = 10,
    ) -> List[MemoryEntry]:
        """Search memories by keyword match."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if category:
                cursor = await db.execute(
                    """SELECT * FROM agent_memory
                       WHERE category = ? AND (key LIKE ? OR value LIKE ?)
                       ORDER BY access_count DESC, updated_at DESC
                       LIMIT ?""",
                    (category, f"%{query}%", f"%{query}%", limit),
                )
            else:
                cursor = await db.execute(
                    """SELECT * FROM agent_memory
                       WHERE key LIKE ? OR value LIKE ?
                       ORDER BY access_count DESC, updated_at DESC
                       LIMIT ?""",
                    (f"%{query}%", f"%{query}%", limit),
                )
            rows = await cursor.fetchall()
            return [
                MemoryEntry(
                    key=r["key"],
                    value=r["value"],
                    category=r["category"],
                    confidence=r["confidence"],
                    access_count=r["access_count"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                for r in rows
            ]

    async def get_by_category(
        self,
        category: str,
        limit: int = 50,
    ) -> List[MemoryEntry]:
        """Get all memories in a category."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT * FROM agent_memory
                   WHERE category = ?
                   ORDER BY access_count DESC, updated_at DESC
                   LIMIT ?""",
                (category, limit),
            )
            rows = await cursor.fetchall()
            return [
                MemoryEntry(
                    key=r["key"],
                    value=r["value"],
                    category=r["category"],
                    confidence=r["confidence"],
                    access_count=r["access_count"],
                    created_at=r["created_at"],
                    updated_at=r["updated_at"],
                )
                for r in rows
            ]

    async def forget(self, key: str) -> bool:
        """Remove a memory entry."""
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "DELETE FROM agent_memory WHERE key = ?", (key,)
            )
            await db.commit()
            return cursor.rowcount > 0

    async def get_context_prompt(self, max_entries: int = 20) -> str:
        """
        Generate a context prompt from the most relevant memories.
        Used to inject memory into agent system prompts.
        """
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """SELECT key, value, category FROM agent_memory
                   ORDER BY access_count DESC, confidence DESC
                   LIMIT ?""",
                (max_entries,),
            )
            rows = await cursor.fetchall()

        if not rows:
            return ""

        lines = ["Known facts and preferences about the user:"]
        for r in rows:
            lines.append(f"- [{r['category']}] {r['key']}: {r['value']}")

        return "\n".join(lines)
