from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from datetime import datetime

from .config import get_settings
from .deps import get_model_router, get_tool_registry
from .api import chat, agents, rag, models, feedback, image, conversations, system, preferences
from .api import settings as settings_api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="LocalAI",
    description="Unified backend with intelligent routing and agents",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(models.router, prefix=settings.api_prefix)
app.include_router(agents.router, prefix=settings.api_prefix)
app.include_router(rag.router, prefix=settings.api_prefix)
app.include_router(feedback.router, prefix=settings.api_prefix)
app.include_router(image.router, prefix=settings.api_prefix)
app.include_router(settings_api.router, prefix=settings.api_prefix)
app.include_router(conversations.router, prefix=settings.api_prefix)
app.include_router(system.router, prefix=settings.api_prefix)
app.include_router(preferences.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def startup_event():
    tool_reg = get_tool_registry()
    logger.info("Tool registry ready with %d tools: %s", len(tool_reg.list_tools()), tool_reg.tool_names())


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": "2.0.0",
        "features": ["llm_routing", "auto_discovery", "true_streaming"],
        "endpoints": [
            f"{settings.api_prefix}/chat",
            f"{settings.api_prefix}/chat/stream",
            f"{settings.api_prefix}/models",
            f"{settings.api_prefix}/models/refresh",
            f"{settings.api_prefix}/agents/research",
            f"{settings.api_prefix}/agents/code",
            f"{settings.api_prefix}/rag/search",
        ],
    }


@app.get("/health")
async def health():
    router = get_model_router()
    stats = router.get_routing_stats()
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_available": stats["models_available"],
        "llm_routing_enabled": stats["llm_routing_enabled"],
        "routing_model": router.registry.get_routing_model(),
    }


@app.get(f"{settings.api_prefix}/status")
async def status():
    router = get_model_router()
    return {
        "service": settings.app_name,
        "online": True,
        "models": list(router.model_configs.keys()),
        "timestamp": datetime.now().isoformat(),
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc), "timestamp": datetime.now().isoformat()},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=True, log_level="info")
