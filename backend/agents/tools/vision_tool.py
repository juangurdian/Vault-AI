"""Vision analysis tool -- wraps LLaVA / vision model as a BaseTool."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class VisionAnalyzeTool(BaseTool):
    name = "image_analyze"
    description = "Analyze an image using the local vision model (LLaVA). Requires a base64-encoded image."
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "default": "What is in this image? Describe in detail.",
                "description": "Question or instruction about the image",
            },
            "image_b64": {
                "type": "string",
                "description": "Base64-encoded image data",
            },
        },
        "required": ["image_b64"],
    }
    when_to_use = (
        "When the user provides an image and asks you to analyze, describe, or "
        "answer questions about it. The image must already be attached to the message."
    )
    when_not_to_use = (
        "When there is no image attached. "
        "When the user asks to generate/create an image (use image_generate instead)."
    )
    examples = [
        '<tool_call>{"name": "image_analyze", "args": {"image_b64": "...", "prompt": "What animal is in this photo?"}}</tool_call>',
    ]

    async def execute(self, **kwargs) -> ToolResult:
        image_b64 = kwargs.get("image_b64", "")
        prompt = kwargs.get("prompt", "What is in this image? Describe in detail.")

        if not image_b64:
            return ToolResult(
                success=False,
                result_text="No image data provided. The user needs to attach an image.",
            )

        try:
            from ...image_gen.vision import VisionAnalyzer
            from ...config import get_settings

            settings = get_settings()
            analyzer = VisionAnalyzer(ollama_base_url=settings.ollama_base_url)
            analysis = await analyzer.analyze_async(image_b64, prompt)

            return ToolResult(
                success=True,
                result_text=analysis,
                data={"model": analyzer.model},
            )

        except Exception as exc:
            logger.error("Vision analysis error: %s", exc, exc_info=True)
            return ToolResult(success=False, result_text=f"Vision analysis error: {exc}")
