"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Globe, X, Search } from "lucide-react";

interface SearchProgressProps {
  query: string;
  reason?: string;
  isSearching: boolean;
  onDismiss?: () => void;
}

export function SearchProgress({
  query,
  reason,
  isSearching,
  onDismiss,
}: SearchProgressProps) {
  if (!isSearching) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="mx-4 mb-3"
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                className="relative h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-cyan-500/30"
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(34, 211, 238, 0.2)",
                    "0 0 20px 5px rgba(34, 211, 238, 0.1)",
                    "0 0 0 0 rgba(34, 211, 238, 0.2)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Search className="h-5 w-5 text-cyan-400" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <div className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
                  Searching the web...
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    •
                  </motion.span>
                </div>
                {reason && (
                  <div className="text-xs text-cyan-400/70 mt-0.5">
                    {reason}
                  </div>
                )}
              </div>
            </div>
            {onDismiss && (
              <motion.button
                onClick={onDismiss}
                className="p-2 hover:bg-cyan-500/20 rounded-xl transition-colors group"
                aria-label="Dismiss"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-4 w-4 text-cyan-400 group-hover:text-cyan-300" />
              </motion.button>
            )}
          </div>

          {/* Animated progress bar */}
          <div className="mt-4 h-1 bg-cyan-900/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 rounded-full"
              animate={{
                x: ["-100%", "100%"],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
