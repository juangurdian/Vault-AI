"use client";

import type { RoutingInfo } from "./types";

type RoutingInfoPanelProps = {
  info: RoutingInfo;
  previousModel?: string | null;
};

export default function RoutingInfoPanel({ info, previousModel }: RoutingInfoPanelProps) {
  const packing = info.packing;
  const modelMeta = info.model_meta;
  const isModelSwitch = previousModel && previousModel !== info.model;

  return (
    <div className="mb-3 rounded-2xl border border-slate-900/70 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 shadow-inner shadow-slate-950/30">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Routing</p>
        <span className="text-[10px] text-slate-500">
          {info.processing_time_ms ?? 0}ms
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
          {info.model}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${
          info.routing_method === "llm" 
            ? "bg-cyan-500/20 text-cyan-300" 
            : info.routing_method === "cached"
            ? "bg-purple-500/20 text-purple-300"
            : "bg-slate-800 text-slate-400"
        }`}>
          {info.routing_method === "llm" ? "LLM routed" : 
           info.routing_method === "cached" ? "Cached" :
           info.routing_method === "manual_override" ? "Manual" : "Regex"}
        </span>
        {info.task_type && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            {info.task_type}
          </span>
        )}
        {typeof info.confidence === "number" && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
            Confidence {(info.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {info.reasoning && (
        <p className="mt-2 text-xs text-slate-400 line-clamp-2">{info.reasoning}</p>
      )}
      {info.warning && (
        <p className="mt-1 text-[10px] text-amber-400">{info.warning}</p>
      )}
      {info.classification_details?.reasoning && (
        <p className="mt-1 text-[10px] text-slate-500">
          {info.classification_details.reasoning}
        </p>
      )}
      {packing && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
          <div className="rounded bg-slate-900/70 px-2 py-1">
            <span className="text-slate-500">Kept</span> {packing.tokens_kept ?? 0}
          </div>
          <div className="rounded bg-slate-900/70 px-2 py-1">
            <span className="text-slate-500">Dropped</span> {packing.tokens_dropped ?? 0}
          </div>
          <div className="rounded bg-slate-900/70 px-2 py-1">
            <span className="text-slate-500">Window</span> {packing.context_window ?? "?"}
          </div>
          {packing.used_summary && (
            <div className="rounded bg-slate-900/70 px-2 py-1">
              <span className="text-slate-500">Summary</span> {packing.summary_tokens ?? 0} tok
            </div>
          )}
        </div>
      )}
      {modelMeta && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
          {typeof modelMeta.estimated_vram_gb !== "undefined" && (
            <div className="rounded bg-slate-900/70 px-2 py-1">
              <span className="text-slate-500">VRAM</span> ~{modelMeta.estimated_vram_gb} GB
            </div>
          )}
          {typeof modelMeta.context_window !== "undefined" && (
            <div className="rounded bg-slate-900/70 px-2 py-1">
              <span className="text-slate-500">Ctx</span> {modelMeta.context_window}
            </div>
          )}
          {typeof modelMeta.estimated_tokens_per_sec !== "undefined" && (
            <div className="rounded bg-slate-900/70 px-2 py-1">
              <span className="text-slate-500">Speed</span> {modelMeta.estimated_tokens_per_sec} t/s
            </div>
          )}
        </div>
      )}
      {isModelSwitch && (
        <p className="mt-2 text-[11px] text-amber-300">
          Model switched from {previousModel} → {info.model}
        </p>
      )}
      {!isModelSwitch && previousModel && (
        <p className="mt-2 text-[11px] text-slate-500">Model steady: {info.model}</p>
      )}
    </div>
  );
}

