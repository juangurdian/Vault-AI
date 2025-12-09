"""
Models API endpoints for discovering and managing available models.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging

from ..deps import get_model_router
from ..router.router import ModelRouter

router = APIRouter(prefix="/models", tags=["models"])
logger = logging.getLogger(__name__)


class ModelInfo(BaseModel):
    name: str
    model_type: str
    display_name: str
    description: str
    context_window: int
    strengths: List[str]
    weaknesses: List[str]
    estimated_tokens_per_sec: int
    estimated_vram_gb: float
    is_available: bool
    supports_vision: bool
    supports_tools: bool
    priority: int


class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    routing_model: Optional[str]
    total_available: int


class RefreshResponse(BaseModel):
    discovered: List[str]
    total_available: int


class RoutingStatsResponse(BaseModel):
    cache_size: int
    cache_max_size: int
    models_available: int
    llm_routing_enabled: bool
    routing_timeout_ms: int


@router.get("", response_model=ModelsResponse)
async def list_models(model_router: ModelRouter = Depends(get_model_router)):
    """List all available models with their profiles."""
    chat_models = model_router.get_chat_models()
    routing_model = model_router.registry.get_routing_model()
    
    return ModelsResponse(
        models=[ModelInfo(**m) for m in chat_models],
        routing_model=routing_model,
        total_available=len(chat_models)
    )


@router.get("/{model_name}")
async def get_model(model_name: str, model_router: ModelRouter = Depends(get_model_router)):
    """Get details for a specific model."""
    profile = model_router.registry.get_profile(model_name)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    
    return ModelInfo(**profile.to_dict())


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_models(model_router: ModelRouter = Depends(get_model_router)):
    """Refresh model list from Ollama."""
    discovered = model_router.refresh_models()
    chat_models = model_router.get_chat_models()
    
    return RefreshResponse(
        discovered=discovered,
        total_available=len(chat_models)
    )


@router.get("/routing/stats", response_model=RoutingStatsResponse)
async def get_routing_stats(model_router: ModelRouter = Depends(get_model_router)):
    """Get routing statistics."""
    stats = model_router.get_routing_stats()
    return RoutingStatsResponse(**stats)


@router.get("/types/summary")
async def get_model_types_summary(model_router: ModelRouter = Depends(get_model_router)):
    """Get a summary of models by type."""
    from ..router.model_profiles import ModelType
    
    summary = {}
    for model_type in ModelType:
        models = model_router.registry.get_models_by_type(model_type)
        if models:
            best = model_router.registry.get_best_model_for_type(model_type)
            summary[model_type.value] = {
                "count": len(models),
                "models": [m.name for m in models],
                "recommended": best
            }
    
    return summary

