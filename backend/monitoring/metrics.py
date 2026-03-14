import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import psutil


MAX_ENTRIES = 1000


@dataclass
class RequestMetric:
    endpoint: str
    method: str
    status_code: int
    latency_ms: float
    timestamp: float


@dataclass
class ModelMetric:
    model: str
    task_type: str
    tokens_generated: int
    latency_ms: float
    timestamp: float


class MetricsCollector:
    """Singleton metrics collector for tracking request, model, and system metrics.

    Maintains rolling windows of at most ``MAX_ENTRIES`` items per category to
    prevent unbounded memory growth.
    """

    _instance: Optional["MetricsCollector"] = None

    @classmethod
    def get(cls) -> "MetricsCollector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        """Reset the singleton instance (useful for testing)."""
        cls._instance = None

    def __init__(self) -> None:
        self._requests: List[RequestMetric] = []
        self._model_usage: List[ModelMetric] = []
        self._errors: List[dict] = []
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Recording helpers
    # ------------------------------------------------------------------

    def record_request(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        latency_ms: float,
    ) -> None:
        metric = RequestMetric(
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            latency_ms=latency_ms,
            timestamp=time.time(),
        )
        with self._lock:
            self._requests.append(metric)
            if len(self._requests) > MAX_ENTRIES:
                self._requests = self._requests[-MAX_ENTRIES:]

    def record_model_usage(
        self,
        model: str,
        task_type: str,
        tokens: int,
        latency_ms: float,
    ) -> None:
        metric = ModelMetric(
            model=model,
            task_type=task_type,
            tokens_generated=tokens,
            latency_ms=latency_ms,
            timestamp=time.time(),
        )
        with self._lock:
            self._model_usage.append(metric)
            if len(self._model_usage) > MAX_ENTRIES:
                self._model_usage = self._model_usage[-MAX_ENTRIES:]

    def record_error(
        self,
        endpoint: str,
        error_type: str,
        message: str,
    ) -> None:
        entry = {
            "endpoint": endpoint,
            "error_type": error_type,
            "message": message,
            "timestamp": time.time(),
        }
        with self._lock:
            self._errors.append(entry)
            if len(self._errors) > MAX_ENTRIES:
                self._errors = self._errors[-MAX_ENTRIES:]

    # ------------------------------------------------------------------
    # Query helpers
    # ------------------------------------------------------------------

    def get_summary(self, window_minutes: int = 60) -> dict:
        """Return a metrics summary for the last *window_minutes* minutes."""
        cutoff = time.time() - (window_minutes * 60)

        with self._lock:
            requests = [r for r in self._requests if r.timestamp >= cutoff]
            model_usage = [m for m in self._model_usage if m.timestamp >= cutoff]
            errors = [e for e in self._errors if e["timestamp"] >= cutoff]

        total_requests = len(requests)
        avg_latency = (
            sum(r.latency_ms for r in requests) / total_requests
            if total_requests
            else 0.0
        )
        error_count = sum(1 for r in requests if r.status_code >= 400)
        error_rate = error_count / total_requests if total_requests else 0.0

        # Top endpoints by request count
        endpoint_counts: Dict[str, int] = defaultdict(int)
        for r in requests:
            endpoint_counts[r.endpoint] += 1
        top_endpoints = sorted(
            endpoint_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]

        # Model usage breakdown
        model_counts: Dict[str, int] = defaultdict(int)
        model_tokens: Dict[str, int] = defaultdict(int)
        for m in model_usage:
            model_counts[m.model] += 1
            model_tokens[m.model] += m.tokens_generated

        # Routing decisions — model per task type
        routing: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for m in model_usage:
            routing[m.task_type][m.model] += 1

        return {
            "window_minutes": window_minutes,
            "total_requests": total_requests,
            "avg_latency_ms": round(avg_latency, 2),
            "error_rate": round(error_rate, 4),
            "error_count": error_count,
            "top_endpoints": [
                {"endpoint": ep, "count": cnt} for ep, cnt in top_endpoints
            ],
            "model_usage_breakdown": {
                model: {"requests": model_counts[model], "tokens": model_tokens[model]}
                for model in model_counts
            },
            "routing_decisions": {
                task: dict(models) for task, models in routing.items()
            },
            "recent_errors": errors[-20:],
            "system_resources": self.get_system_resources(),
        }

    def get_model_stats(self, window_minutes: int = 60) -> dict:
        """Return per-model statistics for the last *window_minutes* minutes."""
        cutoff = time.time() - (window_minutes * 60)

        with self._lock:
            usage = [m for m in self._model_usage if m.timestamp >= cutoff]

        stats: Dict[str, dict] = {}
        for m in usage:
            if m.model not in stats:
                stats[m.model] = {
                    "requests": 0,
                    "total_tokens": 0,
                    "total_latency_ms": 0.0,
                    "task_types": defaultdict(int),
                }
            s = stats[m.model]
            s["requests"] += 1
            s["total_tokens"] += m.tokens_generated
            s["total_latency_ms"] += m.latency_ms
            s["task_types"][m.task_type] += 1

        result: Dict[str, dict] = {}
        for model, s in stats.items():
            result[model] = {
                "requests": s["requests"],
                "total_tokens": s["total_tokens"],
                "avg_latency_ms": round(s["total_latency_ms"] / s["requests"], 2),
                "task_types": dict(s["task_types"]),
            }

        return {"window_minutes": window_minutes, "models": result}

    @staticmethod
    def get_system_resources() -> dict:
        """Return current CPU, RAM, and (optionally) GPU usage."""
        vm = psutil.virtual_memory()
        resources: dict = {
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "ram_used_gb": round(vm.used / (1024 ** 3), 2),
            "ram_total_gb": round(vm.total / (1024 ** 3), 2),
            "ram_percent": vm.percent,
        }

        # Attempt to read GPU / VRAM via pynvml
        try:
            import pynvml  # type: ignore[import-untyped]

            pynvml.nvmlInit()
            device_count = pynvml.nvmlDeviceGetCount()
            gpus: list = []
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode("utf-8")
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                gpus.append(
                    {
                        "index": i,
                        "name": name,
                        "vram_used_gb": round(mem_info.used / (1024 ** 3), 2),
                        "vram_total_gb": round(mem_info.total / (1024 ** 3), 2),
                        "vram_percent": round(
                            mem_info.used / mem_info.total * 100, 1
                        )
                        if mem_info.total > 0
                        else 0.0,
                        "gpu_util_percent": util.gpu,
                    }
                )
            pynvml.nvmlShutdown()
            resources["gpus"] = gpus
        except Exception:
            resources["gpus"] = []

        return resources


def get_metrics() -> MetricsCollector:
    """Convenience accessor for the global ``MetricsCollector`` singleton."""
    return MetricsCollector.get()
