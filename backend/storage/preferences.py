"""SQLite-based user preferences persistence."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path("data/beastai.db")

DEFAULT_PREFERENCES: Dict[str, Any] = {
    "response_style": "balanced",       # "concise" | "balanced" | "detailed"
    "code_style": "modern",             # "modern" | "classic" | "minimal"
    "preferred_language": "",            # natural language preference, e.g. "Spanish"
    "verbosity": "normal",              # "low" | "normal" | "high"
    "favorite_tools": [],               # tool names the user prefers
    "search_provider_preference": "",   # "brave" | "duckduckgo" | "perplexity" | ""
    "show_reasoning": True,             # whether to encourage thinking sections
    "custom_instructions": "",          # free-form user instructions
}


class UserPreferencesStore:
    """Async SQLite store for user preferences."""

    def __init__(self, db_path: str | Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialized = False
        self._cache: Optional[Dict[str, Any]] = None

    async def _ensure_table(self):
        if self._initialized:
            return
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            await db.commit()
        self._initialized = True

    async def get_all(self) -> Dict[str, Any]:
        """Return all preferences, merged with defaults."""
        if self._cache is not None:
            return self._cache

        await self._ensure_table()
        prefs = dict(DEFAULT_PREFERENCES)

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT key, value FROM user_preferences")
            rows = await cursor.fetchall()
            for row in rows:
                try:
                    prefs[row["key"]] = json.loads(row["value"])
                except (json.JSONDecodeError, KeyError):
                    prefs[row["key"]] = row["value"]

        self._cache = prefs
        return prefs

    async def get(self, key: str, default: Any = None) -> Any:
        """Get a single preference value."""
        prefs = await self.get_all()
        return prefs.get(key, default)

    async def set(self, key: str, value: Any) -> None:
        """Set a single preference value."""
        await self._ensure_table()
        serialized = json.dumps(value)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)",
                (key, serialized),
            )
            await db.commit()
        self._cache = None

    async def set_many(self, updates: Dict[str, Any]) -> None:
        """Set multiple preferences at once."""
        await self._ensure_table()
        async with aiosqlite.connect(self.db_path) as db:
            for key, value in updates.items():
                serialized = json.dumps(value)
                await db.execute(
                    "INSERT OR REPLACE INTO user_preferences (key, value) VALUES (?, ?)",
                    (key, serialized),
                )
            await db.commit()
        self._cache = None

    async def reset(self) -> None:
        """Reset all preferences to defaults."""
        await self._ensure_table()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM user_preferences")
            await db.commit()
        self._cache = None

    def build_personalization_prompt(self, prefs: Dict[str, Any]) -> str:
        """Convert stored preferences into a prompt section for the LLM."""
        parts: list[str] = []

        style = prefs.get("response_style", "balanced")
        if style == "concise":
            parts.append("The user prefers concise, to-the-point answers. Keep responses short.")
        elif style == "detailed":
            parts.append("The user prefers detailed, thorough answers with explanations.")

        verbosity = prefs.get("verbosity", "normal")
        if verbosity == "low":
            parts.append("Use minimal text. Bullet points over paragraphs.")
        elif verbosity == "high":
            parts.append("Be thorough and verbose. Explain concepts in depth.")

        lang = prefs.get("preferred_language", "")
        if lang:
            parts.append(f"The user prefers responses in {lang}.")

        code_style = prefs.get("code_style", "modern")
        if code_style == "minimal":
            parts.append("For code: minimal comments, concise implementations.")
        elif code_style == "classic":
            parts.append("For code: well-commented, traditional style with clear variable names.")

        fav_tools = prefs.get("favorite_tools", [])
        if fav_tools:
            parts.append(f"The user's preferred tools: {', '.join(fav_tools)}.")

        show_reasoning = prefs.get("show_reasoning", True)
        if not show_reasoning:
            parts.append("Do not use <think> tags or show reasoning steps.")

        custom = prefs.get("custom_instructions", "")
        if custom:
            parts.append(f"Custom user instructions: {custom}")

        return "\n".join(parts) if parts else ""
