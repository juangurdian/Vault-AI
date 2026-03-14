"""Tests for the agent system (memory, code_executor, orchestrator)."""

import asyncio
from unittest.mock import MagicMock

import pytest
import pytest_asyncio

from backend.agents.memory import AgentMemory, MemoryEntry
from backend.agents.tools.code_executor import (
    execute_python,
    ExecutionResult,
    MAX_OUTPUT_CHARS,
)
from backend.agents.orchestrator import (
    WorkflowGraph,
    WorkflowState,
    WorkflowNode,
    NodeStatus,
)


# ── AgentMemory ───────────────────────────────────────────────────────────


class TestAgentMemory:
    @pytest.mark.asyncio
    async def test_agent_memory_store_and_recall(self, tmp_db_path):
        """store() should persist a value and recall() should retrieve it."""
        mem = AgentMemory(db_path=tmp_db_path)
        await mem.store("user_name", "Alice", category="preference")
        value = await mem.recall("user_name")
        assert value == "Alice"

    @pytest.mark.asyncio
    async def test_agent_memory_search(self, tmp_db_path):
        """search() should find memories by keyword match."""
        mem = AgentMemory(db_path=tmp_db_path)
        await mem.store("fav_language", "Python is great", category="preference")
        await mem.store("fav_food", "Pizza is tasty", category="preference")
        await mem.store("work_project", "Building an AI system", category="fact")

        results = await mem.search("Python")
        assert len(results) >= 1
        assert any("Python" in r.value for r in results)

        # Category-filtered search
        results_pref = await mem.search("Python", category="preference")
        assert len(results_pref) >= 1
        assert all(r.category == "preference" for r in results_pref)

    @pytest.mark.asyncio
    async def test_agent_memory_forget(self, tmp_db_path):
        """forget() should remove the specified memory entry."""
        mem = AgentMemory(db_path=tmp_db_path)
        await mem.store("temp_key", "temp_value")
        assert await mem.recall("temp_key") == "temp_value"

        deleted = await mem.forget("temp_key")
        assert deleted is True

        value = await mem.recall("temp_key")
        assert value is None

    @pytest.mark.asyncio
    async def test_agent_memory_forget_nonexistent(self, tmp_db_path):
        """forget() should return False for a key that does not exist."""
        mem = AgentMemory(db_path=tmp_db_path)
        await mem._ensure_tables()
        deleted = await mem.forget("no_such_key")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_agent_memory_store_upsert(self, tmp_db_path):
        """Storing the same key twice should update the value."""
        mem = AgentMemory(db_path=tmp_db_path)
        await mem.store("color", "blue")
        await mem.store("color", "red")
        assert await mem.recall("color") == "red"


# ── Code Executor ─────────────────────────────────────────────────────────


class TestCodeExecutor:
    @pytest.mark.asyncio
    async def test_code_executor_python(self):
        """execute_python should run a simple print statement."""
        result = await execute_python("print('hello world')")
        assert isinstance(result, ExecutionResult)
        assert result.success is True
        assert "hello world" in result.stdout
        assert result.language == "python"

    @pytest.mark.asyncio
    async def test_code_executor_timeout(self):
        """Long-running code should be killed after the timeout."""
        code = "import time; time.sleep(60)"
        result = await execute_python(code, timeout=1)
        assert result.success is False
        assert "timed out" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_code_executor_output_limit(self):
        """Output longer than MAX_OUTPUT_CHARS should be truncated."""
        # Generate output that exceeds the limit
        code = f"print('A' * {MAX_OUTPUT_CHARS + 1000})"
        result = await execute_python(code, timeout=10)
        assert result.success is True
        assert len(result.stdout) <= MAX_OUTPUT_CHARS

    @pytest.mark.asyncio
    async def test_code_executor_syntax_error(self):
        """Syntax errors should result in success=False with stderr."""
        result = await execute_python("def foo(")
        assert result.success is False
        assert len(result.stderr) > 0

    @pytest.mark.asyncio
    async def test_code_executor_return_value(self):
        """Arithmetic expressions printed should appear in stdout."""
        result = await execute_python("print(2 + 3)")
        assert result.success is True
        assert "5" in result.stdout


# ── WorkflowGraph ─────────────────────────────────────────────────────────


class TestWorkflowGraph:
    @pytest.mark.asyncio
    async def test_workflow_graph_sequential(self):
        """A sequential workflow with function nodes should execute in order."""

        def step_a(state: WorkflowState):
            return "result_a"

        def step_b(state: WorkflowState):
            prev = state.get("step_a", "")
            return f"result_b(after:{prev})"

        graph = WorkflowGraph(name="test_seq")
        graph.add_node("step_a", func=step_a)
        graph.add_node("step_b", func=step_b)
        graph.add_edge("step_a", "step_b")

        state = WorkflowState(query="test")
        state = await graph.execute(state)

        assert state.get("step_a") == "result_a"
        assert "result_b" in state.get("step_b", "")
        assert len(state.errors) == 0
        assert state.metadata["iterations"] == 2

        # Check node statuses
        status = graph.get_status()
        assert status["step_a"]["status"] == "completed"
        assert status["step_b"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_workflow_graph_no_entry(self):
        """A graph with no entry node should record an error."""
        graph = WorkflowGraph(name="empty")
        graph.entry_node = None
        state = WorkflowState(query="test")
        state = await graph.execute(state)
        assert len(state.errors) > 0

    @pytest.mark.asyncio
    async def test_workflow_graph_conditional_edge(self):
        """Conditional edges should route based on state."""

        def router_node(state: WorkflowState):
            return "go_left"

        def left_node(state: WorkflowState):
            return "took_left"

        def right_node(state: WorkflowState):
            return "took_right"

        graph = WorkflowGraph(name="conditional")
        graph.add_node("router", func=router_node)
        graph.add_node("left", func=left_node)
        graph.add_node("right", func=right_node)

        graph.add_edge("router", "left", condition=lambda s: s.get("router") == "go_left")
        graph.add_edge("router", "right", condition=lambda s: s.get("router") == "go_right")

        state = WorkflowState(query="test")
        state = await graph.execute(state)

        assert state.get("left") == "took_left"
        assert state.get("right") is None  # right was never executed
