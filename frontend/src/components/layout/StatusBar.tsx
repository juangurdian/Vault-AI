"use client";

import { useEffect, useState, useCallback } from "react";
import { useChatStore } from "@/lib/stores/chat";
import { useAppStore } from "@/lib/stores/app";
import { Cpu, Zap, Activity, Brain, Loader2 } from "lucide-react";
import SystemMonitor from "./SystemMonitor";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

type OllamaStatus = "checking" | "online" | "offline";

type HealthData = {
  status: string;
  models_available: number;
  llm_routing_enabled: boolean;
  routing_model: string;
};

export default function StatusBar() {
  const selectedModel = useChatStore((s) => s.selectedModel);
  const smartRoutingEnabled = useChatStore((s) => s.smartRoutingEnabled);
  const appMode = useAppStore((s) => s.mode);
  const isGenerating = useChatStore((s) => s.isGenerating);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("checking");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch("http://localhost:8001/health", { cache: "no-store" });
      const end = performance.now();
      setLatency(Math.round(end - start));

      if (res.ok) {
        const data: HealthData = await res.json();
        setHealthData(data);
        setOllamaStatus("online");
      } else {
        setOllamaStatus("offline");
        setHealthData(null);
      }
    } catch {
      setOllamaStatus("offline");
      setHealthData(null);
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const modeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    chat: { icon: <Zap className="h-3 w-3" />, color: "text-zinc-400", label: "Chat" },
    research: { icon: <Activity className="h-3 w-3" />, color: "text-amber-400", label: "Research" },
    code: { icon: <Cpu className="h-3 w-3" />, color: "text-emerald-400", label: "Code" },
    image: { icon: <Brain className="h-3 w-3" />, color: "text-pink-400", label: "Vision" },
    reasoning: { icon: <Brain className="h-3 w-3" />, color: "text-violet-400", label: "Reasoning" },
  };

  const activeModel = smartRoutingEnabled
    ? healthData?.routing_model || "auto"
    : selectedModel;

  const mode = modeConfig[appMode] || modeConfig.chat;

  return (
    <div className="shrink-0 flex items-center justify-between gap-3 border-t border-white/[0.06] bg-[#09090b] px-4 py-2 text-[11px]">
      {/* Left: Ollama health */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />
          ) : (
            <span className={`h-2 w-2 rounded-full ${
              ollamaStatus === "online" ? "bg-emerald-500" : ollamaStatus === "checking" ? "bg-amber-500" : "bg-red-500"
            }`} />
          )}

          <div className="flex flex-col">
            <span className="text-zinc-600 text-[10px]">Ollama</span>
            <span
              className={
                ollamaStatus === "online"
                  ? "text-emerald-400 font-medium"
                  : ollamaStatus === "checking"
                  ? "text-amber-400"
                  : "text-red-400"
              }
            >
              {ollamaStatus === "online" ? "Online" : ollamaStatus === "checking" ? "Connecting..." : "Offline"}
            </span>
          </div>
        </div>

        {healthData && (
          <span className="hidden items-center gap-1.5 sm:flex text-zinc-600">
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>{healthData.models_available} models</span>
          </span>
        )}

        {latency && (
          <span className="hidden items-center gap-1.5 lg:flex text-zinc-600">
            <span className="w-1 h-1 rounded-full bg-zinc-700" />
            <span>{latency}ms</span>
          </span>
        )}
      </div>

      {/* Center: Active mode */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] ${mode.color}`}>
          {mode.icon}
          <span className="font-medium">{mode.label}</span>
          {isGenerating && (
            <span className="ml-0.5 animate-pulse">•</span>
          )}
        </div>
      </div>

      {/* Right: System monitor + Model info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-zinc-600">Model:</span>
          <span className="font-mono text-indigo-300/80 truncate max-w-[100px] sm:max-w-[140px]">
            {activeModel}
          </span>
          {smartRoutingEnabled && (
            <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-medium text-indigo-400 border border-indigo-500/20">
              AI
            </span>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-zinc-700">|</span>
          <SystemMonitor />
        </div>
      </div>
    </div>
  );
}
