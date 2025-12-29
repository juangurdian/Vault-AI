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

type HeaderProps = {
  onMenuClick?: () => void;
};

export default function Header({ onMenuClick }: HeaderProps = {}) {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const offline = useOffline();
  
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const smartRoutingEnabled = useChatStore((s) => s.smartRoutingEnabled);
  const setSmartRoutingEnabled = useChatStore((s) => s.setSmartRoutingEnabled);
  
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

  // Get the effective model (what will actually be used)
  const effectiveModel = smartRoutingEnabled ? "auto" : selectedModel;

  // Handle toggle change
  const handleToggle = () => {
    const newEnabled = !smartRoutingEnabled;
    setSmartRoutingEnabled(newEnabled);
    
    // When enabling smart routing, ensure model is set to auto
    if (newEnabled) {
      setSelectedModel("auto");
    } else if (selectedModel === "auto" && models.length > 0) {
      // When disabling, default to first available model if currently on auto
      setSelectedModel(models[0].name);
    }
  };

  return (
    <header className="shrink-0 border-b border-slate-900/70 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Menu button (mobile) + Title + Status */}
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden rounded p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-50">Local AI Beast</h1>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {routerStatus === "online" 
                ? `${models.length} models • ${smartRoutingEnabled ? "Smart routing" : "Manual mode"}`
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

        {/* Right: Smart routing toggle + Model selector */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Smart Routing Toggle */}
          <button
            onClick={handleToggle}
            className={`group flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2 sm:px-3 py-1.5 text-xs font-medium transition ${
              smartRoutingEnabled
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-slate-300"
            }`}
            title={smartRoutingEnabled ? "Smart routing is ON - AI selects the best model" : "Smart routing is OFF - You choose the model"}
          >
            {/* Toggle indicator */}
            <div className={`relative h-4 w-7 rounded-full transition-colors ${
              smartRoutingEnabled ? "bg-cyan-500" : "bg-slate-700"
            }`}>
              <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                smartRoutingEnabled ? "translate-x-3.5" : "translate-x-0.5"
              }`} />
            </div>
            <span className="hidden sm:inline">
              {smartRoutingEnabled ? "Smart" : "Manual"}
            </span>
            {/* Brain/Hand icon */}
            <span className="text-sm">
              {smartRoutingEnabled ? "🧠" : "✋"}
            </span>
          </button>

          {/* Model selector */}
          <div className="flex items-center gap-2">
            <select
              className={`min-w-[120px] sm:min-w-[160px] rounded-lg border px-2 sm:px-3 py-1.5 text-xs outline-none ring-1 ring-transparent transition focus:ring-cyan-500 ${
                smartRoutingEnabled
                  ? "cursor-not-allowed border-slate-800 bg-slate-900/50 text-slate-500"
                  : "border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-600"
              }`}
              value={effectiveModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={smartRoutingEnabled}
              aria-label="Select model"
            >
              {smartRoutingEnabled ? (
                <option value="auto">Auto (AI selects)</option>
              ) : (
                <>
                  {Object.entries(modelsByType).map(([type, typeModels]) => (
                    <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                      {typeModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.display_name} — {m.estimated_tokens_per_sec}t/s
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Agent mode tabs */}
      <div className="mt-3 flex flex-wrap items-center gap-2 overflow-x-auto">
        {(["chat", "research", "code", "image"] as AppMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`shrink-0 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition ${
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
