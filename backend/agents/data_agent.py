"""Data agent — data analysis, CSV/JSON processing, and chart generation."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Dict, Optional

from ..router.router import ModelRouter
from .base import AgentBase, AgentContext, AgentResult
from .tools.code_executor import execute_python

logger = logging.getLogger(__name__)

DATA_SYSTEM = """You are a data analysis expert. When given data tasks:
1. Analyze the data structure and identify patterns
2. Write Python code using pandas/matplotlib when computation is needed
3. Explain your findings clearly with numbers and percentages
4. Suggest visualizations when appropriate
5. If you write code, wrap it in ```python code blocks

When generating charts, use matplotlib and save to 'output.png'.
Always provide a clear, non-technical summary of findings."""


class DataAgent(AgentBase):
    name = "data"

    def __init__(self, router: ModelRouter):
        self.router = router

    @property
    def data_model(self) -> str:
        from ..router.model_profiles import ModelType
        best = self.router.registry.get_best_model_for_type(ModelType.CODING)
        if not best:
            best = self.router.registry.get_best_model_for_type(ModelType.REASONING)
        return best or "qwen3:8b"

    async def run(
        self,
        ctx: AgentContext,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ) -> AgentResult:
        model_used = self.data_model

        try:
            if progress_callback:
                progress_callback("thinking", {"message": "Analyzing data..."})

            # Generate analysis with code
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.router.client.chat(
                    model=model_used,
                    messages=[
                        {"role": "system", "content": DATA_SYSTEM},
                        {"role": "user", "content": ctx.query},
                    ],
                    options={"temperature": 0.2, "num_predict": 4096},
                ),
            )
            response_text = response["message"]["content"]

            # Check if the response contains executable Python code
            import re
            code_blocks = re.findall(r'```python\n(.*?)```', response_text, re.DOTALL)

            execution_results = []
            for code in code_blocks:
                if progress_callback:
                    progress_callback("executing", {"message": "Running analysis code..."})
                result = await execute_python(code)
                if result.success:
                    execution_results.append(f"Output:\n{result.stdout}")
                else:
                    execution_results.append(f"Error:\n{result.stderr}")

            if execution_results:
                response_text += "\n\n### Execution Results\n"
                response_text += "\n\n".join(execution_results)

            if progress_callback:
                progress_callback("complete", {"message": "Analysis complete"})

            return AgentResult(
                success=True,
                result=response_text,
                model_used=model_used,
                routing_info={"model": model_used, "task_type": "data_analysis"},
            )

        except Exception as e:
            logger.error(f"Data agent error: {e}", exc_info=True)
            return AgentResult(
                success=False,
                result=f"Data agent error: {str(e)}",
                model_used=model_used,
            )
