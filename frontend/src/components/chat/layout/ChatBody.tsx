"use client";

import { motion } from "framer-motion";
import MessageList from "../MessageList";
import ResearchProgress from "../ResearchProgress";
import { SearchProgress } from "../SearchProgress";
import { SearchSources } from "../SearchSources";
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
  return (
    <motion.div
      className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0c0c0e] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
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
    </motion.div>
  );
}
