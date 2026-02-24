"""Image generation and vision analysis API routes."""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import logging

from ..image_gen.comfyui_client import ComfyUIClient, ImageGenRequest
from ..image_gen.vision import VisionAnalyzer
from ..config import get_settings

router = APIRouter(prefix="/image", tags=["image"])
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "ugly, blurry, low quality, deformed"
    width: int = 512
    height: int = 512
    steps: int = 20
    cfg: float = 7.0
    seed: int = -1


class VisionRequest(BaseModel):
    image_base64: str
    prompt: str = "What is in this image? Describe in detail."


def _get_comfyui_client() -> ComfyUIClient:
    settings = get_settings()
    return ComfyUIClient(base_url=settings.comfyui_base_url)


@router.get("/status")
async def image_status():
    """Check ComfyUI availability and return setup instructions if offline."""
    client = _get_comfyui_client()
    available = client.is_available()
    settings = get_settings()
    result = {
        "comfyui_available": available,
        "comfyui_url": settings.comfyui_base_url,
        "vision_model": VisionAnalyzer(ollama_base_url=settings.ollama_base_url).model,
    }
    if available:
        result["message"] = "ComfyUI ready for image generation"
    else:
        result["message"] = "ComfyUI is not running"
        result["setup_instructions"] = [
            "1. Install ComfyUI: git clone https://github.com/comfyanonymous/ComfyUI",
            "2. Install requirements: pip install -r requirements.txt",
            "3. Download a model checkpoint to ComfyUI/models/checkpoints/",
            "4. Start ComfyUI: python main.py --listen",
            f"5. Verify it's running at {settings.comfyui_base_url}",
            "6. Update the ComfyUI URL in Settings if using a different port",
        ]
    return result


@router.post("/generate")
async def generate_image(body: GenerateRequest):
    """Generate image via ComfyUI."""
    client = _get_comfyui_client()
    result = await client.generate(ImageGenRequest(
        prompt=body.prompt,
        negative_prompt=body.negative_prompt,
        width=body.width,
        height=body.height,
        steps=body.steps,
        cfg=body.cfg,
        seed=body.seed,
    ))

    if not result.success:
        raise HTTPException(status_code=503, detail=result.error)

    return {
        "success": True,
        "images": result.images,
        "prompt_id": result.prompt_id,
        "count": len(result.images),
    }


@router.post("/analyze")
async def analyze_image(body: VisionRequest):
    """Analyze image with vision model."""
    settings = get_settings()
    analyzer = VisionAnalyzer(ollama_base_url=settings.ollama_base_url)
    result = await analyzer.analyze_async(body.image_base64, body.prompt)
    return {"analysis": result, "model": analyzer.model}


@router.post("/analyze/upload")
async def analyze_image_upload(
    file: UploadFile = File(...),
    prompt: str = "What is in this image? Describe in detail.",
):
    """Analyze uploaded image with vision model."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    settings = get_settings()
    analyzer = VisionAnalyzer(ollama_base_url=settings.ollama_base_url)

    image_data = await file.read()
    result = await analyzer.analyze_async(image_data, prompt)
    return {"analysis": result, "model": analyzer.model, "filename": file.filename}
