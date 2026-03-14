"""
Multi-agent orchestrator with graph-based workflow execution.
Inspired by LangGraph but lightweight — no external dependency.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from .base import AgentBase, AgentContext, AgentResult

logger = logging.getLogger(__name__)


class NodeStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class WorkflowState:
    """Shared state passed between workflow nodes."""
    query: str
    results: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def set(self, key: str, value: Any) -> None:
        self.results[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        return self.results.get(key, default)


@dataclass
class WorkflowNode:
    """A node in the workflow graph (an agent step)."""
    name: str
    agent: Optional[AgentBase] = None
    # If no agent, use a function
    func: Optional[Callable] = None
    # Edges to next nodes (name -> condition function, or None for unconditional)
    edges: Dict[str, Optional[Callable]] = field(default_factory=dict)
    status: NodeStatus = NodeStatus.PENDING
    result: Optional[AgentResult] = None
    execution_time_ms: int = 0


class WorkflowGraph:
    """
    A directed graph of agent nodes.
    Supports sequential, parallel, and conditional execution.
    """

    def __init__(self, name: str = "workflow"):
        self.name = name
        self.nodes: Dict[str, WorkflowNode] = {}
        self.entry_node: Optional[str] = None
        self.max_iterations: int = 20  # Safety limit

    def add_node(
        self,
        name: str,
        agent: Optional[AgentBase] = None,
        func: Optional[Callable] = None,
    ) -> WorkflowGraph:
        """Add a node to the graph."""
        self.nodes[name] = WorkflowNode(name=name, agent=agent, func=func)
        if self.entry_node is None:
            self.entry_node = name
        return self

    def add_edge(
        self,
        from_node: str,
        to_node: str,
        condition: Optional[Callable] = None,
    ) -> WorkflowGraph:
        """Add an edge between nodes. If condition is None, it's unconditional."""
        if from_node in self.nodes:
            self.nodes[from_node].edges[to_node] = condition
        return self

    def set_entry(self, node_name: str) -> WorkflowGraph:
        """Set the entry node for the workflow."""
        self.entry_node = node_name
        return self

    async def execute(self, state: WorkflowState) -> WorkflowState:
        """Execute the workflow graph from the entry node."""
        if not self.entry_node or self.entry_node not in self.nodes:
            state.errors.append("No valid entry node")
            return state

        current = self.entry_node
        iterations = 0

        while current and iterations < self.max_iterations:
            iterations += 1
            node = self.nodes.get(current)
            if not node:
                state.errors.append(f"Node '{current}' not found")
                break

            # Execute the node
            start = time.time()
            node.status = NodeStatus.RUNNING

            try:
                if node.agent:
                    ctx = AgentContext(
                        query=state.query,
                        context=str(state.results),
                    )
                    result = await node.agent.run(ctx)
                    node.result = result
                    state.set(node.name, result.result)
                elif node.func:
                    result = node.func(state)
                    if asyncio.iscoroutine(result):
                        result = await result
                    state.set(node.name, result)

                node.status = NodeStatus.COMPLETED
            except Exception as e:
                node.status = NodeStatus.FAILED
                state.errors.append(f"Node '{node.name}' failed: {e}")
                logger.error(f"Workflow node '{node.name}' failed: {e}")

            node.execution_time_ms = int((time.time() - start) * 1000)

            # Determine next node
            current = self._get_next_node(node, state)

        state.metadata["iterations"] = iterations
        state.metadata["workflow_name"] = self.name
        return state

    def _get_next_node(self, node: WorkflowNode, state: WorkflowState) -> Optional[str]:
        """Determine the next node based on edges and conditions."""
        for target, condition in node.edges.items():
            if condition is None:
                return target
            try:
                if condition(state):
                    return target
            except Exception as e:
                logger.warning(f"Edge condition error {node.name} -> {target}: {e}")
        return None  # End of workflow

    def get_status(self) -> Dict[str, Any]:
        """Get the status of all nodes."""
        return {
            name: {
                "status": node.status.value,
                "execution_time_ms": node.execution_time_ms,
            }
            for name, node in self.nodes.items()
        }


class AgentOrchestrator:
    """
    Orchestrates multiple agents using workflow graphs.
    Provides pre-built workflow patterns.
    """

    def __init__(self, agents: Dict[str, AgentBase]):
        self.agents = agents

    def create_sequential(self, agent_names: List[str]) -> WorkflowGraph:
        """Create a sequential workflow: A → B → C."""
        graph = WorkflowGraph(name="sequential")
        for i, name in enumerate(agent_names):
            if name in self.agents:
                graph.add_node(name, agent=self.agents[name])
                if i > 0:
                    graph.add_edge(agent_names[i - 1], name)
        return graph

    def create_plan_and_execute(
        self,
        planner: str,
        executor: str,
    ) -> WorkflowGraph:
        """Create a Plan-and-Execute workflow."""
        graph = WorkflowGraph(name="plan_and_execute")
        if planner in self.agents:
            graph.add_node("plan", agent=self.agents[planner])
        if executor in self.agents:
            graph.add_node("execute", agent=self.agents[executor])
            graph.add_edge("plan", "execute")
        return graph

    def create_research_synthesize(
        self,
        researcher: str,
        synthesizer: str,
    ) -> WorkflowGraph:
        """Create a Research → Synthesize workflow."""
        graph = WorkflowGraph(name="research_synthesize")

        if researcher in self.agents:
            graph.add_node("research", agent=self.agents[researcher])
        if synthesizer in self.agents:
            graph.add_node("synthesize", agent=self.agents[synthesizer])
            graph.add_edge("research", "synthesize")

        return graph

    async def run_workflow(
        self,
        graph: WorkflowGraph,
        query: str,
        initial_context: Optional[Dict[str, Any]] = None,
    ) -> AgentResult:
        """Execute a workflow and return the final result."""
        state = WorkflowState(
            query=query,
            context=initial_context or {},
        )

        state = await graph.execute(state)

        # Get the last completed node's result
        last_result = ""
        for node in reversed(list(graph.nodes.values())):
            if node.status == NodeStatus.COMPLETED and node.name in state.results:
                last_result = str(state.results[node.name])
                break

        success = not state.errors
        if state.errors:
            last_result += f"\n\nErrors: {'; '.join(state.errors)}"

        return AgentResult(
            success=success,
            result=last_result,
            routing_info={"workflow": graph.get_status()},
        )
