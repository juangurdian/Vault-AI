"""Central tool registry with auto-discovery and system-prompt generation."""

from __future__ import annotations

import importlib
import inspect
import logging
import pkgutil
from pathlib import Path
from typing import Dict, List, Optional

from .base_tool import BaseTool, ToolResult

logger = logging.getLogger(__name__)


class ToolRegistry:
    """Holds every registered BaseTool and can render the skills manifest."""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, tool: BaseTool) -> None:
        if not tool.name:
            raise ValueError(f"Tool {tool.__class__.__name__} has no name set")
        if tool.name in self._tools:
            logger.warning("Overwriting tool %s", tool.name)
        self._tools[tool.name] = tool
        logger.info("Registered tool: %s", tool.name)

    def get(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[BaseTool]:
        return list(self._tools.values())

    def tool_names(self) -> List[str]:
        return list(self._tools.keys())

    # ------------------------------------------------------------------
    # Auto-discovery
    # ------------------------------------------------------------------

    def auto_discover(self) -> List[str]:
        """
        Import every module in backend/agents/tools/ and register any
        BaseTool subclass that defines ``name``.

        Returns the names of newly registered tools.
        """
        package_path = Path(__file__).resolve().parent
        discovered: List[str] = []

        for importer, module_name, is_pkg in pkgutil.iter_modules([str(package_path)]):
            if module_name in ("base_tool", "registry", "__init__"):
                continue
            try:
                module = importlib.import_module(f".{module_name}", package=__package__)
            except Exception as exc:
                logger.warning("Could not import tool module %s: %s", module_name, exc)
                continue

            for attr_name in dir(module):
                obj = getattr(module, attr_name)
                if (
                    inspect.isclass(obj)
                    and issubclass(obj, BaseTool)
                    and obj is not BaseTool
                    and getattr(obj, "name", "")
                ):
                    try:
                        instance = obj()
                        self.register(instance)
                        discovered.append(instance.name)
                    except Exception as exc:
                        logger.warning("Could not instantiate tool %s: %s", attr_name, exc)

        logger.info("Auto-discovered %d tools: %s", len(discovered), discovered)
        return discovered

    # ------------------------------------------------------------------
    # Ollama native tool format
    # ------------------------------------------------------------------

    def to_ollama_tools(self, exclude: Optional[List[str]] = None) -> List[Dict]:
        """Return all tools in Ollama-native format for the tools= parameter."""
        excluded = set(exclude or [])
        return [
            tool.to_ollama_tool()
            for tool in self._tools.values()
            if tool.name not in excluded
        ]

    # ------------------------------------------------------------------
    # System-prompt generation
    # ------------------------------------------------------------------

    def generate_system_prompt_section(
        self,
        model_summaries: Optional[List[str]] = None,
        query_type: Optional[str] = None,
        personalization: Optional[str] = None,
    ) -> str:
        """
        Build the full structured system prompt that gets prepended so the
        LLM knows its identity, capabilities, rules, and available tools.
        """
        from . import prompt_templates as T

        sections = [
            T.IDENTITY,
            T.build_date_section(),
            T.BEHAVIORAL_RULES,
            T.RESTRICTIONS,
            T.OUTPUT_FORMATTING,
        ]

        if self._tools:
            sections.append(T.TOOL_USAGE_RULES)
            sections.append(T.TOOL_CALL_FORMAT)
            sections.append(T.build_tool_section(self.list_tools()))
            sections.append(T.ERROR_HANDLING)
            sections.append(T.PLANNING_INSTRUCTIONS)

        sections.append(T.INFORMATION_PRIORITY)

        if model_summaries:
            sections.append(T.build_model_section(model_summaries))

        if query_type and query_type in T.QUERY_FORMAT_OVERLAYS:
            sections.append(T.QUERY_FORMAT_OVERLAYS[query_type])

        if personalization:
            sections.append(f"<personalization>\n{personalization}\n</personalization>")

        return "\n\n".join(sections)

    async def execute(self, name: str, args: Dict) -> ToolResult:
        """Look up a tool by name and run it."""
        tool = self.get(name)
        if not tool:
            return ToolResult(
                success=False,
                result_text=f"Unknown tool: {name}",
            )
        try:
            return await tool.execute(**args)
        except Exception as exc:
            logger.error("Tool %s execution error: %s", name, exc, exc_info=True)
            return ToolResult(success=False, result_text=f"Tool error: {exc}")
