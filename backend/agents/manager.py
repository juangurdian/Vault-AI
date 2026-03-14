"""Agent manager to dispatch to specific agent types."""

from __future__ import annotations

from typing import Dict, Optional

from ..router.router import ModelRouter
from .base import AgentBase, AgentContext, AgentResult
from .research_agent import ResearchAgent
from .coding_agent import CodingAgent
from .writing_agent import WritingAgent
from .data_agent import DataAgent
from .orchestrator import AgentOrchestrator
from ..rag.vector_store import VectorStore
from ..config import get_settings


class AgentManager:
    """Registry/dispatcher for agents with orchestration support."""

    def __init__(self, router: ModelRouter, vector_store: Optional[VectorStore] = None):
        self.router = router
        settings = get_settings()

        # Initialize vector store if not provided
        if vector_store is None:
            vector_store = VectorStore(ollama_base_url=settings.ollama_base_url)

        # Initialize all agents
        self.research = ResearchAgent(router, vector_store=vector_store)
        self.coding = CodingAgent(router)
        self.writing = WritingAgent(router)
        self.data = DataAgent(router)

        self.registry: Dict[str, AgentBase] = {
            "research": self.research,
            "code": self.coding,
            "writing": self.writing,
            "data": self.data,
        }

        # Initialize orchestrator for multi-agent workflows
        self.orchestrator = AgentOrchestrator(self.registry)

    async def run(self, agent_type: str, ctx: AgentContext) -> AgentResult:
        if agent_type not in self.registry:
            return AgentResult(
                success=False,
                result=f"Unknown agent type: {agent_type}. Available: {list(self.registry.keys())}",
                model_used=None,
                routing_info=None,
            )

        agent = self.registry[agent_type]
        return await agent.run(ctx)

    async def run_workflow(
        self,
        workflow_type: str,
        query: str,
    ) -> AgentResult:
        """Run a pre-built multi-agent workflow."""
        if workflow_type == "research_and_write":
            graph = self.orchestrator.create_research_synthesize("research", "writing")
            return await self.orchestrator.run_workflow(graph, query)
        elif workflow_type == "plan_and_code":
            graph = self.orchestrator.create_plan_and_execute("research", "code")
            return await self.orchestrator.run_workflow(graph, query)
        else:
            return AgentResult(
                success=False,
                result=f"Unknown workflow: {workflow_type}",
            )

    def list_agents(self) -> Dict[str, str]:
        """List available agents with descriptions."""
        return {
            "research": "Deep research with web search and RAG",
            "code": "Code generation, debugging, and review",
            "writing": "Creative writing, drafting, and editing",
            "data": "Data analysis with code execution",
        }
