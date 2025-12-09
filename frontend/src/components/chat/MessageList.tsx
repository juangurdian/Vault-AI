"use client";
import { useEffect, useRef } from "react";
import type { Message } from "./types";
import MarkdownRenderer from "./MarkdownRenderer";

type MessageListProps = {
  messages: Message[];
  isGenerating?: boolean;
};

export default function MessageList({ messages, isGenerating }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="scrollbar-thin flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="flex-1 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10">
                <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-base font-semibold text-slate-100">Welcome to Local AI Beast</p>
              <p className="mt-2 text-sm text-slate-400">
                Ask a question or give a task. The router will auto-select the best local model.
              </p>
              <div className="mt-4 space-y-2 text-left text-sm text-slate-300">
                <div className="rounded-lg bg-slate-800/50 px-3 py-2">"Summarize today's notes"</div>
                <div className="rounded-lg bg-slate-800/50 px-3 py-2">"Write a Python function for Fibonacci"</div>
                <div className="rounded-lg bg-slate-800/50 px-3 py-2">"Explain this image"</div>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-cyan-500/20 text-slate-100"
                  : "border border-slate-800 bg-slate-900/80 text-slate-100"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {msg.role === "user" ? "You" : "Assistant"}
              </p>
              <div className="mt-1">
                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assistant</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
