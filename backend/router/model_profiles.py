"""
Model profiles and discovery system.
Auto-detects available models from Ollama and generates profiles.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum
import re
import json
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class ModelType(str, Enum):
    """Model capability types."""
    FAST = "fast"           # Quick responses, simple queries
    GENERAL = "general"     # Balanced, general purpose
    REASONING = "reasoning" # Complex analysis, step-by-step thinking
    CODING = "coding"       # Programming, debugging
    VISION = "vision"       # Image analysis
    CREATIVE = "creative"   # Writing, ideation
    EMBEDDING = "embedding" # Text embeddings (not for chat)


@dataclass
class ModelProfile:
    """Profile describing a model's capabilities and configuration."""
    name: str
    model_type: ModelType
    display_name: str
    description: str
    context_window: int
    strengths: List[str]
    weaknesses: List[str]
    estimated_tokens_per_sec: int
    estimated_vram_gb: float
    system_prompt: str
    priority: int = 50  # Higher = preferred when multiple models match
    is_available: bool = True
    supports_vision: bool = False
    supports_tools: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = asdict(self)
        data["model_type"] = self.model_type.value
        return data


# Default system prompts by model type
DEFAULT_SYSTEM_PROMPTS = {
    ModelType.FAST: (
        "You are a helpful, concise assistant. Provide direct, clear answers. "
        "Be friendly but efficient. If a question is simple, give a simple answer."
    ),
    ModelType.GENERAL: (
        "You are a knowledgeable and helpful assistant. Provide thoughtful, "
        "well-structured responses. Balance depth with clarity. "
        "Ask for clarification if the request is ambiguous."
    ),
    ModelType.REASONING: (
        "You are an analytical assistant specialized in complex reasoning. "
        "Think step by step. Break down problems into components. "
        "Consider multiple perspectives. Show your reasoning process. "
        "Be thorough but organized in your analysis."
    ),
    ModelType.CODING: (
        "You are an expert programmer and software engineer. "
        "Write clean, well-documented, production-quality code. "
        "Explain your implementation choices. Consider edge cases. "
        "Follow best practices and modern patterns. "
        "If debugging, systematically identify the root cause."
    ),
    ModelType.VISION: (
        "You are a visual analysis assistant. Describe images in detail. "
        "Identify objects, text, colors, composition, and context. "
        "Be specific and accurate in your observations."
    ),
    ModelType.CREATIVE: (
        "You are a creative writing assistant with a vivid imagination. "
        "Be original and engaging. Use varied sentence structures. "
        "Adapt your style to the request. Show, don't just tell."
    ),
}


# Patterns to infer model type from name
MODEL_TYPE_PATTERNS = {
    ModelType.CODING: [
        r"coder", r"code", r"codestral", r"starcoder", r"codellama",
        r"deepseek-coder", r"wizard-coder", r"phind"
    ],
    ModelType.REASONING: [
        r"deepseek-r1", r"reasoning", r"think", r"math", r"wizard-math",
        r"orca", r"platypus"
    ],
    ModelType.VISION: [
        r"llava", r"vision", r"bakllava", r"moondream", r"cogvlm",
        r"minicpm-v", r"llama.*vision"
    ],
    ModelType.CREATIVE: [
        r"creative", r"writer", r"story", r"novel"
    ],
    ModelType.EMBEDDING: [
        r"embed", r"nomic-embed", r"bge-", r"e5-", r"gte-"
    ],
    ModelType.FAST: [
        r":1b", r":2b", r":3b", r":4b", r"tiny", r"mini", r"small"
    ],
}


# Known model defaults (for common models)
KNOWN_MODEL_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "qwen3:4b": {
        "model_type": ModelType.FAST,
        "display_name": "Qwen3 4B",
        "description": "Fast, efficient model for simple queries",
        "context_window": 32768,
        "strengths": ["speed", "efficiency", "simple_queries"],
        "weaknesses": ["complex_reasoning", "long_context"],
        "estimated_tokens_per_sec": 50,
        "estimated_vram_gb": 3.5,
        "priority": 40,
    },
    "qwen3:8b": {
        "model_type": ModelType.GENERAL,
        "display_name": "Qwen3 8B",
        "description": "Balanced model for general conversation",
        "context_window": 32768,
        "strengths": ["balanced", "general_purpose", "coherent"],
        "weaknesses": ["very_complex_tasks"],
        "estimated_tokens_per_sec": 35,
        "estimated_vram_gb": 6,
        "priority": 60,
    },
    "deepseek-r1:8b": {
        "model_type": ModelType.REASONING,
        "display_name": "DeepSeek R1 8B",
        "description": "Advanced reasoning and analysis model",
        "context_window": 16384,
        "strengths": ["reasoning", "analysis", "step_by_step", "complex_tasks"],
        "weaknesses": ["speed"],
        "estimated_tokens_per_sec": 25,
        "estimated_vram_gb": 6,
        "priority": 70,
    },
    "qwen2.5-coder:7b": {
        "model_type": ModelType.CODING,
        "display_name": "Qwen 2.5 Coder 7B",
        "description": "Specialized coding and programming model",
        "context_window": 32768,
        "strengths": ["coding", "debugging", "code_review", "programming"],
        "weaknesses": ["general_chat"],
        "estimated_tokens_per_sec": 35,
        "estimated_vram_gb": 5.5,
        "priority": 80,
    },
    "llava:7b": {
        "model_type": ModelType.VISION,
        "display_name": "LLaVA 7B",
        "description": "Vision model for image analysis",
        "context_window": 4096,
        "strengths": ["vision", "image_analysis", "visual_qa"],
        "weaknesses": ["text_only_tasks"],
        "estimated_tokens_per_sec": 25,
        "estimated_vram_gb": 5.5,
        "priority": 90,
        "supports_vision": True,
    },
    "nomic-embed-text": {
        "model_type": ModelType.EMBEDDING,
        "display_name": "Nomic Embed Text",
        "description": "Text embedding model for RAG",
        "context_window": 8192,
        "strengths": ["embeddings", "semantic_search"],
        "weaknesses": ["not_for_chat"],
        "estimated_tokens_per_sec": 100,
        "estimated_vram_gb": 0.5,
        "priority": 0,
    },
}


