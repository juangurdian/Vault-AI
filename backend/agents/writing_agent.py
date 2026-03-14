"""Writing agent — creative writing, document drafting, and editing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Dict, Optional

from ..router.router import ModelRouter
from .base import AgentBase, AgentContext, AgentResult

logger = logging.getLogger(__name__)

WRITING_SYSTEM = """You are a creative and versatile writer. Adapt your style to the request:
- For stories: vivid imagery, engaging characters, strong narrative arc
- For business: professional tone, clear structure, persuasive
- For technical: accurate, well-organized, appropriate detail
- For poetry: rhythm, imagery, emotional resonance
- For editing: preserve the author's voice while improving clarity and flow

Always structure your output clearly with appropriate formatting."""


class WritingAgent(AgentBase):
    name = "writing"

    def __init__(self, router: ModelRouter):
        self.router = router

    @property
    def writing_model(self) -> str:
        from ..router.model_profiles import ModelType
        best = self.router.registry.get_best_model_for_type(ModelType.CREATIVE)
        if not best:
            best = self.router.registry.get_best_model_for_type(ModelType.GENERAL)
        return best or "qwen3:8b"

    async def run(
        self,
        ctx: AgentContext,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> AgentResult:
        model_used = self.writing_model

        try:
            if progress_callback:
                progress_callback("thinking", {"message": "Crafting your text..."})

            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.router.client.chat(
                    model=model_used,
                    messages=[
                        {"role": "system", "content": WRITING_SYSTEM},
                        {"role": "user", "content": ctx.query},
                    ],
                    options={"temperature": 0.8, "num_predict": 4096},
                ),
            )
            response_text = response["message"]["content"]

            if progress_callback:
                progress_callback("complete", {"message": "Writing complete"})

            return AgentResult(
                success=True,
                result=response_text,
                model_used=model_used,
                routing_info={"model": model_used, "task_type": "creative"},
            )

        except Exception as e:
            logger.error(f"Writing agent error: {e}", exc_info=True)
            return AgentResult(
                success=False,
                result=f"Writing agent error: {str(e)}",
                model_used=model_used,
            )
