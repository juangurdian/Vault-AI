"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  HardDrive,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Monitor,
  Zap,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface HardwareInfo {
  cpu_name: string;
  cpu_cores: number;
  ram_total_gb: number;
  ram_available_gb: number;
  has_gpu: boolean;
  gpus: Array<{
    name: string;
    vram_total_gb: number;
    vram_free_gb: number;
    vendor: string;
  }>;
  total_vram_gb: number;
  tier: string;
  tier_description: string;
}

interface ModelRecommendation {
  name: string;
  purpose: string;
  pull_priority: number;
  size_gb: number;
  vram_gb: number;
  description: string;
}

interface Recommendations {
  tier: string;
  tier_description: string;
  models: ModelRecommendation[];
}

type Step = "detect" | "recommend" | "pull" | "complete";

export default function SetupWizard({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("detect");
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pulledModels, setPulledModels] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Step 1: Detect hardware
  useEffect(() => {
    if (step === "detect") {
      detectHardware();
    }
  }, [step]);

  async function detectHardware() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/setup/hardware`);
      const data = await res.json();
      setHardware(data);

      // Auto-fetch recommendations
      const recRes = await fetch(
        `${API_BASE}/api/setup/recommendations?tier=${data.tier}`
      );
      const recData = await recRes.json();
      setRecommendations(recData);

      // Pre-select priority 1-2 models
      const preSelected = new Set<string>();
      for (const m of recData.models) {
        if (m.pull_priority <= 2) preSelected.add(m.name);
      }
      setSelectedModels(preSelected);
    } catch (e) {
      setError("Could not connect to backend. Is it running?");
    }
    setLoading(false);
  }

  async function pullModel(modelName: string) {
    setPullingModel(modelName);
    try {
      const res = await fetch(`${API_BASE}/api/setup/pull-model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: modelName }),
      });
      const data = await res.json();
      if (data.success) {
        setPulledModels((prev) => new Set([...prev, modelName]));
      }
    } catch {
      setError(`Failed to pull ${modelName}`);
    }
    setPullingModel(null);
  }

  async function pullSelectedModels() {
    setStep("pull");
    const sorted = Array.from(selectedModels).sort((a, b) => {
      const aModel = recommendations?.models.find((m) => m.name === a);
      const bModel = recommendations?.models.find((m) => m.name === b);
      return (aModel?.pull_priority || 99) - (bModel?.pull_priority || 99);
    });

    for (const model of sorted) {
      await pullModel(model);
    }
  }

  async function completeSetup() {
    try {
      await fetch(`${API_BASE}/api/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hardware_tier: hardware?.tier }),
      });
    } catch {}
    onComplete();
  }

  const tierColors: Record<string, string> = {
    minimal: "text-amber-400",
    standard: "text-blue-400",
    performance: "text-purple-400",
    ultra: "text-emerald-400",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-xl shadow-2xl"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-100">
            Welcome to Vault-AI
          </h1>
          <p className="mt-2 text-zinc-400">
            Let's set up your local AI environment
          </p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {(["detect", "recommend", "pull", "complete"] as Step[]).map(
            (s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    step === s
                      ? "bg-blue-500 ring-2 ring-blue-500/30"
                      : (["detect", "recommend", "pull", "complete"] as Step[]).indexOf(step) > i
                      ? "bg-emerald-500"
                      : "bg-zinc-700"
                  }`}
                />
                {i < 3 && (
                  <div className="h-px w-8 bg-zinc-700" />
                )}
              </div>
            )
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Hardware Detection */}
          {step === "detect" && (
            <motion.div
              key="detect"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                  <p className="text-zinc-400">Detecting your hardware...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-red-400">{error}</p>
                  <button
                    onClick={detectHardware}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
                  >
                    Retry
                  </button>
                </div>
              ) : hardware ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Cpu className="h-5 w-5 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {hardware.cpu_name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {hardware.cpu_cores} cores
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-5 w-5 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {hardware.ram_total_gb} GB RAM
                        </p>
                        <p className="text-xs text-zinc-500">
                          {hardware.ram_available_gb} GB available
                        </p>
                      </div>
                    </div>
                    {hardware.has_gpu && hardware.gpus.map((gpu, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Monitor className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm font-medium text-zinc-200">
                            {gpu.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {gpu.vram_total_gb} GB VRAM ({gpu.vram_free_gb} GB free)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <Zap className={`h-5 w-5 ${tierColors[hardware.tier] || "text-zinc-400"}`} />
                    <span className={`text-sm font-semibold ${tierColors[hardware.tier] || "text-zinc-200"}`}>
                      {hardware.tier.toUpperCase()} Tier
                    </span>
                    <span className="text-xs text-zinc-500">
                      — {hardware.tier_description}
                    </span>
                  </div>
                  <button
                    onClick={() => setStep("recommend")}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-500 transition"
                  >
                    View Recommended Models
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Step 2: Model Recommendations */}
          {step === "recommend" && recommendations && (
            <motion.div
              key="recommend"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm text-zinc-400 text-center">
                Select models to download. Higher priority models are recommended.
              </p>
              <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                {recommendations.models.map((model) => (
                  <label
                    key={model.name}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedModels.has(model.name)}
                      onChange={(e) => {
                        const next = new Set(selectedModels);
                        if (e.target.checked) next.add(model.name);
                        else next.delete(model.name);
                        setSelectedModels(next);
                      }}
                      className="rounded border-zinc-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">
                          {model.name}
                        </span>
                        <span className="text-[10px] rounded bg-white/5 px-1.5 py-0.5 text-zinc-500">
                          {model.purpose}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {model.description} — {model.size_gb} GB download, ~{model.vram_gb} GB VRAM
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("detect")}
                  className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm text-zinc-400 hover:bg-white/5 transition"
                >
                  Back
                </button>
                <button
                  onClick={pullSelectedModels}
                  disabled={selectedModels.size === 0}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40 transition"
                >
                  Download {selectedModels.size} Model{selectedModels.size !== 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => setStep("complete")}
                  className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5 transition"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Pulling Models */}
          {step === "pull" && (
            <motion.div
              key="pull"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <p className="text-sm text-zinc-400 text-center">
                Downloading models...
              </p>
              <div className="space-y-2">
                {Array.from(selectedModels).map((model) => (
                  <div
                    key={model}
                    className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
                  >
                    {pulledModels.has(model) ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : pullingModel === model ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" />
                    ) : (
                      <Download className="h-5 w-5 text-zinc-600 shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        pulledModels.has(model)
                          ? "text-zinc-300"
                          : pullingModel === model
                          ? "text-blue-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {model}
                    </span>
                  </div>
                ))}
              </div>
              {!pullingModel && pulledModels.size > 0 && (
                <button
                  onClick={() => setStep("complete")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white hover:bg-emerald-500 transition"
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          )}

          {/* Step 4: Complete */}
          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <CheckCircle className="h-12 w-12 text-emerald-400" />
              <h2 className="text-xl font-bold text-zinc-100">
                You're all set!
              </h2>
              <p className="text-sm text-zinc-400 text-center max-w-sm">
                Vault-AI is ready to use. You can change models and settings
                anytime from the settings panel.
              </p>
              <button
                onClick={completeSetup}
                className="mt-4 rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white hover:bg-blue-500 transition"
              >
                Start Using Vault-AI
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
