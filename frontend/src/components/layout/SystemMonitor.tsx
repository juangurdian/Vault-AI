"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, MemoryStick, Microchip, AlertTriangle, ChevronDown } from "lucide-react";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

type GpuStats = {
  available: boolean;
  name?: string;
  vram_total_mb?: number;
  vram_used_mb?: number;
  vram_free_mb?: number;
  gpu_utilization_pct?: number;
  temperature_c?: number;
  power_draw_w?: number;
  power_limit_w?: number;
};

type CpuRamStats = {
  cpu_utilization_pct?: number;
  ram_total_mb?: number;
  ram_used_mb?: number;
  ram_free_mb?: number;
  ram_utilization_pct?: number;
};

type RunningModel = {
  name: string;
  size_mb: number;
  vram_mb: number;
  cpu_ram_mb: number;
  fully_on_gpu: boolean;
};

type OllamaInfo = {
  ollama_on_gpu: boolean;
  running_models: RunningModel[];
};

type SystemStats = {
  gpu: GpuStats;
  cpu_ram: CpuRamStats;
  ollama: OllamaInfo;
  vram_spillover_mb: number;
};

function UsageBar({
  pct,
  colorClass,
  label,
  sublabel,
}: {
  pct: number;
  colorClass: string;
  label: string;
  sublabel?: string;
}) {
  const capped = Math.min(100, Math.max(0, pct));
  const danger = capped > 90;
  const warn = capped > 70;

  return (
    <div className="flex flex-col gap-0.5 min-w-[70px]">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</span>
        <span className={`text-[9px] font-mono ${danger ? "text-red-400" : warn ? "text-amber-400" : colorClass}`}>
          {Math.round(capped)}%
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={`h-full rounded-full ${danger ? "bg-red-500" : warn ? "bg-amber-500" : colorClass.replace("text-", "bg-")}`}
          style={{ width: `${capped}%` }}
        />
      </div>
      {sublabel && <span className="text-[8px] text-zinc-700 truncate max-w-[80px]">{sublabel}</span>}
    </div>
  );
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/system/stats`, { cache: "no-store" });
      if (res.ok) {
        const data: SystemStats = await res.json();
        setStats(data);
      }
    } catch {
      // backend may not be running
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) return null;

  const { gpu, cpu_ram, ollama, vram_spillover_mb } = stats;
  const gpuUsed = gpu.vram_used_mb ?? 0;
  const gpuTotal = gpu.vram_total_mb ?? 1;
  const vramPct = (gpuUsed / gpuTotal) * 100;
  const gpuUtil = gpu.gpu_utilization_pct ?? 0;
  const cpuPct = cpu_ram.cpu_utilization_pct ?? 0;
  const ramPct = cpu_ram.ram_utilization_pct ?? 0;
  const hasSpillover = vram_spillover_mb > 50;
  const ollamaOnGpu = ollama.ollama_on_gpu;

  return (
    <div className="flex items-center gap-1">
      {/* Compact inline bars */}
      <div className="hidden lg:flex items-center gap-3 border-r border-white/[0.06] pr-3 mr-1">
        {gpu.available && (
          <UsageBar
            pct={gpuUtil}
            colorClass="text-indigo-400"
            label="GPU"
            sublabel={`${Math.round(gpuUsed / 1024 * 10) / 10}GB`}
          />
        )}
        <UsageBar
          pct={cpuPct}
          colorClass="text-emerald-400"
          label="CPU"
        />
        <UsageBar
          pct={ramPct}
          colorClass="text-amber-400"
          label="RAM"
        />
      </div>

      {/* Status chip + expand button */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
      >
        {gpu.available ? (
          <span className={`w-1.5 h-1.5 rounded-full ${ollamaOnGpu ? "bg-indigo-400" : "bg-amber-400"}`} />
        ) : (
          <AlertTriangle className="h-3 w-3 text-amber-400" />
        )}

        <span className={`text-[10px] font-medium ${ollamaOnGpu ? "text-indigo-300" : gpu.available ? "text-amber-400" : "text-zinc-600"}`}>
          {!gpu.available ? "No GPU" : ollamaOnGpu ? "GPU" : "CPU"}
        </span>

        {hasSpillover && (
          <span className="text-[9px] text-amber-400 font-mono">
            +{Math.round(vram_spillover_mb / 1024 * 10) / 10}GB
          </span>
        )}

        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-3 w-3 text-zinc-600" />
        </motion.div>
      </button>

      {/* Expanded overlay panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="absolute bottom-10 right-4 z-50 w-72 rounded-xl border border-white/[0.08] bg-[#121214] p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-300">System</span>
            </div>

            <div className="flex flex-col gap-3">
              {/* GPU section */}
              {gpu.available && (
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Microchip className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[10px] font-medium text-indigo-300">GPU</span>
                    <span className="text-[9px] text-zinc-600 truncate ml-auto max-w-[120px]">{gpu.name}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-zinc-600">Utilization</span>
                        <span className="text-[9px] font-mono text-indigo-400">{Math.round(gpuUtil)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${gpuUtil}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-zinc-600">VRAM</span>
                        <span className="text-[9px] font-mono text-zinc-400">{Math.round(gpuUsed / 1024 * 10) / 10}/{Math.round(gpuTotal / 1024 * 10) / 10}GB</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/[0.05]">
                        <div 
                          className={`h-full rounded-full ${vramPct > 90 ? "bg-red-500" : vramPct > 75 ? "bg-amber-500" : "bg-indigo-500"}`}
                          style={{ width: `${vramPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {gpu.temperature_c != null && (
                    <div className="flex gap-3 mt-2">
                      <span className={`text-[9px] ${gpu.temperature_c > 85 ? "text-red-400" : "text-zinc-600"}`}>
                        {Math.round(gpu.temperature_c)}°C
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* CPU & RAM section */}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-medium text-emerald-300">CPU & RAM</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[9px] text-zinc-600">CPU</span>
                      <span className="text-[9px] font-mono text-emerald-400">{Math.round(cpuPct)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.05]">
                      <div 
                        className={`h-full rounded-full ${cpuPct > 90 ? "bg-red-500" : cpuPct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${cpuPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[9px] text-zinc-600">RAM</span>
                      <span className="text-[9px] font-mono text-amber-400">
                        {Math.round((cpu_ram.ram_used_mb ?? 0) / 1024 * 10) / 10}GB
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.05]">
                      <div 
                        className={`h-full rounded-full ${ramPct > 90 ? "bg-red-500" : ramPct > 70 ? "bg-amber-500" : "bg-amber-500"}`}
                        style={{ width: `${ramPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ollama section */}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-zinc-400">Ollama</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${ollamaOnGpu ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"}`}>
                    {ollamaOnGpu ? "GPU" : "CPU"}
                  </span>
                </div>

                {ollama.running_models.length === 0 ? (
                  <span className="text-[9px] text-zinc-700 italic">No models loaded</span>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {ollama.running_models.map((m) => (
                      <div key={m.name} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-zinc-400 font-mono truncate max-w-[140px]">{m.name}</span>
                          <span className={`text-[8px] ${m.fully_on_gpu ? "text-indigo-400" : "text-amber-400"}`}>
                            {m.fully_on_gpu ? "GPU" : "Partial"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
