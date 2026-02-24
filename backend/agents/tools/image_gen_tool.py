"""Image generation tool -- wraps ComfyUI client as a BaseTool."""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base_tool import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class ImageGenerateTool(BaseTool):
    name = "image_generate"
    description = "Generate an image from a text description using the local ComfyUI Stable Diffusion pipeline."
    parameters = {
        "type": "object",
        "properties": {
            "prompt": {"type": "string", "description": "Text description of the image to generate"},
            "negative_prompt": {
                "type": "string",
                "default": "ugly, blurry, low quality, deformed",
                "description": "What to avoid in the image",
            },
            "width": {"type": "integer", "default": 512, "description": "Image width in pixels"},
            "height": {"type": "integer", "default": 512, "description": "Image height in pixels"},
        },
        "required": ["prompt"],
    }
    when_to_use = (
        "When the user explicitly asks you to generate, create, or draw an image. "
        "Do NOT use this for image analysis -- use image_analyze for that."
    )
    when_not_to_use = (
        "When the user asks to describe or analyze an image (use image_analyze). "
        "When the user is not asking for image creation at all."
    )
    examples = [
        '<tool_call>{"name": "image_generate", "args": {"prompt": "a futuristic city at sunset, cyberpunk style"}}</tool_call>',
    ]

    async def execute(self, **kwargs) -> ToolResult:
        prompt = kwargs.get("prompt", "")
        if not prompt:
            return ToolResult(success=False, result_text="No prompt provided")

        try:
            from ...image_gen.comfyui_client import ComfyUIClient, ImageGenRequest
            from ...config import get_settings

            settings = get_settings()
            client = ComfyUIClient(base_url=settings.comfyui_base_url)

            if not client.is_available():
                return ToolResult(
                    success=False,
                    result_text=(
                        "ComfyUI is not running. Image generation requires ComfyUI to be started. "
                        "Please start ComfyUI and try again."
                    ),
                )

            request = ImageGenRequest(
                prompt=prompt,
                negative_prompt=kwargs.get("negative_prompt", "ugly, blurry, low quality, deformed"),
                width=int(kwargs.get("width", 512)),
                height=int(kwargs.get("height", 512)),
            )

            result = await client.generate(request)

            if not result.success:
                return ToolResult(success=False, result_text=f"Image generation failed: {result.error}")

            img_markdowns = [
                f"![Generated image](data:image/png;base64,{b64})"
                for b64 in result.images
            ]

            return ToolResult(
                success=True,
                result_text="\n\n".join(img_markdowns) if img_markdowns else "No images returned.",
                data={"image_count": len(result.images), "prompt_id": result.prompt_id},
            )

        except ImportError as exc:
            return ToolResult(success=False, result_text=f"Image generation module not available: {exc}")
        except Exception as exc:
            logger.error("Image generation error: %s", exc, exc_info=True)
            return ToolResult(success=False, result_text=f"Image generation error: {exc}")
