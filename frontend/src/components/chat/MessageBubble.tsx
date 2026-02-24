"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarkdownRenderer from "./MarkdownRenderer";
import type { Message, ToolUsage } from "./types";
import Feedback from "./Feedback";
import { useChatStore } from "@/lib/stores/chat";
import { User, Bot, Sparkles, Brain, Image as ImageIcon, FileText, AlertCircle, ThumbsUp, ThumbsDown, Wrench, Search, Globe, BookOpen, FileSearch, Loader2, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

type MessageBubbleProps = {
  message: Message;
  toolMode?: string;
  modelUsed?: string | null;
  showMetadata?: boolean;
  isStreaming?: boolean;
};

const toolModeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  research: { icon: <Sparkles className="h-3 w-3" />, label: "Research", color: "text-amber-400" },
  reasoning: { icon: <Brain className="h-3 w-3" />, label: "Reasoning", color: "text-violet-400" },
  vision: { icon: <ImageIcon className="h-3 w-3" />, label: "Vision", color: "text-pink-400" },
  file: { icon: <FileText className="h-3 w-3" />, label: "File", color: "text-blue-400" },
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Globe className="h-3 w-3" />,
  rag_query: <BookOpen className="h-3 w-3" />,
  fetch_page: <FileSearch className="h-3 w-3" />,
  image_generate: <ImageIcon className="h-3 w-3" />,
  image_analyze: <Search className="h-3 w-3" />,
  deep_research: <Sparkles className="h-3 w-3" />,
};

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searched the web",
  rag_query: "Queried knowledge base",
  fetch_page: "Read a web page",
  image_generate: "Generated an image",
  image_analyze: "Analyzed an image",
  deep_research: "Deep research",
};

function ToolBadge({ tool }: { tool: ToolUsage }) {
  const icon = TOOL_ICONS[tool.name] ?? <Wrench className="h-3 w-3" />;
  const label = TOOL_LABELS[tool.name] ?? tool.name;
  const isLoading = tool.success === undefined;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium
        border
        ${isLoading
          ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
          : tool.success
          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
          : "bg-red-500/10 text-red-300 border-red-500/20"
        }
      `}
      title={tool.resultPreview}
    >
      {icon}
      <span>{label}</span>
      {isLoading ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : tool.success ? (
        <CheckCircle2 className="h-2.5 w-2.5" />
      ) : (
        <XCircle className="h-2.5 w-2.5" />
      )}
    </span>
  );
}

export default function MessageBubble({
  message,
  toolMode,
  modelUsed,
  showMetadata = false,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  useEffect(() => {
    if (isStreaming && message.thinking && message.thinking.length > 0) {
      setThinkingOpen(true);
    }
  }, [isStreaming, message.thinking]);

  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const handleFeedback = async (rating: number) => {
    const activeId = useChatStore.getState().activeId;
    if (!activeId) return;

    const conversation = useChatStore.getState().conversations[activeId];
    if (!conversation) return;

    const messageIndex = conversation.messages.findIndex((m) => m.id === message.id);
    const userMessage = conversation.messages
      .slice(0, messageIndex)
      .reverse()
      .find((m) => m.role === "user");

    if (userMessage) {
      try {
        await fetch("http://localhost:8001/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: userMessage.content,
            model_used: modelUsed || "unknown",
            rating: rating,
          }),
        });
        setFeedbackGiven(true);
      } catch (error) {
        console.error("Failed to send feedback", error);
      }
    }
  };

  const toolConfig = toolMode && toolModeConfig[toolMode];

  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <div
        className={`
          group relative max-w-[92%] overflow-hidden
          ${isUser
            ? "message-user rounded-2xl rounded-tr-sm"
            : message.error
            ? "bg-red-500/10 border border-red-500/20 border-l-2 border-l-red-500 rounded-2xl rounded-tl-sm"
            : "message-ai rounded-2xl rounded-tl-sm"
          }
        `}
      >
        <div className="relative p-4">
          {/* Header with avatar and metadata */}
          <div className="mb-3 flex items-center gap-3">
            {/* Avatar */}
            {isUser ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30">
                <User className="h-3.5 w-3.5 text-blue-400" />
              </div>
            ) : message.error ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              </div>
            ) : (
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border-2 border-[#18181b]" />
              </div>
            )}

            {/* Role & metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${message.error ? "text-red-400" : isUser ? "text-blue-300" : "text-indigo-300"}`}>
                  {isUser ? "You" : "BeastAI"}
                </span>

                {/* Tool mode badge */}
                {toolConfig && (
                  <span className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-white/5 ${toolConfig.color} border border-white/[0.06]`}>
                    {toolConfig.icon}
                    {toolConfig.label}
                  </span>
                )}

                {/* Model badge */}
                {!isUser && modelUsed && showMetadata && (
                  <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 border border-indigo-500/20">
                    {modelUsed}
                  </span>
                )}
              </div>

              {timestamp && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {timestamp}
                </p>
              )}
            </div>
          </div>

          {/* Attached image preview */}
          <AnimatePresence>
            {message.imageUrl && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="relative group/image">
                  <img
                    src={message.imageUrl}
                    alt="Attached image"
                    className="max-h-64 max-w-full rounded-lg border border-white/[0.08] object-contain"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible thinking / reasoning section */}
          <AnimatePresence>
            {!isUser && message.thinking && (
              <motion.div
                className="mb-4 rounded-lg overflow-hidden border border-violet-500/20 bg-violet-500/[0.03]"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button
                  onClick={() => setThinkingOpen(!thinkingOpen)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/5"
                >
                  <motion.div
                    animate={{ rotate: thinkingOpen ? 90 : 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </motion.div>
                  <Brain className="h-3.5 w-3.5" />
                  <span>Thinking Process</span>
                  <span className="ml-auto text-[10px] font-normal text-violet-400/60">
                    {message.thinking.length > 500
                      ? `${Math.round(message.thinking.length / 4)} tokens`
                      : `${message.thinking.length} chars`}
                  </span>
                </button>
                <AnimatePresence>
                  {thinkingOpen && (
                    <motion.div
                      className="border-t border-violet-500/10 px-3 py-2.5 text-xs leading-relaxed text-violet-200/70"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <MarkdownRenderer content={message.thinking} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tool usage indicators */}
          <AnimatePresence>
            {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
              <motion.div
                className="mb-3 flex flex-wrap gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {message.toolsUsed.map((tool, idx) => (
                  <ToolBadge key={`${tool.name}-${idx}`} tool={tool} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message content */}
          <div className="text-[15px] leading-7 text-zinc-200">
            {message.error && (
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>Error</span>
              </div>
            )}
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <MarkdownRenderer content={message.content} />
                {isStreaming && (
                  <span className="inline-block w-2 h-5 ml-1 bg-indigo-400 align-middle rounded-sm animate-pulse" />
                )}
              </>
            )}
          </div>

          {/* Feedback section */}
          <AnimatePresence>
            {!isUser && !message.error && !feedbackGiven && !isStreaming && message.content.length > 0 && (
              <motion.div
                className="mt-4 border-t border-white/[0.04] pt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-zinc-500">Helpful?</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleFeedback(1)}
                      className="rounded-md p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleFeedback(-1)}
                      className="rounded-md p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            {feedbackGiven && (
              <motion.div
                className="mt-4 border-t border-white/[0.04] pt-3"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  Thanks for your feedback
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
