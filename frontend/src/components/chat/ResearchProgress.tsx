"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, ChevronDown, ChevronUp, ExternalLink, Check, Loader2 } from "lucide-react";

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
    <motion.div
      className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.08] to-amber-500/[0.02] p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center ring-1 ring-amber-500/30"
            animate={!isComplete ? {
              boxShadow: [
                "0 0 0 0 rgba(245, 158, 11, 0.2)",
                "0 0 20px 5px rgba(245, 158, 11, 0.1)",
                "0 0 0 0 rgba(245, 158, 11, 0.2)",
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isComplete ? (
              <Check className="h-5 w-5 text-emerald-400" />
            ) : (
              <Brain className="h-5 w-5 text-amber-400" />
            )}
          </motion.div>
          <div>
            <span className={`text-sm font-semibold ${isComplete ? "text-emerald-400" : "text-amber-300"}`}>
              {isComplete ? "Research Complete" : "Research in Progress"}
            </span>
            {!isComplete && (
              <p className="text-xs text-slate-500">Step {step} of {total}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isComplete && onCancel && (
            <motion.button
              onClick={onCancel}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1"
              title="Cancel research"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="h-3 w-3" />
              Cancel
            </motion.button>
          )}
          {onDismiss && (
            <motion.button
              onClick={onDismiss}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors"
              title="Dismiss progress"
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Current step message */}
      <div className="flex items-center gap-2 mb-4">
        {!isComplete && (
          <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
        )}
        <p className="text-sm text-slate-300">{message}</p>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div className="mb-4">
          <motion.button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            whileHover={{ x: 2 }}
          >
            <motion.div
              animate={{ rotate: showDetails ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.div>
            {findings.length} sources found
          </motion.button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                className="mt-3 space-y-2"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                {findings.map((finding, idx) => (
                  <motion.div
                    key={idx}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ x: 4, borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <a
                      href={finding.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                    >
                      {finding.title}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <p className="mt-1.5 line-clamp-2 text-slate-400">{finding.snippet}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Sources list */}
      {sources.length > 0 && (
        <div className="mt-4 border-t border-white/[0.04] pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-400 flex items-center gap-1">
            <Brain className="h-3 w-3" />
            Sources:
          </p>
          <ul className="space-y-1">
            {sources.map((source, idx) => (
              <li key={idx} className="text-xs">
                <a
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400/80 hover:text-cyan-300 transition-colors"
                >
                  {idx + 1}. {source}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Complete indicator */}
      {isComplete && (
        <motion.div
          className="mt-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-3 text-xs text-emerald-300 flex items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Check className="h-4 w-4 text-emerald-400" />
          <span className="font-medium">Research complete - {sources.length} sources analyzed</span>
        </motion.div>
      )}
    </motion.div>
  );
}
