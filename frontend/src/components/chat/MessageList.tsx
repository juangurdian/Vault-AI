"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import type { Message } from "./types";
import { Sparkles, MessageSquare, ImageIcon, Code } from "lucide-react";

type MessageListProps = {
  messages: Message[];
  isGenerating?: boolean;
  toolMode?: string;
  modelUsed?: string | null;
};

const suggestionPrompts = [
  { icon: <MessageSquare className="h-4 w-4" />, text: "Summarize today's notes" },
  { icon: <Code className="h-4 w-4" />, text: "Write a Python function for Fibonacci" },
  { icon: <ImageIcon className="h-4 w-4" />, text: "Explain this image" },
];

export default function MessageList({ messages, isGenerating, toolMode, modelUsed }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 py-3">
      <div className="flex-1 space-y-3">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              className="flex h-full items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="max-w-md rounded-2xl border border-white/[0.06] bg-[#121214] p-8 text-center">
                {/* Logo */}
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <Sparkles className="h-7 w-7 text-indigo-400" />
                </div>

                <h2 className="text-xl font-semibold text-white">
                  Welcome to BeastAI
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Ask a question or give a task. The router will auto-select the best local model.
                </p>

                {/* Suggestion prompts */}
                <div className="mt-6 space-y-2">
                  {suggestionPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      className="w-full flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:border-indigo-500/20 hover:text-zinc-200"
                    >
                      <span className="text-indigo-400/80">{prompt.icon}</span>
                      <span>{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MessageBubble
              message={msg}
              toolMode={msg.role === "assistant" ? toolMode : undefined}
              modelUsed={msg.role === "assistant" ? modelUsed : undefined}
              showMetadata={true}
              isStreaming={isGenerating && index === messages.length - 1 && msg.role === "assistant"}
            />
          </motion.div>
        ))}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
