"""ComfyUI HTTP client for image generation."""

from __future__ import annotations
import json
import uuid
import asyncio
import logging
import urllib.request
import urllib.parse
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

COMFY_URL = "http://127.0.0.1:8188"

# Simple text-to-image workflow for SDXL/FLUX
DEFAULT_WORKFLOW = {
    "3": {
        "inputs": {"seed": 0, "steps": 20, "cfg": 7, "sampler_name": "euler",
                   "scheduler": "normal", "denoise": 1, "model": ["4", 0],
                   "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]},
        "class_type": "KSampler"
    },
    "4": {"inputs": {"ckpt_name": "v1-5-pruned-emaonly.ckpt"}, "class_type": "CheckpointLoaderSimple"},
    "5": {"inputs": {"width": 512, "height": 512, "batch_size": 1}, "class_type": "EmptyLatentImage"},
    "6": {"inputs": {"text": "PROMPT", "clip": ["4", 1]}, "class_type": "CLIPTextEncode"},
    "7": {"inputs": {"text": "ugly, blurry, low quality", "clip": ["4", 1]}, "class_type": "CLIPTextEncode"},
    "8": {"inputs": {"samples": ["3", 0], "vae": ["4", 2]}, "class_type": "VAEDecode"},
    "9": {"inputs": {"filename_prefix": "toto", "images": ["8", 0]}, "class_type": "SaveImage"},
}


@dataclass
class ImageGenRequest:
    prompt: str
    negative_prompt: str = "ugly, blurry, low quality, deformed"
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg: float = 7.0
    seed: int = -1


@dataclass
class ImageGenResult:
    success: bool
    images: list[str] = field(default_factory=list)  # base64 encoded
    error: Optional[str] = None
    prompt_id: Optional[str] = None


class ComfyUIClient:
    """Client for ComfyUI image generation."""

    def __init__(self, base_url: str = COMFY_URL):
        self.base_url = base_url.rstrip("/")
        self.client_id = str(uuid.uuid4())

    def is_available(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.base_url}/system_stats")
            with urllib.request.urlopen(req, timeout=2) as r:
                return r.status == 200
        except Exception:
            return False

    async def generate(self, request: ImageGenRequest) -> ImageGenResult:
        """Generate image via ComfyUI API."""
        if not self.is_available():
            return ImageGenResult(
                success=False,
                error="ComfyUI is not running. Start it with: .\\start_stack.ps1 -Heavy"
            )

        try:
            import random
            workflow = json.loads(json.dumps(DEFAULT_WORKFLOW))
            seed = request.seed if request.seed >= 0 else random.randint(0, 2**32)
            workflow["3"]["inputs"]["seed"] = seed
            workflow["3"]["inputs"]["steps"] = request.steps
            workflow["3"]["inputs"]["cfg"] = request.cfg
            workflow["5"]["inputs"]["width"] = request.width
            workflow["5"]["inputs"]["height"] = request.height
            workflow["6"]["inputs"]["text"] = request.prompt
            workflow["7"]["inputs"]["text"] = request.negative_prompt

            # Queue prompt
            data = json.dumps({"prompt": workflow, "client_id": self.client_id}).encode()
            req = urllib.request.Request(
                f"{self.base_url}/prompt",
                data=data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                result = json.load(r)

            prompt_id = result.get("prompt_id")
            if not prompt_id:
                return ImageGenResult(success=False, error="No prompt_id returned")

            # Poll for completion (max 60s)
            for _ in range(60):
                await asyncio.sleep(1)
                hreq = urllib.request.Request(f"{self.base_url}/history/{prompt_id}")
                with urllib.request.urlopen(hreq, timeout=5) as r:
                    history = json.load(r)

                if prompt_id in history:
                    outputs = history[prompt_id].get("outputs", {})
                    images = []
                    for node_id, node_output in outputs.items():
                        for img in node_output.get("images", []):
                            # Fetch image as base64
                            img_url = f"{self.base_url}/view?filename={img['filename']}&subfolder={img.get('subfolder','')}&type={img.get('type','output')}"
                            with urllib.request.urlopen(img_url, timeout=10) as r:
                                import base64
                                images.append(base64.b64encode(r.read()).decode())
                    return ImageGenResult(success=True, images=images, prompt_id=prompt_id)

            return ImageGenResult(success=False, error="Timeout waiting for image generation")

        except Exception as e:
            logger.error(f"ComfyUI generation error: {e}")
            return ImageGenResult(success=False, error=str(e))
