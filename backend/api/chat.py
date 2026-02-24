"""
Chat API endpoints with intelligent routing, web search, tool execution, and true streaming.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import time
import json
import logging
import asyncio
import re

from ..deps import get_model_router, get_tool_registry
from ..router.router import ModelRouter
from ..router.classifier import QueryClassifier
from ..agents.tools.search_service import SearchService
from ..agents.tools.registry import ToolRegistry
from ..storage.preferences import UserPreferencesStore
from ..config import get_settings

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

MAX_TOOL_CALLS_PER_TURN = 5
PLANNING_COMPLEXITY_THRESHOLD = 0.45

_classifier = QueryClassifier()
_preferences = UserPreferencesStore()
_settings = get_settings()
_search_service = SearchService(
    brave_api_key=_settings.brave_api_key if _settings.brave_api_key else None,
    perplexity_api_key=_settings.perplexity_api_key if _settings.perplexity_api_key else None,
    searxng_url=_settings.searxng_base_url,
    provider_order=_settings.search_provider_order,
)

# Tools that should NOT be offered via Ollama native tool calling because they
# require data the model cannot provide (e.g. base64 images).
_NATIVE_TOOL_EXCLUDE = ["image_analyze"]


class Message(BaseModel):
    role: str
    content: str
    images: Optional[List[str]] = None


class ChatRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = "auto"
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9
    max_tokens: Optional[int] = 2048
    context: Optional[str] = None
    force_reasoning: Optional[bool] = False


class ChatResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None
    model_used: str
    execution_time_ms: int
    routing_info: Dict[str, Any]


def _format_event(event_type: str, payload: Any) -> str:
    """Format a server-sent event."""
    data = {"type": event_type}
    if isinstance(payload, str):
        data["text"] = payload
    else:
        data["payload"] = payload
    return f"data: {json.dumps(data)}\n\n"


# ---------------------------------------------------------------------------
# Tool-call extraction helpers (tag-based fallback)
# ---------------------------------------------------------------------------

_TOOL_CALL_RE = re.compile(
    r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
    re.DOTALL,
)


def _extract_tool_call(text: str) -> Optional[Dict[str, Any]]:
    """Parse the first <tool_call> JSON block. Returns None if not found."""
    m = _TOOL_CALL_RE.search(text)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Planning helpers
# ---------------------------------------------------------------------------

def _needs_planning(classification, num_tools: int) -> bool:
    if classification.complexity_score >= PLANNING_COMPLEXITY_THRESHOLD and num_tools >= 2:
        return True
    if classification.needs_web_search and classification.complexity_score >= 0.3:
        return True
    return classification.task_type.value in ("research", "reasoning")


def _build_planning_injection(query: str, tool_names: list[str]) -> str:
    tools_list = ", ".join(tool_names)
    return (
        "<planning_step>\n"
        f"The user's query may require multiple steps. Available tools: {tools_list}.\n"
        "Before answering, briefly plan your approach:\n"
        "1. What information do you need?\n"
        "2. Which tool(s) will provide it?\n"
        "3. In what order should you call them?\n"
        "Think inside <think> tags, then proceed with your first action.\n"
        "</planning_step>"
    )


# ---------------------------------------------------------------------------
# Native tool-call execution helper
# ---------------------------------------------------------------------------

async def _execute_native_tool_calls(
    tool_calls: List[Dict[str, Any]],
    tool_registry: ToolRegistry,
) -> List[Dict[str, Any]]:
    """Execute a batch of native tool calls and return results."""
    results = []
    for tc in tool_calls:
        name = tc.get("name", "")
        args = tc.get("args", {})
        tool_result = await tool_registry.execute(name, args)
        results.append({
            "name": name,
            "args": args,
            "success": tool_result.success,
            "result_text": tool_result.result_text,
        })
    return results


# ---------------------------------------------------------------------------
# Non-streaming endpoint
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    model_router: ModelRouter = Depends(get_model_router),
    tool_registry: ToolRegistry = Depends(get_tool_registry),
):
    """Chat endpoint with intelligent routing (non-streaming)."""
    start = time.perf_counter()

    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    classification = _classifier.classify(last_user_msg.content)
    user_prefs = await _preferences.get_all()
    personalization = _preferences.build_personalization_prompt(user_prefs)
    skills_prompt = tool_registry.generate_system_prompt_section(
        model_summaries=model_router.get_model_summaries(),
        query_type=classification.task_type.value,
        personalization=personalization or None,
    )

    try:
        routing_result = await model_router.route_query(
            query=last_user_msg.content,
            images=last_user_msg.images,
            context=request.context,
            force_model=request.model,
            conversation_history=[msg.model_dump() for msg in request.messages[:-1]],
        )

        execution_result = await model_router.execute_query(
            routing_result=routing_result,
            messages=[msg.model_dump() for msg in request.messages],
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            skills_prompt=skills_prompt,
        )

        packing = execution_result.get("packing") or {}
        routing_result_with_packing = {**routing_result, "packing": packing}

        return ChatResponse(
            success=execution_result["success"],
            response=execution_result.get("response"),
            error=execution_result.get("error"),
            model_used=execution_result["model_used"],
            execution_time_ms=int((time.perf_counter() - start) * 1000),
            routing_info=routing_result_with_packing,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    model_router: ModelRouter = Depends(get_model_router),
    tool_registry: ToolRegistry = Depends(get_tool_registry),
):
    """Stream responses via SSE with true streaming, web search, and tool execution."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    last_user_msg = next((m for m in reversed(request.messages) if m.role == "user"), None)
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    classification = _classifier.classify(last_user_msg.content)
    needs_web_search = classification.needs_web_search

    force_model = request.model
    if request.force_reasoning:
        from ..router.model_profiles import ModelType
        reasoning_model = model_router.registry.get_best_model_for_type(ModelType.REASONING)
        if reasoning_model:
            force_model = reasoning_model

    try:
        routing_result = await model_router.route_query(
            query=last_user_msg.content,
            images=last_user_msg.images,
            context=request.context,
            force_model=force_model,
            conversation_history=[msg.model_dump() for msg in request.messages[:-1]],
        )
        logger.info(f"Stream routing: {routing_result.get('model')} via {routing_result.get('routing_method')}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    model_meta = model_router.model_configs.get(routing_result.get("model"), {})
    messages_list = [msg.model_dump() for msg in request.messages]
    _, packing_stats = model_router._pack_messages(messages_list, routing_result["model"])

    query_type = classification.task_type.value
    user_prefs = await _preferences.get_all()
    personalization = _preferences.build_personalization_prompt(user_prefs)
    skills_prompt = tool_registry.generate_system_prompt_section(
        model_summaries=model_router.get_model_summaries(),
        query_type=query_type,
        personalization=personalization or None,
    )

    # Prepare native Ollama tools (exclude tools the model can't drive itself)
    ollama_tools = tool_registry.to_ollama_tools(exclude=_NATIVE_TOOL_EXCLUDE)

    async def event_generator():
        nonlocal messages_list
        start_time = time.perf_counter()
        search_results = []
        tools_used: List[Dict[str, Any]] = []
        accumulated_tool_context: List[str] = []

        yield _format_event("routing", {
            **routing_result,
            "packing": packing_stats,
            "needs_web_search": needs_web_search,
            "web_search_reason": classification.web_search_reason,
            "model_meta": {
                "context_window": model_meta.get("context_window"),
                "estimated_vram_gb": model_meta.get("estimated_vram_gb"),
                "estimated_tokens_per_sec": model_meta.get("estimated_tokens_per_sec"),
            },
        })

        # ── Proactive web search for queries that need it ─────────────
        if needs_web_search:
            try:
                yield _format_event("tool_start", {
                    "name": "web_search",
                    "args": {"query": last_user_msg.content},
                })
                yield _format_event("search_start", {
                    "query": last_user_msg.content,
                    "reason": classification.web_search_reason,
                })
                search_results = await _search_service.search(
                    query=last_user_msg.content, num_results=5, timeout=10.0,
                )
                yield _format_event("search_results", {
                    "results": _search_service.to_dict_list(search_results),
                    "count": len(search_results),
                })
                yield _format_event("tool_result", {
                    "name": "web_search",
                    "success": len(search_results) > 0,
                    "result_preview": f"Found {len(search_results)} results" if search_results else "No results found",
                })
                tools_used.append({
                    "name": "web_search",
                    "args": {"query": last_user_msg.content},
                    "success": len(search_results) > 0,
                })
                if search_results:
                    search_context = _format_search_context(search_results)
                    messages_list = _inject_search_context(messages_list, search_context)
                    logger.info(f"Injected {len(search_results)} search results into context")
            except Exception as e:
                logger.error(f"Web search error: {e}")
                yield _format_event("search_error", {"error": str(e)})
                yield _format_event("tool_result", {
                    "name": "web_search",
                    "success": False,
                    "result_preview": str(e),
                })

        # ── Planning injection for complex queries ─────────────────────
        current_messages = list(messages_list)

        if _needs_planning(classification, len(tool_registry.list_tools())):
            planning_msg = _build_planning_injection(
                last_user_msg.content,
                tool_registry.tool_names(),
            )
            last_user_idx = None
            for i in range(len(current_messages) - 1, -1, -1):
                if current_messages[i].get("role") == "user":
                    last_user_idx = i
                    break
            if last_user_idx is not None:
                current_messages.insert(last_user_idx, {
                    "role": "system",
                    "content": planning_msg,
                })
            logger.info("Injected planning step (type=%s, complexity=%.2f)",
                        classification.task_type.value, classification.complexity_score)

        # ── Force-reasoning think-tag injection ────────────────────────
        if request.force_reasoning:
            current_messages.insert(0 if not any(m.get("role") == "system" for m in current_messages) else 1, {
                "role": "system",
                "content": (
                    "You MUST think step-by-step. Wrap your internal reasoning in <think>...</think> tags "
                    "before giving your final answer. Show your complete thought process."
                ),
            })

        # ── Phase 1: Try native Ollama tool calling ────────────────────
        error_message = None
        tokens_generated = 0
        tool_call_count = 0
        native_tools_worked = False

        if ollama_tools and not request.force_reasoning:
            try:
                logger.info("Trying native Ollama tool calling with %d tools", len(ollama_tools))
                native_result = await model_router.execute_query_with_tools(
                    routing_result=routing_result,
                    messages=current_messages,
                    ollama_tools=ollama_tools,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    max_tokens=request.max_tokens,
                    skills_prompt=skills_prompt,
                )

                native_tool_calls = native_result.get("tool_calls", [])
                native_content = native_result.get("content", "")

                if native_tool_calls:
                    native_tools_worked = True
                    logger.info("Native tool calls received: %s",
                                [tc["name"] for tc in native_tool_calls])

                    # Execute each native tool call
                    while native_tool_calls and tool_call_count < MAX_TOOL_CALLS_PER_TURN:
                        for tc in native_tool_calls:
                            tool_name = tc["name"]
                            tool_args = tc["args"]

                            yield _format_event("tool_start", {
                                "name": tool_name,
                                "args": tool_args,
                            })

                            tool_result = await tool_registry.execute(tool_name, tool_args)

                            yield _format_event("tool_result", {
                                "name": tool_name,
                                "success": tool_result.success,
                                "result_preview": tool_result.result_text[:500],
                            })

                            tools_used.append({
                                "name": tool_name,
                                "args": tool_args,
                                "success": tool_result.success,
                            })

                            accumulated_tool_context.append(
                                f"[{tool_name}] {'OK' if tool_result.success else 'FAILED'}: "
                                f"{tool_result.result_text[:300]}"
                            )

                            # Inject tool result into conversation
                            current_messages.append({
                                "role": "assistant",
                                "content": native_content or "",
                            })
                            current_messages.append({
                                "role": "tool",
                                "content": tool_result.result_text,
                            })
                            tool_call_count += 1

                        # Check if model wants more tool calls
                        if tool_call_count < MAX_TOOL_CALLS_PER_TURN:
                            try:
                                followup = await model_router.execute_query_with_tools(
                                    routing_result=routing_result,
                                    messages=current_messages,
                                    ollama_tools=ollama_tools,
                                    temperature=request.temperature,
                                    top_p=request.top_p,
                                    max_tokens=request.max_tokens,
                                    skills_prompt=skills_prompt,
                                )
                                native_tool_calls = followup.get("tool_calls", [])
                                native_content = followup.get("content", "")
                                if not native_tool_calls:
                                    break
                            except Exception:
                                break
                        else:
                            break

            except Exception as e:
                logger.warning("Native tool calling failed, falling back to tag-based: %s", e)
                native_tools_worked = False

        # ── Phase 2: Stream the response ───────────────────────────────
        # If native tools worked, inject their results and stream the final answer.
        # If not, use the tag-based streaming loop as before.

        while True:
            full_response = ""
            in_thinking = False
            in_tool_call = False
            buffer = ""
            found_tool_call = False

            try:
                async for chunk in model_router.execute_query_stream(
                    routing_result=routing_result,
                    messages=current_messages,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    max_tokens=request.max_tokens,
                    skills_prompt=skills_prompt,
                    ollama_tools=ollama_tools if not native_tools_worked else None,
                ):
                    tokens_generated += len(chunk) // 4
                    buffer += chunk

                    while buffer:
                        if in_tool_call:
                            end_idx = buffer.find("</tool_call>")
                            if end_idx == -1:
                                break
                            tool_json_str = buffer[:end_idx]
                            buffer = buffer[end_idx + 12:]
                            in_tool_call = False

                            parsed = None
                            try:
                                parsed = json.loads(tool_json_str.strip())
                            except json.JSONDecodeError:
                                yield _format_event("delta", f"<tool_call>{tool_json_str}</tool_call>")
                                continue

                            tool_name = parsed.get("name", "")
                            tool_args = parsed.get("args", {})
                            found_tool_call = True

                            yield _format_event("tool_start", {
                                "name": tool_name,
                                "args": tool_args,
                            })

                            tool_result = await tool_registry.execute(tool_name, tool_args)

                            yield _format_event("tool_result", {
                                "name": tool_name,
                                "success": tool_result.success,
                                "result_preview": tool_result.result_text[:500],
                            })

                            tools_used.append({
                                "name": tool_name,
                                "args": tool_args,
                                "success": tool_result.success,
                            })

                            accumulated_tool_context.append(
                                f"[{tool_name}] {'OK' if tool_result.success else 'FAILED'}: "
                                f"{tool_result.result_text[:300]}"
                            )

                            current_messages.append({
                                "role": "assistant",
                                "content": full_response + f'<tool_call>{tool_json_str}</tool_call>',
                            })

                            if tool_result.success:
                                injection = (
                                    f"Tool result from {tool_name}:\n\n"
                                    f"{tool_result.result_text}\n\n"
                                    "Think about what you learned from this result. "
                                    "If you have enough information, answer the user now. "
                                    "If you need more data, call another tool. "
                                    "Do NOT call the same tool with the same arguments."
                                )
                            else:
                                injection = (
                                    f"Tool {tool_name} FAILED with: {tool_result.result_text}\n\n"
                                    "Consider an alternative approach:\n"
                                    "- Try a different tool if one is suitable.\n"
                                    "- Try different arguments (e.g. a simpler query).\n"
                                    "- If no alternative exists, answer with your own knowledge "
                                    "and explain that the tool was unavailable."
                                )

                            if len(accumulated_tool_context) > 1:
                                injection += (
                                    "\n\nAccumulated tool results so far:\n"
                                    + "\n".join(f"  - {c}" for c in accumulated_tool_context)
                                )

                            current_messages.append({
                                "role": "system",
                                "content": injection,
                            })
                            tool_call_count += 1
                            break

                        elif in_thinking:
                            end_idx = buffer.find("</think>")
                            if end_idx == -1:
                                safe_end = len(buffer)
                                for i in range(1, min(9, len(buffer) + 1)):
                                    if buffer.endswith("</think>"[:i]):
                                        safe_end = len(buffer) - i
                                        break
                                if safe_end > 0:
                                    yield _format_event("thinking_delta", buffer[:safe_end])
                                buffer = buffer[safe_end:]
                                break
                            else:
                                if end_idx > 0:
                                    yield _format_event("thinking_delta", buffer[:end_idx])
                                buffer = buffer[end_idx + 8:]
                                in_thinking = False
                                yield _format_event("thinking_end", {})
                        else:
                            think_idx = buffer.find("<think>")
                            tool_idx = buffer.find("<tool_call>")

                            first_tag = None
                            first_pos = len(buffer)

                            if think_idx != -1 and think_idx < first_pos:
                                first_tag = "think"
                                first_pos = think_idx
                            if tool_idx != -1 and tool_idx < first_pos:
                                first_tag = "tool_call"
                                first_pos = tool_idx

                            if first_tag is None:
                                safe_end = len(buffer)
                                for partial in ("<think>", "<tool_call>"):
                                    for i in range(1, min(len(partial) + 1, len(buffer) + 1)):
                                        if buffer.endswith(partial[:i]):
                                            safe_end = min(safe_end, len(buffer) - i)
                                            break
                                if safe_end > 0:
                                    text_chunk = buffer[:safe_end]
                                    full_response += text_chunk
                                    yield _format_event("delta", text_chunk)
                                buffer = buffer[safe_end:]
                                break
                            else:
                                if first_pos > 0:
                                    text_chunk = buffer[:first_pos]
                                    full_response += text_chunk
                                    yield _format_event("delta", text_chunk)

                                if first_tag == "think":
                                    buffer = buffer[first_pos + 7:]
                                    in_thinking = True
                                    yield _format_event("thinking_start", {})
                                elif first_tag == "tool_call":
                                    buffer = buffer[first_pos + 11:]
                                    in_tool_call = True

                    if found_tool_call:
                        break

                # Flush remaining buffer
                if not found_tool_call and buffer:
                    if in_thinking:
                        yield _format_event("thinking_delta", buffer)
                        yield _format_event("thinking_end", {})
                    elif in_tool_call:
                        yield _format_event("delta", f"<tool_call>{buffer}")
                    else:
                        full_response += buffer
                        yield _format_event("delta", buffer)

            except Exception as e:
                error_message = str(e)
                logger.error(f"Stream error: {e}")
                yield _format_event("delta", f"\n\u26a0\ufe0f Error: {error_message}")
                break

            if not found_tool_call or tool_call_count >= MAX_TOOL_CALLS_PER_TURN:
                if tool_call_count >= MAX_TOOL_CALLS_PER_TURN and found_tool_call:
                    logger.warning("Max tool calls reached (%d)", MAX_TOOL_CALLS_PER_TURN)
                break

        # ── Done ──────────────────────────────────────────────────────
        execution_time_ms = int((time.perf_counter() - start_time) * 1000)
        yield _format_event("done", {
            "success": error_message is None,
            "model_used": routing_result.get("model"),
            "error": error_message,
            "execution_time_ms": execution_time_ms,
            "tokens_generated": tokens_generated,
            "web_search_used": len(search_results) > 0,
            "tools_used": tools_used,
            "tool_calls_made": tool_call_count,
            "sources": [r.url for r in search_results] if search_results else [],
        })

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


def _format_search_context(results: list) -> str:
    """Format search results as context for the LLM."""
    if not results:
        return ""

    lines = ["Here is relevant information from web search:\n"]
    for i, result in enumerate(results, 1):
        lines.append(f"[{i}] {result.title}")
        lines.append(f"    Source: {result.url}")
        lines.append(f"    {result.snippet}")
        lines.append("")

    lines.append("Use this information to provide an accurate and up-to-date response.")
    lines.append("Cite sources using [1], [2], etc. when referencing specific information.\n")

    return "\n".join(lines)


def _inject_search_context(messages: List[Dict[str, Any]], context: str) -> List[Dict[str, Any]]:
    """Inject search context as a system message before the last user message."""
    if not context or not messages:
        return messages

    result = messages.copy()
    last_user_idx = None
    for i in range(len(result) - 1, -1, -1):
        if result[i].get("role") == "user":
            last_user_idx = i
            break

    if last_user_idx is not None:
        result.insert(last_user_idx, {"role": "system", "content": context})

    return result
