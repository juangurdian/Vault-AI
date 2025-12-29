"""Agent manager to dispatch to specific agent types."""

from __future__ import annotations

from typing import Dict, Optional

from ..router.router import ModelRouter
from .base import AgentContext, AgentResult
from .research_agent import ResearchAgent
from .coding_agent import CodingAgent
from ..rag.vector_store import VectorStore
from ..config import get_settings


class AgentManager:
    """Simple registry/dispatcher for agents."""

    def __init__(self, router: ModelRouter, vector_store: Optional[VectorStore] = None):
        self.router = router
        settings = get_settings()
        
        # Initialize vector store if not provided
        if vector_store is None:
            vector_store = VectorStore(ollama_base_url=settings.ollama_base_url)
        
        self.research = ResearchAgent(router, vector_store=vector_store)
        self.coding = CodingAgent(router)
        self.registry: Dict[str, object] = {
            "research": self.research,
            "code": self.coding,
        }

    async def run(self, agent_type: str, ctx: AgentContext) -> AgentResult:
        if agent_type not in self.registry:
            return AgentResult(
                success=False,
                result=f"Unknown agent type: {agent_type}",
                model_used=None,
                routing_info=None,
            )

        agent = self.registry[agent_type]
        return await agent.run(ctx)

