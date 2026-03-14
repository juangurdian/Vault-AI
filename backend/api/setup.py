"""First-run setup wizard API."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import get_settings, save_settings
from ..deps import get_model_router
from ..hardware.detector import detect_hardware
from ..hardware.profiles import get_recommended_models, get_tier, HardwareTier
from ..router.router import ModelRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    setup_completed: bool
    hardware_detected: bool
    ollama_connected: bool
    models_available: int


class HardwareDetectResponse(BaseModel):
    cpu_name: str
    cpu_cores: int
    ram_total_gb: float
    ram_available_gb: float
    has_gpu: bool
    gpus: List[Dict[str, Any]]
    total_vram_gb: float
    tier: str
    tier_description: str


class ModelRecommendationsResponse(BaseModel):
    tier: str
    tier_description: str
    max_model_params_b: float
    concurrent_models: int
    recommended_quantization: str
    models: List[Dict[str, Any]]


class PullModelRequest(BaseModel):
    model_name: str


class PullModelResponse(BaseModel):
    success: bool
    model_name: str
    message: str


class CompleteSetupRequest(BaseModel):
    hardware_tier: Optional[str] = None


@router.get("/status", response_model=SetupStatusResponse)
async def setup_status(model_router: ModelRouter = Depends(get_model_router)):
    """Check whether first-run setup is needed."""
    settings = get_settings()
    stats = model_router.get_routing_stats()

    # Check Ollama connectivity
    ollama_ok = stats["models_available"] > 0

    return SetupStatusResponse(
        setup_completed=settings.setup_completed,
        hardware_detected=settings.hardware_tier != "auto" or settings.auto_detect_hardware,
        ollama_connected=ollama_ok,
        models_available=stats["models_available"],
    )


@router.get("/hardware", response_model=HardwareDetectResponse)
async def detect_hw():
    """Detect hardware capabilities and return tier recommendation."""
    hw = detect_hardware()
    tier = get_tier(hw)
    from ..hardware.profiles import TIER_PROFILES

    profile = TIER_PROFILES[tier]

    gpus = []
    for g in hw.gpus:
        gpus.append({
            "name": g.name,
            "vram_total_gb": g.vram_total_gb,
            "vram_free_gb": g.vram_free_gb,
            "vendor": g.vendor,
            "driver_version": g.driver_version,
            "cuda_version": g.cuda_version,
        })

    return HardwareDetectResponse(
        cpu_name=hw.cpu_name,
        cpu_cores=hw.cpu_cores,
        ram_total_gb=hw.ram_total_gb,
        ram_available_gb=hw.ram_available_gb,
        has_gpu=hw.has_gpu,
        gpus=gpus,
        total_vram_gb=hw.total_vram_gb,
        tier=tier.value,
        tier_description=profile.description,
    )


@router.get("/recommendations", response_model=ModelRecommendationsResponse)
async def model_recommendations(tier: Optional[str] = None):
    """Get recommended models for the detected (or specified) hardware tier."""
    if tier:
        try:
            hw_tier = HardwareTier(tier)
        except ValueError:
            hw_tier = None
    else:
        hw_tier = None

    if hw_tier is None:
        hw = detect_hardware()
        recs = get_recommended_models(hw)
    else:
        from ..hardware.profiles import TIER_PROFILES
        profile = TIER_PROFILES[hw_tier]
        recs = {
            "tier": hw_tier.value,
            "tier_description": profile.description,
            "max_model_params_b": profile.max_model_params_b,
            "concurrent_models": profile.concurrent_models,
            "recommended_quantization": profile.recommended_quantization,
            "models": [
                {
                    "name": m.model_name,
                    "purpose": m.purpose,
                    "pull_priority": m.pull_priority,
                    "size_gb": m.size_gb,
                    "vram_gb": m.vram_gb,
                    "description": m.description,
                }
                for m in profile.models
            ],
        }

    return ModelRecommendationsResponse(**recs)


@router.post("/pull-model", response_model=PullModelResponse)
async def pull_model(req: PullModelRequest):
    """Pull a model from Ollama registry."""
    import ollama as ollama_lib

    settings = get_settings()
    client = ollama_lib.Client(host=settings.ollama_base_url)

    try:
        # Trigger pull (this blocks — for production, use streaming/background)
        client.pull(req.model_name)
        return PullModelResponse(
            success=True,
            model_name=req.model_name,
            message=f"Successfully pulled {req.model_name}",
        )
    except Exception as e:
        logger.error(f"Failed to pull model {req.model_name}: {e}")
        return PullModelResponse(
            success=False,
            model_name=req.model_name,
            message=str(e),
        )


@router.post("/complete")
async def complete_setup(
    req: CompleteSetupRequest,
    model_router: ModelRouter = Depends(get_model_router),
):
    """Mark setup as complete and persist hardware tier."""
    updates = {"setup_completed": True}
    if req.hardware_tier:
        updates["hardware_tier"] = req.hardware_tier

    save_settings(updates)
    model_router.refresh_models()

    return {"success": True, "message": "Setup completed successfully"}
