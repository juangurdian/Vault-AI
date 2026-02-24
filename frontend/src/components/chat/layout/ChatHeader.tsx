"use client";

import { AnimatePresence } from "framer-motion";
import RoutingInfoPanel from "../RoutingInfoPanel";
import type { RoutingInfo } from "../types";
import { WifiOff, Sparkles, X } from "lucide-react";

type ChatHeaderProps = {
  routingInfo: RoutingInfo | null;
  currentModel: string | null;
  showRouting: boolean;
  onToggleRouting: () => void;
  offline: boolean;
  appMode: string;
};

const modeLabels: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  chat: { icon: <Sparkles className="h-3 w-3" />, color: "text-zinc-400", bg: "bg-white/[0.05]" },
  research: { icon: <Sparkles className="h-3 w-3" />, color: "text-amber-400", bg: "bg-amber-500/10" },
  code: { icon: <Sparkles className="h-3 w-3" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  image: { icon: <Sparkles className="h-3 w-3" />, color: "text-pink-400", bg: "bg-pink-500/10" },
  reasoning: { icon: <Sparkles className="h-3 w-3" />, color: "text-violet-400", bg: "bg-violet-500/10" },
};

export default function ChatHeader({
  routingInfo,
  currentModel,
  showRouting,
  onToggleRouting,
  offline,
  appMode,
}: ChatHeaderProps) {
  const mode = modeLabels[appMode] || modeLabels.chat;

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Offline warning */}
      <AnimatePresence>
        {offline && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
            <WifiOff className="h-4 w-4 text-amber-400" />
            <span className="font-medium">Offline</span>
            <span className="text-amber-400/70">Sending is disabled until you reconnect.</span>
          </div>
        )}
      </AnimatePresence>

      {/* Mode indicator */}
      <AnimatePresence>
        {appMode !== "chat" && (
          <div className={`flex items-center gap-2 rounded-lg ${mode.bg} border border-white/[0.06] px-3 py-1.5`}>
            <span className={`h-1.5 w-1.5 rounded-full ${mode.color.replace("text-", "bg-")}`} />
            <span className={`text-xs font-medium ${mode.color} capitalize`}>{appMode}</span>
            <span className="text-xs text-zinc-600">mode active</span>
          </div>
        )}
      </AnimatePresence>

      {/* Routing info */}
      <AnimatePresence>
        {routingInfo && (
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-xs text-zinc-500">
                Routing to <span className="text-indigo-300 font-medium">{routingInfo.model}</span>
              </span>
            </div>
            <button
              onClick={onToggleRouting}
              className="text-xs font-medium text-zinc-600 hover:text-indigo-400 transition-colors"
            >
              {showRouting ? "Hide" : "Show"} details
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* Routing details panel */}
      <AnimatePresence>
        {showRouting && routingInfo && (
          <div className="rounded-xl border border-white/[0.06] bg-[#121214] px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-zinc-400">Routing Decision</span>
              <button
                onClick={onToggleRouting}
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <RoutingInfoPanel info={routingInfo} previousModel={currentModel} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
