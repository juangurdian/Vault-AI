"""Shared fixtures for backend test suite."""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio


# ---------------------------------------------------------------------------
# tmp_db_path — a fresh SQLite database for every test that needs one
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_db_path(tmp_path: Path) -> Path:
    """Return a temporary SQLite database path under tmp_path."""
    return tmp_path / "test.db"


# ---------------------------------------------------------------------------
# mock_ollama_client — a mock for ollama.Client with canned responses
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_ollama_client() -> MagicMock:
    """Return a mock ``ollama.Client`` with canned embedding / chat responses."""
    client = MagicMock()

    # Canned embedding response (768-dim zero vector with a small signal)
    def _fake_embeddings(model: str = "", prompt: str = ""):
        vec = [0.0] * 768
        # Give a tiny deterministic signal based on prompt length
        for i in range(min(len(prompt), 768)):
            vec[i] = float(ord(prompt[i % len(prompt)])) / 1000.0
        return {"embedding": vec}

    client.embeddings.side_effect = _fake_embeddings

    # Canned chat response
    client.chat.return_value = {
        "message": {"content": "This is a canned test response."},
    }

    # Canned list response (model discovery)
    client.list.return_value = {
        "models": [
            {
                "name": "qwen3:8b",
                "details": {
                    "parameter_size": "8B",
                    "family": "qwen3",
                    "quantization_level": "Q4_K_M",
                },
            },
        ],
    }

    return client


# ---------------------------------------------------------------------------
# test_settings — patched Settings pointing at temporary paths
# ---------------------------------------------------------------------------

@pytest.fixture
def test_settings(tmp_path: Path):
    """Return a patched ``Settings`` instance using temporary directories."""
    from backend.config import Settings

    settings = Settings(
        app_name="TestAI",
        api_prefix="/api",
        host="127.0.0.1",
        port=9999,
        ollama_base_url="http://localhost:11434",
        setup_completed=False,
    )
    return settings
