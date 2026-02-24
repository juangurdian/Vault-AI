"""SQLite-based conversation persistence."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")


class ConversationStore:
    """Async SQLite store for conversations and messages."""

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False

    async def _ensure_tables(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL DEFAULT 'New chat',
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    thinking TEXT,
                    image_url TEXT,
                    created_at INTEGER NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                )
            """)
            await db.execute(
                "CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at)"
            )
            await db.commit()
        self._initialized = True

    async def list_conversations(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_conversation(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            )
            row = await cursor.fetchone()
            if not row:
                return None
            conv = dict(row)

            cursor = await db.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at",
                (conversation_id,),
            )
            messages = [dict(r) for r in await cursor.fetchall()]
            conv["messages"] = messages
            return conv

    async def create_conversation(self, conv_id: str, title: str, created_at: int) -> Dict[str, Any]:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (conv_id, title, created_at, created_at),
            )
            await db.commit()
        return {"id": conv_id, "title": title, "created_at": created_at, "updated_at": created_at}

    async def update_conversation(self, conv_id: str, title: Optional[str] = None, updated_at: Optional[int] = None) -> bool:
        await self._ensure_tables()
        updates = []
        params = []
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if updated_at is not None:
            updates.append("updated_at = ?")
            params.append(updated_at)
        if not updates:
            return False
        params.append(conv_id)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                f"UPDATE conversations SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            await db.commit()
        return True

    async def delete_conversation(self, conv_id: str) -> bool:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM messages WHERE conversation_id = ?", (conv_id,))
            cursor = await db.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
            await db.commit()
            return cursor.rowcount > 0

    async def add_message(
        self,
        msg_id: str,
        conversation_id: str,
        role: str,
        content: str,
        created_at: int,
        thinking: Optional[str] = None,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        await self._ensure_tables()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT OR REPLACE INTO messages
                   (id, conversation_id, role, content, thinking, image_url, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (msg_id, conversation_id, role, content, thinking, image_url, created_at),
            )
            await db.execute(
                "UPDATE conversations SET updated_at = ? WHERE id = ?",
                (created_at, conversation_id),
            )
            await db.commit()
        return {
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "thinking": thinking,
            "image_url": image_url,
            "created_at": created_at,
        }
