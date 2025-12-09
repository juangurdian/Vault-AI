"""
Intelligent model router with auto-discovery and LLM-based routing.
"""

from typing import Optional, Dict, Any, List, AsyncGenerator
import asyncio
import time
from datetime import datetime
import logging
import json

from .classifier import QueryClassifier, TaskType
from .model_profiles import ModelRegistry, ModelProfile, ModelType
import ollama

logger = logging.getLogger(__name__)


# Mapping from TaskType to ModelType
TASK_TO_MODEL_TYPE = {
    TaskType.SIMPLE_CHAT: ModelType.FAST,
    TaskType.GENERAL: ModelType.GENERAL,
    TaskType.REASONING: ModelType.REASONING,
    TaskType.CODING: ModelType.CODING,
    TaskType.VISION: ModelType.VISION,
    TaskType.CREATIVE: ModelType.CREATIVE,
}


class ModelRouter:
    """Intelligent model router with auto-discovery and LLM-based routing."""

    def __init__(self, use_llm_routing: bool = True, routing_timeout_ms: int = 500):
        self.classifier = QueryClassifier()
        self.client = ollama.Client()
        self.registry = ModelRegistry()
        self.use_llm_routing = use_llm_routing
        self.routing_timeout_ms = routing_timeout_ms
        
        # Discover models on init
        self._discover_models()
        
        # Cache for routing decisions
        self._routing_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_max_size = 100

    def _discover_models(self):
        """Discover available models from Ollama."""
        try:
            discovered = self.registry.discover_from_ollama(self.client)
            logger.info(f"Model discovery complete. {len(self.registry.profiles)} models available.")
        except Exception as e:
            logger.error(f"Model discovery failed: {e}")
            # Fall back to defaults
            self._load_default_models()
    
    def _load_default_models(self):
        """Load default model configurations as fallback."""
        from .model_profiles import KNOWN_MODEL_DEFAULTS, create_profile_from_name
        for name in KNOWN_MODEL_DEFAULTS:
            if name not in self.registry.profiles:
                self.registry.profiles[name] = create_profile_from_name(name)
                self.registry.profiles[name].is_available = False  # Mark as not confirmed

    @property
    def model_configs(self) -> Dict[str, Dict[str, Any]]:
        """Backward-compatible property for model configs."""
        return {
            name: {
                "context_window": p.context_window,
                "strengths": p.strengths,
                "weaknesses": p.weaknesses,
                "estimated_tokens_per_sec": p.estimated_tokens_per_sec,
                "estimated_vram_gb": p.estimated_vram_gb,
            }
            for name, p in self.registry.profiles.items()
            if p.is_available
        }

    async def route_query(
        self,
        query: str,
        images: Optional[List[Dict[str, Any]]] = None,
        context: Optional[str] = None,
        force_model: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Route a query to the optimal model."""
        start_time = time.time()

        # Allow manual model override
        if force_model and force_model != "auto":
            profile = self.registry.get_profile(force_model)
            if not profile or not profile.is_available:
                available = [p.name for p in self.registry.get_chat_models()]
                raise ValueError(f"Model '{force_model}' not available. Available: {available}")

            return {
                "model": force_model,
                "routing_method": "manual_override",
                "task_type": profile.model_type.value if profile else "unknown",
                "reasoning": f"User specified model: {force_model}",
                "confidence": 1.0,
                "complexity": 0.0,
                "estimated_tokens": self._estimate_token_count(query, context),
                "expected_speed": f"{profile.estimated_tokens_per_sec}+ tok/s" if profile else "unknown",
                "keywords_found": [],
                "processing_time_ms": int((time.time() - start_time) * 1000),
                "timestamp": datetime.now().isoformat()
            }

        # Check cache
        cache_key = self._make_cache_key(query, images is not None)
        if cache_key in self._routing_cache:
            cached = self._routing_cache[cache_key].copy()
            cached["routing_method"] = "cached"
            cached["processing_time_ms"] = int((time.time() - start_time) * 1000)
            return cached

        # Try LLM-based routing first (if enabled and fast enough)
        llm_result = None
        if self.use_llm_routing:
            llm_result = await self._llm_route(query, conversation_history)

        # Fall back to regex-based classification
        has_images = images is not None and len(images) > 0
        context_length = len(context) if context else 0

        classification = self.classifier.classify(
            query=query,
            has_images=has_images,
            context_length=context_length,
            conversation_history=conversation_history
        )

        # Determine model
        if llm_result and llm_result.get("model"):
            selected_model = llm_result["model"]
            reasoning = llm_result.get("reasoning", "LLM-based routing")
            routing_method = "llm"
            confidence = 0.9
        else:
            # Use regex classification
            model_type = TASK_TO_MODEL_TYPE.get(classification.task_type, ModelType.GENERAL)
            selected_model = self.registry.get_best_model_for_type(model_type)
            
            if not selected_model:
                # Fallback to any available model
                chat_models = self.registry.get_chat_models()
                selected_model = chat_models[0].name if chat_models else "qwen3:8b"
            
            reasoning = classification.reasoning
            routing_method = "regex"
            confidence = classification.confidence

        # Validate context length
        estimated_tokens = self._estimate_token_count(query, context)
        profile = self.registry.get_profile(selected_model)
        
        warning = None
        if profile and estimated_tokens > profile.context_window * 0.8:
            # Try to find a model with larger context
            for p in self.registry.get_chat_models():
                if p.context_window > estimated_tokens * 1.2:
                    selected_model = p.name
                    reasoning += f" (upgraded to {p.name} for context length)"
                    break
            else:
                warning = "Query may exceed context window limits"

        processing_time = int((time.time() - start_time) * 1000)
        
        result = {
            "model": selected_model,
            "routing_method": routing_method,
            "task_type": classification.task_type.value,
            "confidence": confidence,
            "complexity": classification.complexity_score,
            "reasoning": reasoning,
            "estimated_tokens": estimated_tokens,
            "expected_speed": f"{profile.estimated_tokens_per_sec}+ tok/s" if profile else "unknown",
            "keywords_found": [str(kw) for kw in classification.keywords_found[:5]],
            "processing_time_ms": processing_time,
            "timestamp": datetime.now().isoformat(),
            "classification_details": {
                "task_type": classification.task_type.value,
                "confidence": classification.confidence,
                "complexity_score": classification.complexity_score,
                "reasoning": classification.reasoning
            }
        }
        
        if warning:
            result["warning"] = warning

        # Cache the result
        self._cache_result(cache_key, result)

        return result

    async def _llm_route(
        self,
        query: str,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Optional[Dict[str, Any]]:
        """Use a fast LLM to make routing decisions."""
        router_model = self.registry.get_routing_model()
        if not router_model:
            return None

        # Build context summary
        context_summary = ""
        if conversation_history and len(conversation_history) > 0:
            recent = conversation_history[-3:]  # Last 3 exchanges
            context_summary = " | ".join([
                f"{m.get('role', 'user')}: {m.get('content', '')[:100]}"
                for m in recent
            ])

        # Build model profiles for prompt
        profiles_text = self.registry.get_profiles_summary()

        prompt = f"""You are a query router. Analyze the user's query and select the best model.

Available models:
{profiles_text}

User query: {query}
{f"Recent context: {context_summary}" if context_summary else ""}

Select the most appropriate model. Respond with ONLY valid JSON:
{{"model": "model_name", "reasoning": "brief explanation (max 20 words)"}}"""

        try:
            # Run with timeout
            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda: self.client.chat(
                        model=router_model,
                        messages=[{"role": "user", "content": prompt}],
                        options={"temperature": 0.1, "num_predict": 100}
                    )
                ),
                timeout=self.routing_timeout_ms / 1000
            )

            content = response.get("message", {}).get("content", "")
            
            # Parse JSON from response
            # Try to extract JSON even if there's extra text
            json_match = content
            if "{" in content and "}" in content:
                start = content.index("{")
                end = content.rindex("}") + 1
                json_match = content[start:end]
            
            result = json.loads(json_match)
            
            # Validate model exists
            if result.get("model") and self.registry.get_profile(result["model"]):
                return result
            
            return None

        except asyncio.TimeoutError:
            logger.debug(f"LLM routing timed out after {self.routing_timeout_ms}ms")
            return None
        except json.JSONDecodeError:
            logger.debug(f"LLM routing returned invalid JSON")
            return None
        except Exception as e:
            logger.debug(f"LLM routing failed: {e}")
            return None

    async def execute_query(
        self,
        routing_result: Dict[str, Any],
        messages: List[Dict[str, Any]],
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """Execute the routed query and return the response."""
        model = routing_result["model"]
        profile = self.registry.get_profile(model)
        start_time = time.time()

        # Pack context
        packed_messages, packing_stats = self._pack_messages(messages, model)

        # Add system prompt if profile has one
        if profile and profile.system_prompt:
            # Check if there's already a system message
            has_system = any(m.get("role") == "system" for m in packed_messages)
            if not has_system:
                packed_messages.insert(0, {
                    "role": "system",
                    "content": profile.system_prompt
                })

        try:
            ollama_messages = []
            for msg in packed_messages:
                ollama_msg = {
                    "role": msg["role"],
                    "content": msg["content"]
                }
                if msg.get("images") and profile and profile.supports_vision:
                    ollama_msg["images"] = msg["images"]
                ollama_messages.append(ollama_msg)

            response = self.client.chat(
                model=model,
                messages=ollama_messages,
                stream=False,
                options={
                    "temperature": kwargs.get("temperature", 0.7),
                    "top_p": kwargs.get("top_p", 0.9),
                    "num_predict": kwargs.get("max_tokens", 2048)
                }
            )

            execution_time = int((time.time() - start_time) * 1000)
            response_content = response.get("message", {}).get("content", "")

            return {
                "success": True,
                "response": response_content,
                "model_used": model,
                "execution_time_ms": execution_time,
                "tokens_generated": self._estimate_token_count(response_content),
                "routing_info": routing_result,
                "packing": packing_stats,
            }

        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Execution error for model={model}: {e}")
            return {
                "success": False,
                "error": str(e),
                "model_used": model,
                "execution_time_ms": execution_time,
                "routing_info": routing_result,
                "packing": packing_stats,
            }

    async def execute_query_stream(
        self,
        routing_result: Dict[str, Any],
        messages: List[Dict[str, Any]],
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Execute query with true streaming."""
        model = routing_result["model"]
        profile = self.registry.get_profile(model)

        # Pack context
        packed_messages, _ = self._pack_messages(messages, model)

        # Add system prompt
        if profile and profile.system_prompt:
            has_system = any(m.get("role") == "system" for m in packed_messages)
            if not has_system:
                packed_messages.insert(0, {
                    "role": "system",
                    "content": profile.system_prompt
                })

        ollama_messages = []
        for msg in packed_messages:
            ollama_msg = {
                "role": msg["role"],
                "content": msg["content"]
            }
            if msg.get("images") and profile and profile.supports_vision:
                ollama_msg["images"] = msg["images"]
            ollama_messages.append(ollama_msg)

        try:
            # True streaming from Ollama
            for chunk in self.client.chat(
                model=model,
                messages=ollama_messages,
                stream=True,
                options={
                    "temperature": kwargs.get("temperature", 0.7),
                    "top_p": kwargs.get("top_p", 0.9),
                    "num_predict": kwargs.get("max_tokens", 2048)
                }
            ):
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Streaming error for model={model}: {e}")
            yield f"\n⚠️ Error: {str(e)}"

    def get_available_models(self) -> Dict[str, Any]:
        """Get information about all available models."""
        return {
            name: profile.to_dict()
            for name, profile in self.registry.profiles.items()
            if profile.is_available
        }

    def get_chat_models(self) -> List[Dict[str, Any]]:
        """Get all models suitable for chat."""
        return [p.to_dict() for p in self.registry.get_chat_models()]

    def refresh_models(self) -> List[str]:
        """Refresh model list from Ollama."""
        return self.registry.discover_from_ollama(self.client)

    def get_routing_stats(self) -> Dict[str, Any]:
        """Get routing statistics."""
        return {
            "cache_size": len(self._routing_cache),
            "cache_max_size": self._cache_max_size,
            "models_available": len([p for p in self.registry.profiles.values() if p.is_available]),
            "llm_routing_enabled": self.use_llm_routing,
            "routing_timeout_ms": self.routing_timeout_ms,
        }

    def _estimate_token_count(self, text: str, context: Optional[str] = None) -> int:
        """Estimate token count for text."""
        if not text:
            return 0
        total_chars = len(text)
        if context:
            total_chars += len(context)
        return int(total_chars // 4 * 1.1)

    def _pack_messages(self, messages: List[Dict[str, Any]], model: str):
        """Pack messages to fit within model context window."""
        profile = self.registry.get_profile(model)
        context_window = profile.context_window if profile else 4096
        target_tokens = int(context_window * 0.8)

        kept = []
        total_tokens = 0
        dropped: List[Dict[str, Any]] = []

        for msg in reversed(messages):
            msg_tokens = self._estimate_token_count(msg.get("content", ""))
            if total_tokens + msg_tokens <= target_tokens or not kept:
                kept.append(msg)
                total_tokens += msg_tokens
            else:
                dropped.append(msg)

        kept.reverse()
        dropped.reverse()

        tokens_kept = total_tokens
        tokens_total = sum(self._estimate_token_count(m.get("content", "")) for m in messages)
        tokens_dropped = max(tokens_total - tokens_kept, 0)

        used_summary = False
        summary_tokens = 0

        if dropped:
            used_summary = True
            summary_text = self._build_summary(dropped)
            summary_tokens = self._estimate_token_count(summary_text)
            if summary_tokens + tokens_kept < target_tokens:
                kept.insert(0, {
                    "role": "system",
                    "content": f"Previous conversation summary: {summary_text}",
                })
                tokens_kept += summary_tokens

        packing_stats = {
            "context_window": context_window,
            "target_tokens": target_tokens,
            "tokens_total": tokens_total,
            "tokens_kept": tokens_kept,
            "tokens_dropped": tokens_dropped,
            "used_summary": used_summary,
            "summary_tokens": summary_tokens,
        }

        return kept, packing_stats

    def _build_summary(self, messages: List[Dict[str, Any]], use_llm: bool = True) -> str:
        """Build a summary of dropped messages, optionally using LLM."""
        total_content = sum(len(m.get("content", "")) for m in messages)
        
        # Use LLM summarization for substantial content
        if use_llm and total_content > 500:
            summary = self._llm_summarize(messages)
            if summary:
                return summary
        
        # Fallback to simple concatenation
        snippets = []
        for msg in messages[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:150]
            snippets.append(f"{role}: {content}")
        return " | ".join(snippets)[:600]
    
    def _llm_summarize(self, messages: List[Dict[str, Any]]) -> Optional[str]:
        """Use a fast model to summarize conversation history."""
        router_model = self.registry.get_routing_model()
        if not router_model:
            return None
        
        # Build conversation text
        conversation = "\n".join([
            f"{m.get('role', 'user')}: {m.get('content', '')}"
            for m in messages[-10:]  # Last 10 messages max
        ])
        
        prompt = f"""Summarize this conversation in 2-3 concise sentences. Focus on:
- Key topics discussed
- Important decisions or conclusions
- Context needed for continuing the conversation

Conversation:
{conversation[:2000]}

Summary:"""

        try:
            response = self.client.chat(
                model=router_model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.3, "num_predict": 150}
            )
            summary = response.get("message", {}).get("content", "").strip()
            return summary if len(summary) > 20 else None
        except Exception as e:
            logger.debug(f"LLM summarization failed: {e}")
            return None

    def _make_cache_key(self, query: str, has_images: bool) -> str:
        """Create cache key for routing decisions."""
        # Simple key based on query prefix and image flag
        prefix = query[:100].lower().strip()
        return f"{prefix}|{has_images}"

    def _cache_result(self, key: str, result: Dict[str, Any]):
        """Cache a routing result."""
        if len(self._routing_cache) >= self._cache_max_size:
            # Remove oldest entries
            oldest = list(self._routing_cache.keys())[:10]
            for k in oldest:
                del self._routing_cache[k]
        self._routing_cache[key] = result.copy()