def infer_model_type(model_name: str) -> ModelType:
    """Infer model type from its name."""
    name_lower = model_name.lower()
    
    # Check patterns in priority order
    for model_type, patterns in MODEL_TYPE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, name_lower):
                return model_type
    
    # Default based on size (if detectable)
    size_match = re.search(r":(\d+)b", name_lower)
    if size_match:
        size = int(size_match.group(1))
        if size <= 4:
            return ModelType.FAST
        elif size <= 8:
            return ModelType.GENERAL
        else:
            return ModelType.REASONING
    
    return ModelType.GENERAL


def estimate_context_window(model_name: str, model_details: Optional[Dict] = None) -> int:
    """Estimate context window from model name or details."""
    # Check if Ollama provided context length
    if model_details:
        params = model_details.get("parameters", {})
        if isinstance(params, dict) and "num_ctx" in params:
            return int(params["num_ctx"])
    
    # Heuristics based on model family
    name_lower = model_name.lower()
    
    if "qwen" in name_lower:
        return 32768
    elif "llama" in name_lower or "mistral" in name_lower:
        return 8192
    elif "deepseek" in name_lower:
        return 16384
    elif "phi" in name_lower:
        return 4096
    
    return 4096  # Safe default


def estimate_vram(model_name: str) -> float:
    """Estimate VRAM usage in GB from model name."""
    size_match = re.search(r":?(\d+\.?\d*)b", model_name.lower())
    if size_match:
        size = float(size_match.group(1))
        # Rough estimate: ~1GB per billion parameters for quantized models
        return round(size * 0.8 + 1, 1)
    return 4.0  # Default


def estimate_speed(model_name: str) -> int:
    """Estimate tokens per second from model name."""
    size_match = re.search(r":?(\d+\.?\d*)b", model_name.lower())
    if size_match:
        size = float(size_match.group(1))
        # Smaller = faster (very rough)
        if size <= 3:
            return 60
        elif size <= 7:
            return 40
        elif size <= 14:
            return 25
        else:
            return 15
    return 30  # Default


def create_profile_from_name(
    model_name: str,
    model_details: Optional[Dict] = None
) -> ModelProfile:
    """Create a model profile by inferring from its name."""
    
    # Check known defaults first
    if model_name in KNOWN_MODEL_DEFAULTS:
        defaults = KNOWN_MODEL_DEFAULTS[model_name]
        model_type = defaults["model_type"]
        return ModelProfile(
            name=model_name,
            model_type=model_type,
            display_name=defaults.get("display_name", model_name),
            description=defaults.get("description", f"{model_type.value.title()} model"),
            context_window=defaults.get("context_window", 4096),
            strengths=defaults.get("strengths", [model_type.value]),
            weaknesses=defaults.get("weaknesses", []),
            estimated_tokens_per_sec=defaults.get("estimated_tokens_per_sec", 30),
            estimated_vram_gb=defaults.get("estimated_vram_gb", 4.0),
            system_prompt=DEFAULT_SYSTEM_PROMPTS.get(model_type, ""),
            priority=defaults.get("priority", 50),
            supports_vision=defaults.get("supports_vision", False),
            supports_tools=defaults.get("supports_tools", False),
        )
    
    # Infer from name
    model_type = infer_model_type(model_name)
    
    # Generate display name
    display_name = model_name.replace(":", " ").replace("-", " ").title()
    
    return ModelProfile(
        name=model_name,
        model_type=model_type,
        display_name=display_name,
        description=f"Auto-detected {model_type.value} model",
        context_window=estimate_context_window(model_name, model_details),
        strengths=[model_type.value],
        weaknesses=[],
        estimated_tokens_per_sec=estimate_speed(model_name),
        estimated_vram_gb=estimate_vram(model_name),
        system_prompt=DEFAULT_SYSTEM_PROMPTS.get(model_type, DEFAULT_SYSTEM_PROMPTS[ModelType.GENERAL]),
        priority=50,
        supports_vision="llava" in model_name.lower() or "vision" in model_name.lower(),
    )


