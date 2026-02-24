"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useOffline } from "@/lib/hooks/useOffline";
import { useChatStore } from "@/lib/stores/chat";
import { Sparkles, Brain, Hand, Menu } from "lucide-react";

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
        const url = smartRoutingEnabled
          ? `${API_BASE}/models`
          : `${API_BASE}/models?include_all=true`;
        const response = await fetch(url);
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
    const interval = setInterval(fetchModels, 30000);
    return () => clearInterval(interval);
  }, [smartRoutingEnabled]);

  const status = useMemo(
    () => [
      {
        label: "Router",
        state: routerStatus,
        color: routerStatus === "online" ? "bg-emerald-500" : routerStatus === "checking" ? "bg-amber-500" : "bg-red-500",
      },
      {
        label: "Network",
        state: offline ? "offline" : "online",
        color: offline ? "bg-amber-500" : "bg-emerald-500",
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

  const effectiveModel = smartRoutingEnabled ? "auto" : selectedModel;

  const handleToggle = () => {
    const newEnabled = !smartRoutingEnabled;
    setSmartRoutingEnabled(newEnabled);
    if (newEnabled) {
      setSelectedModel("auto");
    } else if (selectedModel === "auto" && models.length > 0) {
      setSelectedModel(models[0].name);
    }
  };

  return (
    <header className="shrink-0 border-b border-white/[0.06] bg-[#09090b] px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Menu button + Logo + Status */}
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="md:hidden rounded-lg p-2 text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>

            <div>
              <h1 className="text-lg font-semibold text-white">
                BeastAI
              </h1>
              <p className="text-[11px] text-zinc-600">
                {routerStatus === "online"
                  ? `${models.length} models • ${smartRoutingEnabled ? "Smart" : "Manual"}`
                  : "Connecting..."}
              </p>
            </div>
          </div>

          {/* Status indicators */}
          <div className="hidden items-center gap-3 sm:flex">
            {status.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1 text-[11px] text-zinc-500 border border-white/[0.06]"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${item.color}`} />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Smart routing toggle + Model selector */}
        <div className="flex items-center gap-3">
          {/* Smart Routing Toggle */}
          <button
            onClick={handleToggle}
            className={`
              group relative flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all
              ${smartRoutingEnabled
                ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                : "bg-white/5 text-zinc-500 border border-white/[0.06] hover:bg-white/[0.08]"
              }
            `}
          >
            {/* Toggle track */}
            <div className={`
              relative h-4 w-7 rounded-full transition-colors
              ${smartRoutingEnabled ? "bg-indigo-500" : "bg-zinc-700"}
            `}>
              <motion.div
                className="absolute top-0.5 h-3 w-3 rounded-full bg-white"
                animate={{ x: smartRoutingEnabled ? 14 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>

            <span className="hidden sm:inline">
              {smartRoutingEnabled ? "Smart" : "Manual"}
            </span>

            {smartRoutingEnabled ? (
              <Brain className="h-3.5 w-3.5" />
            ) : (
              <Hand className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Model selector */}
          <div className="relative">
            <div className={`
              min-w-[140px] sm:min-w-[180px] rounded-lg border bg-white/5 px-3 py-2 text-xs
              ${smartRoutingEnabled
                ? "cursor-not-allowed border-white/[0.04] text-zinc-600"
                : "border-white/[0.08] text-zinc-300 hover:border-white/[0.12]"
              }
            `}>
              {smartRoutingEnabled ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-indigo-300/80">Auto</span>
                </div>
              ) : (
                <select
                  className="w-full appearance-none bg-transparent text-xs outline-none cursor-pointer"
                  value={effectiveModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={smartRoutingEnabled}
                >
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
              )}
            </div>

            {/* Dropdown arrow */}
            {!smartRoutingEnabled && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
