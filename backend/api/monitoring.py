from fastapi import APIRouter, Query

from ..monitoring.metrics import get_metrics

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/metrics")
async def metrics_summary(
    window_minutes: int = Query(
        default=60,
        ge=1,
        le=1440,
        description="Rolling window size in minutes",
    ),
) -> dict:
    """Return full metrics summary for the given time window."""
    collector = get_metrics()
    return collector.get_summary(window_minutes=window_minutes)


@router.get("/system")
async def system_resources() -> dict:
    """Return current system resource utilisation (CPU, RAM, GPU)."""
    collector = get_metrics()
    return collector.get_system_resources()


@router.get("/models")
async def model_stats(
    window_minutes: int = Query(
        default=60,
        ge=1,
        le=1440,
        description="Rolling window size in minutes",
    ),
) -> dict:
    """Return per-model usage statistics for the given time window."""
    collector = get_metrics()
    return collector.get_model_stats(window_minutes=window_minutes)