class ModelRegistry:
    """Registry of available models with their profiles."""
    
    def __init__(self, custom_profiles_path: Optional[Path] = None):
        self.profiles: Dict[str, ModelProfile] = {}
        self.custom_profiles_path = custom_profiles_path
        self._load_custom_profiles()
    
    def _load_custom_profiles(self):
        """Load custom profile overrides from JSON file."""
        if self.custom_profiles_path and self.custom_profiles_path.exists():
            try:
                with open(self.custom_profiles_path) as f:
                    custom = json.load(f)
                    for name, data in custom.items():
                        if "model_type" in data:
                            data["model_type"] = ModelType(data["model_type"])
                        self.profiles[name] = ModelProfile(name=name, **data)
                logger.info(f"Loaded {len(custom)} custom model profiles")
            except Exception as e:
                logger.warning(f"Failed to load custom profiles: {e}")
    
    def save_custom_profiles(self):
        """Save current profiles to JSON file."""
        if self.custom_profiles_path:
            try:
                self.custom_profiles_path.parent.mkdir(parents=True, exist_ok=True)
                data = {name: profile.to_dict() for name, profile in self.profiles.items()}
                with open(self.custom_profiles_path, "w") as f:
                    json.dump(data, f, indent=2)
                logger.info(f"Saved {len(data)} model profiles")
            except Exception as e:
                logger.warning(f"Failed to save profiles: {e}")
    
    def discover_from_ollama(self, ollama_client) -> List[str]:
        """Discover available models from Ollama and create profiles."""
        try:
            response = ollama_client.list()
            # Handle both ListResponse object and dict
            if hasattr(response, 'models'):
                models_list = response.models
            elif isinstance(response, dict):
                models_list = response.get("models", [])
            else:
                models_list = list(response) if response else []
            
            discovered = []
            
            for model_info in models_list:
                # Handle both Model object and dict
                if hasattr(model_info, 'model'):
                    name = model_info.model
                    model_details = model_info.details if hasattr(model_info, 'details') else None
                elif isinstance(model_info, dict):
                    name = model_info.get("name", "")
                    model_details = model_info.get("details")
                else:
                    continue
                
                if not name:
                    continue
                
                # Skip if already have custom profile
                if name not in self.profiles:
                    profile = create_profile_from_name(name, model_details)
                    self.profiles[name] = profile
                    discovered.append(name)
                else:
                    # Update availability
                    self.profiles[name].is_available = True
                
                logger.debug(f"Discovered model: {name} -> {self.profiles[name].model_type.value}")
            
            logger.info(f"Discovered {len(discovered)} new models from Ollama")
            return discovered
            
        except Exception as e:
            logger.error(f"Failed to discover models from Ollama: {e}", exc_info=True)
            return []
    
    def get_profile(self, model_name: str) -> Optional[ModelProfile]:
        """Get profile for a model."""
        return self.profiles.get(model_name)
    
    def get_all_profiles(self) -> Dict[str, ModelProfile]:
        """Get all model profiles."""
        return self.profiles.copy()
    
    def get_models_by_type(self, model_type: ModelType) -> List[ModelProfile]:
        """Get all models of a specific type."""
        return [
            p for p in self.profiles.values()
            if p.model_type == model_type and p.is_available
        ]
    
    def get_best_model_for_type(self, model_type: ModelType) -> Optional[str]:
        """Get the best available model for a given type."""
        candidates = self.get_models_by_type(model_type)
        if not candidates:
            # Fallback to general models
            candidates = self.get_models_by_type(ModelType.GENERAL)
        
        if candidates:
            # Sort by priority (higher = better)
            candidates.sort(key=lambda p: p.priority, reverse=True)
            return candidates[0].name
        
        return None
    
    def get_routing_model(self) -> Optional[str]:
        """Get the fastest model for routing decisions."""
        # Prefer fast models, then general
        fast_models = self.get_models_by_type(ModelType.FAST)
        if fast_models:
            fast_models.sort(key=lambda p: p.estimated_tokens_per_sec, reverse=True)
            return fast_models[0].name
        
        # Fallback to smallest general model
        general = self.get_models_by_type(ModelType.GENERAL)
        if general:
            general.sort(key=lambda p: p.estimated_vram_gb)
            return general[0].name
        
        # Last resort: any available model
        available = [p for p in self.profiles.values() if p.is_available and p.model_type != ModelType.EMBEDDING]
        if available:
            return available[0].name
        
        return None
    
    def get_chat_models(self) -> List[ModelProfile]:
        """Get all models suitable for chat (excludes embedding models)."""
        return [
            p for p in self.profiles.values()
            if p.is_available and p.model_type != ModelType.EMBEDDING
        ]
    
    def get_profiles_summary(self) -> str:
        """Get a text summary of available models for the LLM router."""
        lines = []
        for profile in self.get_chat_models():
            strengths = ", ".join(profile.strengths[:3])
            lines.append(
                f"- {profile.name}: {profile.model_type.value} model. "
                f"Strengths: {strengths}. Speed: ~{profile.estimated_tokens_per_sec} tok/s"
            )
        return "\n".join(lines)

