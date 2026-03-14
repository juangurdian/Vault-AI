"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatStore } from "@/lib/stores/chat";
import { useHydrated } from "@/lib/hooks/useHydrated";
import SettingsPanel from "@/components/settings/SettingsPanel";
import DocumentUpload from "@/components/rag/DocumentUpload";
import MetricsDashboard from "@/components/layout/MetricsDashboard";
import { MessageSquare, BookOpen, Settings, Plus, Search, Trash2, X, Check, Pin, PinOff, Download, Activity } from "lucide-react";

type SidebarProps = {
  onClose?: () => void;
};

export default function Sidebar({ onClose }: SidebarProps) {
  const hydrated = useHydrated();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const conversations = useChatStore((state) => state.conversations);
  const activeId = useChatStore((state) => state.activeId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);

  const handleConversationClick = (id: string) => {
    if (deleteConfirmId === id) return;
    setActiveConversation(id);
    onClose?.();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
    setDeleteConfirmId(null);
    onClose?.();
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  };

  const list = useMemo(
    () => Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [list, searchQuery]);

  const handleNewChat = () => {
    const id = createConversation("New chat");
    setActiveConversation(id);
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const convo = conversations[id];
    if (!convo) return;
    const md = convo.messages
      .map((m) => `**${m.role === "user" ? "You" : "Assistant"}:**\n\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([`# ${convo.title}\n\n${md}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${convo.title.replace(/[^a-z0-9]/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sort: pinned first, then by updatedAt
  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 1 : 0;
      const bPinned = pinnedIds.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.updatedAt - a.updatedAt;
    });
  }, [filteredList, pinnedIds]);

  return (
    <aside className="relative h-full w-[280px] flex-col border-r border-white/[0.06] bg-[#09090b] md:flex">
      {hydrated ? (
        <>
          {/* Header */}
          <div className="relative shrink-0 border-b border-white/[0.06] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  System Status
                </p>
                <p className="text-sm font-medium text-zinc-200">Online</p>
              </div>
              <div className="flex items-center gap-2">
                {onClose && (
                  <button
                    onClick={onClose}
                    className="md:hidden rounded-lg p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleNewChat}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative shrink-0 px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/[0.06] pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Conversations header */}
          <div className="relative shrink-0 flex items-center justify-between px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              Conversations
            </p>
            <span className="text-[11px] text-zinc-600">{sortedList.length}</span>
          </div>

          {/* Scrollable conversation list */}
          <nav className="relative scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3">
            <div className="space-y-1 pt-1 pb-4">
              {sortedList.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center">
                  <p className="text-xs text-zinc-600">
                    {searchQuery ? "No matches" : "No conversations"}
                  </p>
                </div>
              )}

              {sortedList.map((item) => (
                <div
                  key={item.id}
                  className={`group relative w-full rounded-lg transition-colors ${
                    activeId === item.id
                      ? "bg-white/[0.06] border border-white/[0.08]"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <button
                    onClick={() => handleConversationClick(item.id)}
                    className="w-full px-3 py-2.5 text-left"
                  >
                    <div className="flex items-center justify-between pr-16">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {pinnedIds.has(item.id) && (
                          <Pin className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                        <span className="truncate text-sm font-medium text-zinc-200">
                          {item.title || "Untitled"}
                        </span>
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] text-zinc-600 bg-white/[0.05] px-1.5 py-0.5 rounded">
                        {item.messages.length}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-600">
                      {item.messages[item.messages.length - 1]?.content || "No messages"}
                    </p>
                  </button>

                  {/* Action buttons */}
                  <AnimatePresence>
                    {deleteConfirmId === item.id ? (
                      <motion.div
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 border border-red-500/20"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <button
                          onClick={(e) => handleDeleteConfirm(e, item.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={handleDeleteCancel}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => togglePin(e, item.id)}
                          className="rounded-md p-1 text-zinc-600 hover:bg-amber-500/10 hover:text-amber-400"
                          title={pinnedIds.has(item.id) ? "Unpin" : "Pin"}
                        >
                          {pinnedIds.has(item.id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={(e) => exportConversation(e, item.id)}
                          className="rounded-md p-1 text-zinc-600 hover:bg-blue-500/10 hover:text-blue-400"
                          title="Export as Markdown"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, item.id)}
                          className="rounded-md p-1 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="relative shrink-0 border-t border-white/[0.06] p-4 space-y-2">
            <button
              onClick={() => setKnowledgeBaseOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <BookOpen className="h-4 w-4 text-zinc-500" />
              <span>Knowledge Base</span>
              <span className="ml-auto text-[10px] text-zinc-600">RAG</span>
            </button>

            <button
              onClick={() => setMetricsOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <Activity className="h-4 w-4 text-zinc-500" />
              <span>Monitoring</span>
              <span className="ml-auto text-[10px] text-zinc-600">Live</span>
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-zinc-400 transition-all hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <Settings className="h-4 w-4 text-zinc-500" />
              <span>Settings</span>
            </button>

            <div className="pt-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-700">
                Backend
              </p>
              <p className="text-xs text-zinc-600 font-mono mt-0.5">localhost:8001</p>
            </div>
          </div>

          {/* Slide-over panels */}
          <AnimatePresence>
            {settingsOpen && (
              <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
            )}
            {knowledgeBaseOpen && (
              <DocumentUpload open={knowledgeBaseOpen} onClose={() => setKnowledgeBaseOpen(false)} />
            )}
            {metricsOpen && (
              <MetricsDashboard open={metricsOpen} onClose={() => setMetricsOpen(false)} />
            )}
          </AnimatePresence>
        </>
      ) : (
        <div className="flex flex-col h-full p-4">
          <div className="h-10 rounded-lg bg-white/[0.05] animate-pulse" />
          <div className="mt-4 space-y-2">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-14 rounded-lg bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
