"use client";

import MarkdownRenderer from "./MarkdownRenderer";
import type { Message } from "./types";

type MessageBubbleProps = {
  message: Message;
  toolMode?: string;
  modelUsed?: string | null;
  showMetadata?: boolean;
};

export default function MessageBubble({
  message,
  toolMode,
  modelUsed,
  showMetadata = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} transition-all duration-300`}
    >
      <div
        className={`group relative max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-cyan-500/20 text-slate-100"
            : "border border-slate-800 bg-slate-900/80 text-slate-100"
        }`}
      >
        {/* Header with role and metadata */}
        <div className="mb-1 flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {isUser ? "You" : "Assistant"}
          </p>
          {timestamp && (
            <span className="text-[10px] text-slate-600">{timestamp}</span>
          )}
          {!isUser && toolMode && toolMode !== "none" && (
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300">
              {toolMode === "research" ? "🔍 Research" : toolMode === "reasoning" ? "🧠 Reasoning" : toolMode === "vision" ? "🖼️ Vision" : toolMode === "file" ? "📎 File" : ""}
            </span>
          )}
          {!isUser && modelUsed && showMetadata && (
            <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
              {modelUsed}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="text-sm leading-relaxed">
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

