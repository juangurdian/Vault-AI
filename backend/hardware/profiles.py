"""
Hardware tier profiles and model recommendations.
Automatically recommends models based on detected hardware.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from .detector import HardwareInfo

logger = logging.getLogger(__name__)


class HardwareTier(str, Enum):
    """Hardware capability tiers."""
    MINIMAL = "minimal"      # <=4GB VRAM or CPU-only with <16GB RAM
    STANDARD = "standard"    # 6-8GB VRAM (RTX 3060/3070, most common)
    PERFORMANCE = "performance"  # 12-16GB VRAM (RTX 3090, 4070 Ti)
    ULTRA = "ultra"          # 24GB+ VRAM (RTX 4090, A6000, multi-GPU)


@dataclass
class ModelRecommendation:
    """A recommended model for a specific purpose."""
    model_name: str
    purpose: str  # "fast", "general", "reasoning", "coding", "vision", "embedding"
    pull_priority: int  # 1 = pull first, higher = pull later
    size_gb: float  # Approximate download size
    vram_gb: float  # Approximate VRAM usage at runtime
    description: str = ""


@dataclass
class TierProfile:
    """Configuration profile for a hardware tier."""
    tier: HardwareTier
    description: str
    max_model_params_b: float  # Maximum recommended parameter count in billions
    concurrent_models: int  # How many models can run simultaneously
    recommended_quantization: str  # e.g., "Q4_K_M", "Q8_0", "FP16"
    models: List[ModelRecommendation] = field(default_factory=list)


# Tier definitions with model recommendations
TIER_PROFILES: Dict[HardwareTier, TierProfile] = {
    HardwareTier.MINIMAL: TierProfile(
        tier=HardwareTier.MINIMAL,
        description="CPU-only or low VRAM (<6GB). Small, fast models only.",
        max_model_params_b=4,
        concurrent_models=1,
        recommended_quantization="Q4_K_M",
        models=[
            ModelRecommendation("qwen3:1.7b", "fast", 1, 1.2, 1.5, "Ultra-fast for simple queries"),
            ModelRecommendation("qwen3:4b", "general", 2, 2.5, 3.5, "Best quality at this tier"),
            ModelRecommendation("deepseek-r1:1.5b", "reasoning", 3, 1.1, 1.5, "Basic reasoning"),
            ModelRecommendation("qwen2.5-coder:3b", "coding", 4, 2.0, 2.5, "Lightweight coding"),
            ModelRecommendation("moondream:1.8b", "vision", 5, 1.0, 1.5, "Lightweight vision"),
            ModelRecommendation("nomic-embed-text", "embedding", 1, 0.3, 0.5, "Text embeddings for RAG"),
        ],
    ),
    HardwareTier.STANDARD: TierProfile(
        tier=HardwareTier.STANDARD,
        description="6-8GB VRAM (RTX 3060/3070). Sweet spot for 7-8B models.",
        max_model_params_b=8,
        concurrent_models=1,
        recommended_quantization="Q4_K_M",
        models=[
            ModelRecommendation("qwen3:4b", "fast", 1, 2.5, 3.5, "Fast responses"),
            ModelRecommendation("qwen3:8b", "general", 2, 5.0, 6.0, "Balanced general purpose"),
            ModelRecommendation("deepseek-r1:8b", "reasoning", 3, 5.0, 6.0, "Strong reasoning"),
            ModelRecommendation("qwen2.5-coder:7b", "coding", 4, 4.5, 5.5, "Excellent code generation"),
            ModelRecommendation("llava:7b", "vision", 5, 4.5, 5.5, "Image analysis"),
            ModelRecommendation("nomic-embed-text", "embedding", 1, 0.3, 0.5, "Text embeddings"),
        ],
    ),
    HardwareTier.PERFORMANCE: TierProfile(
        tier=HardwareTier.PERFORMANCE,
        description="12-16GB VRAM (RTX 3090, 4070 Ti). Can run 14B models.",
        max_model_params_b=14,
        concurrent_models=1,
        recommended_quantization="Q5_K_M",
        models=[
            ModelRecommendation("qwen3:4b", "fast", 1, 2.5, 3.5, "Fast responses"),
            ModelRecommendation("qwen3:8b", "general", 2, 5.0, 6.0, "General purpose"),
            ModelRecommendation("deepseek-r1:14b", "reasoning", 3, 9.0, 10.0, "Strong reasoning at 14B"),
            ModelRecommendation("qwen2.5-coder:14b", "coding", 4, 9.0, 10.0, "Superior code generation"),
            ModelRecommendation("llava:13b", "vision", 5, 8.5, 10.0, "High-quality vision"),
            ModelRecommendation("gemma3:12b", "creative", 6, 7.5, 9.0, "Creative writing"),
            ModelRecommendation("nomic-embed-text", "embedding", 1, 0.3, 0.5, "Text embeddings"),
        ],
    ),
    HardwareTier.ULTRA: TierProfile(
        tier=HardwareTier.ULTRA,
        description="24GB+ VRAM (RTX 4090, A6000). Can run 32B+ models.",
        max_model_params_b=72,
        concurrent_models=2,
        recommended_quantization="Q6_K",
        models=[
            ModelRecommendation("qwen3:8b", "fast", 1, 5.0, 6.0, "Fast for quick tasks"),
            ModelRecommendation("qwen3:32b", "general", 2, 20.0, 22.0, "High-quality general purpose"),
            ModelRecommendation("deepseek-r1:32b", "reasoning", 3, 20.0, 22.0, "Exceptional reasoning"),
            ModelRecommendation("qwen2.5-coder:32b", "coding", 4, 20.0, 22.0, "Top-tier coding"),
            ModelRecommendation("llava:34b", "vision", 5, 22.0, 24.0, "Best local vision"),
            ModelRecommendation("gemma3:27b", "creative", 6, 17.0, 19.0, "Excellent creative writing"),
            ModelRecommendation("nomic-embed-text", "embedding", 1, 0.3, 0.5, "Text embeddings"),
        ],
    ),
}


def get_tier(hw: HardwareInfo) -> HardwareTier:
    """Determine hardware tier from detected hardware."""
    if hw.has_gpu:
        vram = hw.total_vram_gb
        if vram >= 20:
            return HardwareTier.ULTRA
        elif vram >= 10:
            return HardwareTier.PERFORMANCE
        elif vram >= 5:
            return HardwareTier.STANDARD
        else:
            return HardwareTier.MINIMAL
    else:
        # CPU-only: use RAM as proxy
        ram = hw.ram_total_gb
        if ram >= 64:
            return HardwareTier.PERFORMANCE
        elif ram >= 32:
            return HardwareTier.STANDARD
        else:
            return HardwareTier.MINIMAL


def get_recommended_models(hw: HardwareInfo) -> Dict[str, Any]:
    """Get model recommendations for the detected hardware."""
    tier = get_tier(hw)
    profile = TIER_PROFILES[tier]

    return {
        "tier": tier.value,
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


def get_tier_profile(tier: HardwareTier) -> TierProfile:
    """Get the full profile for a tier."""
    return TIER_PROFILES[tier]
