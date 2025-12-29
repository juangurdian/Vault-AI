"""Base classes and shared types for agents."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class AgentContext:
    query: str
    history: Optional[List[Dict[str, Any]]] = None
    context: Optional[str] = None
    web: bool = False
    code: Optional[str] = None


@dataclass
class AgentResult:
    success: bool
    result: str
    model_used: Optional[str] = None
    routing_info: Optional[Dict[str, Any]] = None


class AgentBase:
    """Simple synchronous agent interface for now."""

    name: str = "agent"

    async def run(self, ctx: AgentContext) -> AgentResult:
        raise NotImplementedError("Agent must implement run()")

