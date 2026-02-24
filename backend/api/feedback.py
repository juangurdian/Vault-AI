from fastapi import APIRouter, Depends
from pydantic import BaseModel
import logging

from ..router.router import ModelRouter
from ..deps import get_model_router
from ..storage.feedback import FeedbackStore

router = APIRouter()
logger = logging.getLogger(__name__)

_feedback_store = FeedbackStore()


class FeedbackRequest(BaseModel):
    query: str
    model_used: str
    rating: float


@router.post("/feedback")
async def receive_feedback(
    feedback: FeedbackRequest,
    model_router: ModelRouter = Depends(get_model_router),
):
    """Store feedback and apply priority adjustments to routing."""
    logger.info(f"Feedback: model={feedback.model_used} rating={feedback.rating}")

    await _feedback_store.add_feedback(
        query=feedback.query,
        model_used=feedback.model_used,
        rating=feedback.rating,
    )

    # Apply priority adjustments based on accumulated feedback
    adjustments = await _feedback_store.get_priority_adjustments()
    for model_name, delta in adjustments.items():
        profile = model_router.registry.get_profile(model_name)
        if profile:
            profile.priority = max(1, min(100, 50 + int(delta * 100)))

    return {"status": "Feedback stored", "adjustments_applied": len(adjustments)}


@router.get("/feedback/stats")
async def feedback_stats():
    """Get aggregate feedback statistics per model."""
    stats = await _feedback_store.get_stats_by_model()
    return {"stats": stats}
