"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore, AppMode } from "@/lib/stores/app";
import { useOffline } from "@/lib/hooks/useOffline";
import { useChatStore } from "@/lib/stores/chat";

type ModelInfo = {
  name: string;
  model_type: string;
  display_name: string;
  description: string;
  estimated_tokens_per_sec: number;
  is_available: boolean;
};

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

export default function Header() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const offline = useOffline();
  
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [routerStatus, setRouterStatus] = useState<"online" | "offline" | "checking">("checking");

  // Fetch models from API
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch(`${API_BASE}/models`);
        if (response.ok) {
          const data = await response.json();
          setModels(data.models || []);
          setRouterStatus("online");
        } else {
          setRouterStatus("offline");
        }
      } catch {
        setRouterStatus("offline");
      }
    }
    
    fetchModels();
    // Refresh every 30 seconds
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, []);

  const status = useMemo(
    () => [
      { 
        label: "Router", 
        state: routerStatus, 
        color: routerStatus === "online" ? "bg-emerald-400" : routerStatus === "checking" ? "bg-yellow-400" : "bg-red-400" 
      },
      { 
        label: "Network", 
        state: offline ? "offline" : "online", 
        color: offline ? "bg-amber-400" : "bg-emerald-400" 
      },
    ],
    [offline, routerStatus]
  );

  // Group models by type
  const modelsByType = useMemo(() => {
    const grouped: Record<string, ModelInfo[]> = {};
    for (const model of models) {
      if (!grouped[model.model_type]) {
        grouped[model.model_type] = [];
      }
      grouped[model.model_type].push(model);
    }
    return grouped;
  }, [models]);

  return (
    <header className="shrink-0 border-b border-slate-900/70 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Title + Status */}
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-50">Local AI Beast</h1>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {routerStatus === "online" 
                ? `${models.length} models available • LLM routing`
                : "Connecting to router..."}
            </p>
          </div>
          
          {/* Status indicators */}
          <div className="hidden items-center gap-2 sm:flex">
            {status.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] text-slate-300 ring-1 ring-slate-800"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Model selector */}
        <div className="flex items-center gap-2">
          <label className="hidden text-[10px] uppercase tracking-wider text-slate-500 sm:block">
            Model
          </label>
          <select
            className="min-w-[180px] rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-1 ring-transparent transition focus:ring-cyan-500"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="auto">Auto (Smart routing)</option>
            {Object.entries(modelsByType).map(([type, typeModels]) => (
              <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                {typeModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.display_name} — {m.estimated_tokens_per_sec}t/s
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Agent mode tabs */}
      <div className="mt-3 flex flex-wrap gap-2">
        {(["chat", "research", "code", "image"] as AppMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              mode === m
                ? "border-cyan-500 bg-cyan-500/20 text-cyan-100"
                : "border-slate-800 bg-slate-900/60 text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
            }`}
          >
            {m === "chat" ? "Chat" : m === "research" ? "Research" : m === "code" ? "Code" : "Image"}
          </button>
        ))}
      </div>
    </header>
  );
}
