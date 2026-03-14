"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MessageList from "../MessageList";
import ResearchProgress from "../ResearchProgress";
import { SearchProgress } from "../SearchProgress";
import { SearchSources } from "../SearchSources";
import ArtifactPanel from "@/components/artifacts/ArtifactPanel";
import { extractArtifacts } from "@/lib/artifacts";
import type { Message } from "../types";
import type { SearchResult } from "@/lib/api/chat";

type ChatBodyProps = {
  messages: Message[];
  isGenerating: boolean;
  toolMode?: string;
  modelUsed: string | null;
  searchQuery: string;
  searchReason: string;
  isSearching: boolean;
  onDismissSearch: () => void;
  searchResults: SearchResult[];
  researchProgress: {
    step: number;
    total: number;
    message: string;
    findings: Array<{ title: string; url: string; snippet: string }>;
    sources: string[];
    isComplete: boolean;
  } | null;
  onCancelResearch: () => void;
  onDismissResearch: () => void;
};

export default function ChatBody({
  messages,
  isGenerating,
  toolMode,
  modelUsed,
  searchQuery,
  searchReason,
  isSearching,
  onDismissSearch,
  searchResults,
  researchProgress,
  onCancelResearch,
  onDismissResearch,
}: ChatBodyProps) {
  const [showArtifacts, setShowArtifacts] = useState(false);

  // Extract artifacts from the latest assistant message
  const artifacts = useMemo(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant" && m.content);
    const allArtifacts = assistantMessages.flatMap((m) => extractArtifacts(m.content));
    return allArtifacts;
  }, [messages]);

  // Auto-show artifact panel when new artifacts are detected (only when not generating)
  useEffect(() => {
    if (!isGenerating && artifacts.length > 0) {
      setShowArtifacts(true);
    }
  }, [artifacts.length, isGenerating]);

  const handleRunCode = async (code: string, language: string) => {
    try {
      const API_BASE =
        (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
        "http://localhost:8001/api";
      const res = await fetch(`${API_BASE}/agents/execute-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      console.log("Code execution result:", data);
    } catch (err) {
      console.error("Code execution failed:", err);
    }
  };

  return (
    <motion.div
      className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0e] flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Chat column */}
      <div className={`flex flex-col ${showArtifacts && artifacts.length > 0 ? "w-1/2" : "w-full"} transition-all duration-300`}>
        <div className="relative flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            isGenerating={isGenerating}
            toolMode={toolMode}
            modelUsed={modelUsed}
          />
        </div>

        {/* Search progress */}
        <SearchProgress
          query={searchQuery}
          reason={searchReason}
          isSearching={isSearching}
          onDismiss={onDismissSearch}
        />

        {/* Search sources */}
        {searchResults.length > 0 && !isSearching && (
          <SearchSources
            results={searchResults}
            isCollapsible={true}
            defaultExpanded={false}
          />
        )}

        {/* Research progress */}
        {researchProgress && (
          <div className="border-t border-white/[0.04] bg-[#121214] p-4">
            <ResearchProgress
              step={researchProgress.step}
              total={researchProgress.total}
              message={researchProgress.message}
              findings={researchProgress.findings}
              sources={researchProgress.sources}
              isComplete={researchProgress.isComplete}
              onCancel={onCancelResearch}
              onDismiss={onDismissResearch}
            />
          </div>
        )}
      </div>

      {/* Artifact panel (right side) */}
      <AnimatePresence>
        {showArtifacts && artifacts.length > 0 && (
          <div className="w-1/2">
            <ArtifactPanel
              artifacts={artifacts}
              onClose={() => setShowArtifacts(false)}
              onRunCode={handleRunCode}
            />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
