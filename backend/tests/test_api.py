"""Tests for the FastAPI API endpoints."""

from unittest.mock import MagicMock, patch, AsyncMock
from typing import Dict, Any

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


def _make_mock_router() -> MagicMock:
    """Build a mock ModelRouter with the methods that endpoints call."""
    router = MagicMock()
    router.get_routing_stats.return_value = {
        "cache_size": 0,
        "cache_max_size": 100,
        "models_available": 2,
        "llm_routing_enabled": False,
        "routing_timeout_ms": 500,
    }
    router.registry = MagicMock()
    router.registry.get_routing_model.return_value = "qwen3:4b"
    router.registry.get_chat_models.return_value = []
    router.get_chat_models.return_value = []
    router.get_available_models.return_value = {}
    router.model_configs = {}
    router.refresh_models.return_value = []
    return router


def _make_mock_vector_store() -> MagicMock:
    """Build a mock VectorStore."""
    vs = MagicMock()
    vs.get_stats.return_value = {
        "collection_name": "knowledge_base",
        "document_count": 0,
        "bm25_index_size": 0,
        "embedding_model": "nomic-embed-text",
    }
    vs.get_count.return_value = 0
    vs.ready = True
    return vs


def _make_mock_tool_registry() -> MagicMock:
    """Build a mock ToolRegistry."""
    reg = MagicMock()
    reg.list_tools.return_value = []
    reg.tool_names.return_value = []
    return reg


_mock_router = _make_mock_router()
_mock_vs = _make_mock_vector_store()
_mock_tool_reg = _make_mock_tool_registry()


@pytest_asyncio.fixture
async def client():
    """Async HTTP client wired to the FastAPI app with dependency overrides."""
    from backend.deps import get_model_router, get_vector_store, get_tool_registry
    from backend.main import app

    # Use FastAPI's dependency override mechanism so Depends() resolves correctly
    app.dependency_overrides[get_model_router] = lambda: _mock_router
    app.dependency_overrides[get_vector_store] = lambda: _mock_vs
    app.dependency_overrides[get_tool_registry] = lambda: _mock_tool_reg

    # Also patch the direct calls in main.py (health endpoint calls get_model_router directly)
    with (
        patch("backend.main.get_model_router", return_value=_mock_router),
        patch("backend.main.get_tool_registry", return_value=_mock_tool_reg),
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
            yield ac

    app.dependency_overrides.clear()


# ── Tests ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """GET /health should return status=healthy."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "models_available" in data


@pytest.mark.asyncio
async def test_models_endpoint(client: AsyncClient):
    """GET /api/models should return a models list."""
    resp = await client.get("/api/models")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert "total_available" in data


@pytest.mark.asyncio
async def test_setup_status(client: AsyncClient):
    """GET /api/setup/status should return setup status fields."""
    resp = await client.get("/api/setup/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "setup_completed" in data
    assert "models_available" in data


@pytest.mark.asyncio
async def test_setup_hardware(client: AsyncClient):
    """GET /api/setup/hardware should return hardware detection info."""
    fake_hw = MagicMock()
    fake_hw.cpu_name = "Test CPU"
    fake_hw.cpu_cores = 8
    fake_hw.ram_total_gb = 32.0
    fake_hw.ram_available_gb = 16.0
    fake_hw.has_gpu = False
    fake_hw.gpus = []
    fake_hw.total_vram_gb = 0.0

    from backend.hardware.profiles import HardwareTier

    with (
        patch("backend.api.setup.detect_hardware", return_value=fake_hw),
        patch("backend.api.setup.get_tier", return_value=HardwareTier.STANDARD),
    ):
        resp = await client.get("/api/setup/hardware")

    assert resp.status_code == 200
    data = resp.json()
    assert data["cpu_name"] == "Test CPU"
    assert data["cpu_cores"] == 8
    assert "tier" in data


@pytest.mark.asyncio
async def test_rag_stats(client: AsyncClient):
    """GET /api/rag/stats should return vector store statistics."""
    resp = await client.get("/api/rag/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "document_count" in data
    assert "bm25_index_size" in data


@pytest.mark.asyncio
async def test_chat_endpoint_validation(client: AsyncClient):
    """POST /api/chat with an invalid body should return 422."""
    # Missing required 'messages' field
    resp = await client.post("/api/chat", json={})
    assert resp.status_code == 422

    # Empty messages list should return 400
    resp2 = await client.post("/api/chat", json={"messages": []})
    # FastAPI may return 400 (from the handler) or 422 depending on validation
    assert resp2.status_code in (400, 422)
