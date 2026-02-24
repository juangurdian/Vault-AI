"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, Globe, Link2 } from "lucide-react";
import type { SearchResult } from "@/lib/api/chat";

interface SearchSourcesProps {
  results: SearchResult[];
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

export function SearchSources({
  results,
  isCollapsible = true,
  defaultExpanded = false,
}: SearchSourcesProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!results || results.length === 0) return null;

  return (
    <motion.div
      className="mx-4 mb-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div className="bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] rounded-xl overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <motion.button
          onClick={() => isCollapsible && setIsExpanded(!isExpanded)}
          className={`
            w-full flex items-center justify-between p-4
            ${isCollapsible ? "hover:bg-white/[0.03] cursor-pointer" : ""}
          `}
          disabled={!isCollapsible}
          whileHover={isCollapsible ? { x: 2 } : {}}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-cyan-500/30">
              <Globe className="h-4 w-4 text-cyan-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-200">
                Web Sources
              </span>
              <span className="ml-2 text-xs text-cyan-400/80 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                {results.length}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              via {results[0]?.source || "web"}
            </span>
          </div>
          {isCollapsible && (
            <motion.div
              className="text-slate-400"
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          )}
        </motion.button>

        {/* Expanded content */}
        <AnimatePresence>
          {(isExpanded || !isCollapsible) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/[0.04] divide-y divide-white/[0.04]">
                {results.map((result, index) => (
                  <motion.a
                    key={index}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-white/[0.03] transition-colors group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-start gap-3">
                      <motion.span
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 text-cyan-400 text-xs flex items-center justify-center font-semibold ring-1 ring-cyan-500/20"
                        whileHover={{ scale: 1.1 }}
                      >
                        {index + 1}
                      </motion.span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                            {result.title}
                          </h4>
                          <ExternalLink className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {result.snippet}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Link2 className="h-3 w-3 text-slate-600" />
                          <span className="text-[10px] text-slate-500">
                            {new URL(result.url).hostname}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
