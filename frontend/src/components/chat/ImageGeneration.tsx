"use client";

import { useState, useEffect } from "react";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

type ImageGenStatus = {
  comfyui_available: boolean;
  comfyui_url: string;
  vision_model: string;
  message: string;
  setup_instructions?: string[];
};

type ImageGenProps = {
  prompt: string;
  onImageGenerated: (imageBase64: string) => void;
  onError: (error: string) => void;
  onStatusMessage?: (msg: string) => void;
};

export default function ImageGeneration({ prompt, onImageGenerated, onError, onStatusMessage }: ImageGenProps) {
  const [status, setStatus] = useState<ImageGenStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState("ugly, blurry, low quality, deformed");
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [steps, setSteps] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/image/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    onStatusMessage?.("Generating image...");

    try {
      const res = await fetch(`${API_BASE}/image/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          width,
          height,
          steps,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        onError(`Image generation failed: ${err}`);
        return;
      }

      const data = await res.json();
      if (data.images && data.images.length > 0) {
        onImageGenerated(data.images[0]);
      } else {
        onError("No images returned");
      }
    } catch (err) {
      onError(`Image generation error: ${String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  if (!status) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="h-8 animate-pulse rounded bg-slate-800/80" />
      </div>
    );
  }

  if (!status.comfyui_available) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <h4 className="mb-2 text-sm font-semibold text-amber-300">ComfyUI Not Available</h4>
        <p className="mb-3 text-xs text-amber-200/70">{status.message}</p>
        {status.setup_instructions && (
          <div className="space-y-1.5">
            {status.setup_instructions.map((step, i) => (
              <p key={i} className="text-xs text-slate-400">{step}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-200">Image Generation</h4>
        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
          ComfyUI Ready
        </span>
      </div>

      <p className="text-xs text-slate-400 truncate">Prompt: {prompt}</p>

      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[10px] text-cyan-400 hover:text-cyan-300"
      >
        {showAdvanced ? "Hide" : "Show"} advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div>
            <label className="mb-1 block text-[10px] text-slate-500">Negative Prompt</label>
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">Width</label>
              <select
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                {[256, 384, 512, 640, 768, 1024].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">Height</label>
              <select
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                {[256, 384, 512, 640, 768, 1024].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-slate-500">Steps</label>
              <input
                type="number"
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                min={1}
                max={100}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate Image"}
      </button>
    </div>
  );
}
