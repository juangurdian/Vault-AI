"use client";

import { useState } from "react";

type ResearchProgressProps = {
  step: number;
  total: number;
  message: string;
  findings?: Array<{ title: string; url: string; snippet: string }>;
  sources?: string[];
  isComplete?: boolean;
  onCancel?: () => void;
  onDismiss?: () => void;
};

export default function ResearchProgress({
  step,
  total,
  message,
  findings = [],
  sources = [],
  isComplete = false,
  onCancel,
  onDismiss,
}: ResearchProgressProps) {
  const [showDetails, setShowDetails] = useState(false);

  const progressPercent = (step / total) * 100;

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isComplete && (
            <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          )}
          <span className="text-sm font-semibold text-cyan-300">
            {isComplete ? "Research Complete" : "Research in Progress"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <span className="text-xs text-slate-400">
              Step {step} of {total}
            </span>
          )}
          {!isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="ml-2 rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              title="Cancel research"
            >
              ✕ Cancel
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="ml-2 rounded px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-300 transition-colors"
              title="Dismiss progress"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Current step message */}
      <p className="mb-3 text-sm text-slate-300">{message}</p>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mb-2 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            {showDetails ? "▼" : "▶"} {findings.length} sources found
          </button>
          {showDetails && (
            <div className="space-y-2">
              {findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="rounded border border-slate-800 bg-slate-900/50 p-2 text-xs"
                >
                  <a
                    href={finding.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-cyan-400 hover:underline"
                  >
                    {finding.title}
                  </a>
                  <p className="mt-1 line-clamp-2 text-slate-400">{finding.snippet}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sources list */}
      {sources.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-400">Sources:</p>
          <ul className="space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className="text-xs">
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline"
                >
                  {idx + 1}. {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isComplete && (
        <div className="mt-3 rounded border border-green-500/30 bg-green-500/5 p-2 text-xs text-green-300">
          ✓ Research complete
        </div>
      )}
    </div>
  );
}


