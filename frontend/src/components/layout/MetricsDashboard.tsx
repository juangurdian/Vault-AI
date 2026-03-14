"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Activity,
  Cpu,
  MemoryStick,
  MonitorDot,
  AlertTriangle,
  BarChart3,
  RefreshCw,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GpuInfo {
  index: number;
  name: string;
  vram_used_gb: number;
  vram_total_gb: number;
  vram_percent: number;
  gpu_util_percent: number;
}

interface SystemResources {
  cpu_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  gpus: GpuInfo[];
}

interface EndpointStat {
  endpoint: string;
  count: number;
}

interface ModelUsageEntry {
  requests: number;
  tokens: number;
}

interface ErrorEntry {
  endpoint: string;
  error_type: string;
  message: string;
  timestamp: number;
}

interface MetricsSummary {
  window_minutes: number;
  total_requests: number;
  avg_latency_ms: number;
  error_rate: number;
  error_count: number;
  top_endpoints: EndpointStat[];
  model_usage_breakdown: Record<string, ModelUsageEntry>;
  routing_decisions: Record<string, Record<string, number>>;
  recent_errors: ErrorEntry[];
  system_resources: SystemResources;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressBar({
  percent,
  color = "bg-blue-500",
}: {
  percent: number;
  color?: string;
}) {
  return (
    <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-800 text-zinc-400">
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function ModelBarChart({
  breakdown,
}: {
  breakdown: Record<string, ModelUsageEntry>;
}) {
  const entries = Object.entries(breakdown).sort(
    (a, b) => b[1].requests - a[1].requests
  );
  const maxRequests = entries.length > 0 ? entries[0][1].requests : 1;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">No model usage recorded.</p>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([model, stats]) => (
        <div key={model}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-300 truncate max-w-[60%]">{model}</span>
            <span className="text-zinc-500">
              {stats.requests} reqs / {stats.tokens.toLocaleString()} tokens
            </span>
          </div>
          <ProgressBar
            percent={(stats.requests / maxRequests) * 100}
            color="bg-indigo-500"
          />
        </div>
      ))}
    </div>
  );
}

function ErrorList({ errors }: { errors: ErrorEntry[] }) {
  if (errors.length === 0) {
    return (
      <p className="text-sm text-zinc-500 italic">
        No recent errors. All systems operational.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
      {[...errors].reverse().map((err, i) => (
        <div
          key={`${err.timestamp}-${i}`}
          className="rounded-lg bg-red-950/30 border border-red-900/40 p-3 text-sm"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="font-medium text-red-300">{err.error_type}</span>
            <span className="ml-auto text-xs text-zinc-600">
              {new Date(err.timestamp * 1000).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-zinc-400 text-xs">
            {err.endpoint} &mdash; {err.message}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

interface MetricsDashboardProps {
  open: boolean;
  onClose: () => void;
}

export default function MetricsDashboard({
  open,
  onClose,
}: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [system, setSystem] = useState<SystemResources | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, systemRes] = await Promise.all([
        fetch(`${API_BASE}/monitoring/metrics`),
        fetch(`${API_BASE}/monitoring/system`),
      ]);

      if (!metricsRes.ok || !systemRes.ok) {
        throw new Error("Failed to fetch monitoring data");
      }

      const [metricsData, systemData] = await Promise.all([
        metricsRes.json(),
        systemRes.json(),
      ]);

      setMetrics(metricsData);
      setSystem(systemData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 5 seconds when the panel is open
  useEffect(() => {
    if (!open) return;

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [open, fetchData]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const res = system ?? metrics?.system_resources;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-zinc-950 border-l border-zinc-800 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 200 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
              <div className="flex items-center gap-2">
                <Activity size={20} className="text-indigo-400" />
                <h2 className="text-lg font-semibold text-zinc-100">
                  System Monitor
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors disabled:opacity-40"
                  title="Refresh now"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-8">
              {/* Error banner */}
              {error && (
                <div className="rounded-lg bg-red-950/40 border border-red-800/50 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* ---- System Resources ---- */}
              <section>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  System Resources
                </h3>

                {res ? (
                  <div className="space-y-4">
                    {/* CPU */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Cpu size={14} /> CPU
                        </span>
                        <span className="text-zinc-500">
                          {res.cpu_percent.toFixed(1)}%
                        </span>
                      </div>
                      <ProgressBar
                        percent={res.cpu_percent}
                        color={
                          res.cpu_percent > 90
                            ? "bg-red-500"
                            : res.cpu_percent > 70
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }
                      />
                    </div>

                    {/* RAM */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <MemoryStick size={14} /> RAM
                        </span>
                        <span className="text-zinc-500">
                          {res.ram_used_gb} / {res.ram_total_gb} GB (
                          {res.ram_percent}%)
                        </span>
                      </div>
                      <ProgressBar
                        percent={res.ram_percent}
                        color={
                          res.ram_percent > 90
                            ? "bg-red-500"
                            : res.ram_percent > 70
                            ? "bg-amber-500"
                            : "bg-sky-500"
                        }
                      />
                    </div>

                    {/* GPUs */}
                    {res.gpus.map((gpu) => (
                      <div key={gpu.index}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <MonitorDot size={14} /> {gpu.name}
                          </span>
                          <span className="text-zinc-500">
                            {gpu.vram_used_gb} / {gpu.vram_total_gb} GB VRAM (
                            {gpu.vram_percent}%)
                          </span>
                        </div>
                        <ProgressBar
                          percent={gpu.vram_percent}
                          color={
                            gpu.vram_percent > 90
                              ? "bg-red-500"
                              : gpu.vram_percent > 70
                              ? "bg-amber-500"
                              : "bg-violet-500"
                          }
                        />
                        <p className="text-xs text-zinc-600 mt-1">
                          GPU utilisation: {gpu.gpu_util_percent}%
                        </p>
                      </div>
                    ))}

                    {res.gpus.length === 0 && (
                      <p className="text-xs text-zinc-600 italic">
                        No GPU detected.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Loading...</p>
                )}
              </section>

              {/* ---- Request Metrics ---- */}
              <section>
                <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  Request Metrics
                </h3>

                {metrics ? (
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      label="Total Requests"
                      value={metrics.total_requests.toLocaleString()}
                      icon={<Activity size={18} />}
                    />
                    <StatCard
                      label="Avg Latency"
                      value={`${metrics.avg_latency_ms.toFixed(1)} ms`}
                      icon={<RefreshCw size={18} />}
                    />
                    <StatCard
                      label="Error Rate"
                      value={`${(metrics.error_rate * 100).toFixed(2)}%`}
                      icon={<AlertTriangle size={18} />}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600">Loading...</p>
                )}
              </section>

              {/* ---- Model Usage ---- */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  <BarChart3 size={14} /> Model Usage
                </h3>

                {metrics ? (
                  <ModelBarChart breakdown={metrics.model_usage_breakdown} />
                ) : (
                  <p className="text-sm text-zinc-600">Loading...</p>
                )}
              </section>

              {/* ---- Recent Errors ---- */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  <AlertTriangle size={14} /> Recent Errors
                </h3>

                {metrics ? (
                  <ErrorList errors={metrics.recent_errors} />
                ) : (
                  <p className="text-sm text-zinc-600">Loading...</p>
                )}
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
