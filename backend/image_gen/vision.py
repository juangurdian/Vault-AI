"""Vision analysis using the best available vision model via Ollama."""

from __future__ import annotations
import base64
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def _get_vision_model(ollama_base_url: Optional[str] = None) -> str:
    """Resolve the best vision model from the global router registry, with fallback."""
    try:
        from ..deps import get_model_router
        from ..router.model_profiles import ModelType
        router = get_model_router()
        best = router.registry.get_best_model_for_type(ModelType.VISION)
        if best:
            return best
    except Exception:
        pass
    return "llava:7b"


class VisionAnalyzer:
    """Analyze images using the best available vision model."""

    def __init__(self, ollama_base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = ollama_base_url
        self.model = model or _get_vision_model(ollama_base_url)

    def analyze(self, image_data: bytes | str, prompt: str = "What is in this image? Describe in detail.") -> str:
        try:
            import ollama
            client = ollama.Client(host=self.base_url) if self.base_url else ollama.Client()

            if isinstance(image_data, bytes):
                b64 = base64.b64encode(image_data).decode()
            else:
                b64 = image_data

            response = client.chat(
                model=self.model,
                messages=[{
                    "role": "user",
                    "content": prompt,
                    "images": [b64],
                }]
            )
            return response["message"]["content"]

        except Exception as e:
            logger.error(f"Vision analysis error: {e}")
            return f"Could not analyze image: {str(e)}"

    async def analyze_async(self, image_data: bytes | str, prompt: str = "What is in this image?") -> str:
        """Async wrapper that runs sync analyze in executor."""
        import asyncio
        return await asyncio.get_event_loop().run_in_executor(
            None, self.analyze, image_data, prompt
        )
