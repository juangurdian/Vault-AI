"""Coding agent — uses the best available coding model via the router."""

from __future__ import annotations

from typing import Any, Dict, Optional, AsyncGenerator, Callable
import asyncio
import logging

from ..router.router import ModelRouter
from .base import AgentBase, AgentContext, AgentResult

logger = logging.getLogger(__name__)

CODING_SYSTEM = """You are an expert software engineer. When given a coding task:
1. Write clean, well-commented code
2. Explain what the code does briefly
3. Mention any edge cases or improvements
4. Use best practices for the language/framework

Format code blocks with proper language tags."""


class CodingAgent(AgentBase):
    name = "coding"

    def __init__(self, router: ModelRouter):
        self.router = router

    @property
    def coding_model(self) -> str:
        from ..router.model_profiles import ModelType
        best = self.router.registry.get_best_model_for_type(ModelType.CODING)
        return best or "qwen2.5-coder:7b"

    async def run(
        self,
        ctx: AgentContext,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> AgentResult:
        target_text = ctx.code or ctx.query
        model_used = self.coding_model

        try:
            if progress_callback:
                progress_callback("thinking", {"message": "Analyzing coding task..."})

            try:
                response = await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.router.client.chat(
                        model=model_used,
                        messages=[
                            {"role": "system", "content": CODING_SYSTEM},
                            {"role": "user", "content": target_text},
                        ],
                        options={"temperature": 0.2, "num_ctx": 8192},
                    )
                )
                response_text = response["message"]["content"]
            except Exception as e:
                logger.warning(f"Coding model {model_used} failed, falling back to router: {e}")
                routing = await self.router.route_query(target_text)
                model_used = routing.get("model", model_used)
                exec_result = await self.router.execute_query(routing, [
                    {"role": "system", "content": CODING_SYSTEM},
                    {"role": "user", "content": target_text},
                ])
                response_text = exec_result.get("response", f"Could not generate code: {e}")

            if progress_callback:
                progress_callback("complete", {"message": "Code generated"})

            return AgentResult(
                success=True,
                result=response_text,
                model_used=model_used,
                routing_info={"model": model_used, "task_type": "coding"},
            )

        except Exception as e:
            logger.error(f"Coding agent error: {e}", exc_info=True)
            return AgentResult(
                success=False,
                result=f"Coding agent error: {str(e)}",
                model_used=model_used,
            )

    async def stream(
        self,
        ctx: AgentContext,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream coding response token by token."""
        target_text = ctx.code or ctx.query
        model_used = self.coding_model
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def _iterate_sync():
            try:
                for chunk in self.router.client.chat(
                    model=model_used,
                    messages=[
                        {"role": "system", "content": CODING_SYSTEM},
                        {"role": "user", "content": target_text},
                    ],
                    stream=True,
                    options={"temperature": 0.2, "num_ctx": 8192},
                ):
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
                loop.call_soon_threadsafe(queue.put_nowait, None)
            except Exception as exc:
                loop.call_soon_threadsafe(queue.put_nowait, exc)

        try:
            loop.run_in_executor(None, _iterate_sync)
            while True:
                item = await queue.get()
                if item is None:
                    break
                if isinstance(item, Exception):
                    raise item
                token = item.get("message", {}).get("content", "")
                if token:
                    yield token
        except Exception as e:
            logger.error(f"Coding stream error: {e}")
            yield f"\n\nError: {str(e)}"
