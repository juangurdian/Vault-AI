"use client";

import { useMemo } from "react";
import { useChatStore } from "@/lib/stores/chat";
import { useHydrated } from "@/lib/hooks/useHydrated";

type SidebarProps = {
  onClose?: () => void;
};

export default function Sidebar({ onClose }: SidebarProps) {
  const hydrated = useHydrated();
  
  // Use individual selectors to prevent infinite re-renders from object selector
  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  
  const handleConversationClick = (id: string) => {
    setActiveConversation(id);
    onClose?.();
  };

  const list = useMemo(
    () => Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const handleNewChat = () => {
    const id = createConversation("New chat");
    setActiveConversation(id);
  };

  return (
    <aside className="h-full w-[260px] flex-col border-r border-slate-900/70 bg-slate-950/80 md:flex lg:w-[300px]">
      {hydrated ? (
        <>
          {/* Header */}
          <div className="shrink-0 border-b border-slate-900/70 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">Status</p>
                <p className="text-sm text-slate-200">Online &amp; ready</p>
              </div>
              <div className="flex items-center gap-2">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="md:hidden rounded p-1 text-slate-400 hover:text-slate-200"
                    aria-label="Close sidebar"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
            </div>
          </div>

          {/* Conversations header + button */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400">
              Conversations
            </p>
            <button
              onClick={handleNewChat}
              className="rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[10px] font-semibold text-cyan-300 transition hover:bg-cyan-500/30"
            >
              + New
            </button>
          </div>

          {/* Scrollable conversation list */}
          <nav className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3">
            <div className="space-y-1.5 pb-4">
              {list.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-3 py-3 text-center text-xs text-slate-500">
                  No conversations yet
                </div>
              )}
              {list.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleConversationClick(item.id)}
                  className={`group w-full rounded-lg px-3 py-2.5 text-left transition ${
                    activeId === item.id
                      ? "bg-cyan-500/15 ring-1 ring-cyan-500/40"
                      : "hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-slate-100">
                      {item.title || "Untitled chat"}
                    </span>
                    <span className="ml-2 shrink-0 text-[10px] text-slate-500">
                      {item.messages.length}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {item.messages[item.messages.length - 1]?.content || "No messages"}
                  </p>
                </button>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-900/70 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Backend
            </p>
            <p className="text-xs text-slate-400">localhost:8001</p>
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 border-b border-slate-900/70 px-4 py-4">
            <div className="h-10 animate-pulse rounded bg-slate-900/80" />
          </div>
          <div className="flex-1 px-3 py-3">
            <div className="space-y-2">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="h-14 animate-pulse rounded-lg bg-slate-900/60" />
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
