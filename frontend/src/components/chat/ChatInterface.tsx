"use client";

import { useEffect, useRef, useState } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { Message } from "./types";
import { useChatStore } from "@/lib/stores/chat";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { streamChat } from "@/lib/api/chat";
import RoutingInfoPanel from "./RoutingInfoPanel";
import { useOffline } from "@/lib/hooks/useOffline";

type ChatInterfaceProps = {
  initialMessages?: Message[];
};

export default function ChatInterface({ initialMessages }: ChatInterfaceProps) {
  const hydrated = useHydrated();

  const activeId = useChatStore((state) => state.activeId);
  const conversations = useChatStore((state) => state.conversations);
  const isGenerating = useChatStore((state) => state.isGenerating);
  const createConversation = useChatStore((state) => state.createConversation);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const replaceMessages = useChatStore((state) => state.replaceMessages);
  const setIsGenerating = useChatStore((state) => state.setIsGenerating);
  const setRoutingInfo = useChatStore((state) => state.setRoutingInfo);
  const routingInfo = useChatStore((state) =>
    activeId ? state.routingInfo[activeId] ?? null : null
  );
  const currentModel = useChatStore((state) =>
    activeId ? state.currentModel[activeId] ?? null : null
  );
  const selectedModel = useChatStore((state) => state.selectedModel);

  const seededRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!activeId) {
      const id = createConversation("New chat");
      setActiveConversation(id);
      return;
    }

    if (seededRef.current) return;
    if (initialMessages && initialMessages.length) {
      initialMessages.forEach((msg) => addMessage(msg, activeId));
    }
    seededRef.current = true;
  }, [activeId, addMessage, createConversation, initialMessages, setActiveConversation]);

  const currentMessages = activeId ? conversations[activeId]?.messages ?? [] : [];

  const appendAssistantChunk = (chunk: string) => {
    if (!activeId) return;
    // Use functional update to avoid stale snapshots
    useChatStore.setState((state) => {
      const conversation = state.conversations[activeId];
      if (!conversation) return state;

      const updated = [...conversation.messages];
      const lastMessage = updated[updated.length - 1];

      if (!lastMessage || lastMessage.role !== "assistant") {
        updated.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: chunk,
          createdAt: Date.now(),
        });
      } else {
        updated[updated.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + chunk,
        };
      }

      return {
        conversations: {
          ...state.conversations,
          [activeId]: {
            ...conversation,
            messages: updated,
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  const [showRouting, setShowRouting] = useState(false);
  const offline = useOffline();

  const handleSend = async (content: string) => {
    if (!content.trim() || !activeId || offline) return;
    addMessage({ role: "user", content }, activeId);
    setIsGenerating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Build the payload locally to avoid race conditions with store updates
    const previous = [
      ...currentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: "user", content },
    ];

    try {
      await streamChat(
        previous,
        { signal: abortRef.current.signal, model: selectedModel },
        {
          onDelta: (chunk) => appendAssistantChunk(chunk),
          onRouting: (payload) => {
            console.debug("routing payload", payload);
            if (activeId) {
              setRoutingInfo(activeId, payload);
            }
          },
          onDone: () => {
            setIsGenerating(false);
          },
          onError: (message) => {
            console.error("stream error", message);
            appendAssistantChunk(`\n⚠️ ${message}`);
            setIsGenerating(false);
          },
        }
      );
    } catch (error) {
      console.error("streamChat failed", error);
      appendAssistantChunk("\n⚠️ Unable to stream response.");
      setIsGenerating(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex-1 rounded-2xl border border-slate-900/70 bg-slate-900/60 p-6">
          <div className="space-y-3">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-16 animate-pulse rounded-xl bg-slate-800/80" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-900/70 bg-slate-900/70 p-4">
          <div className="h-12 animate-pulse rounded-xl bg-slate-800/80" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Routing toggle (separate from the chat scroll) */}
      {routingInfo && (
        <div className="flex items-center justify-between rounded-xl border border-slate-900/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            Routing info available (model: {routingInfo.model})
          </div>
          <button
            onClick={() => setShowRouting((v) => !v)}
            className="rounded-lg border border-slate-800 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            {showRouting ? "Hide" : "Show"} routing
          </button>
        </div>
      )}

      {showRouting && routingInfo && (
        <div className="rounded-2xl border border-slate-900/70 bg-slate-900/60 px-4 py-3 shadow-inner shadow-slate-950/30">
          <RoutingInfoPanel info={routingInfo} previousModel={currentModel} />
        </div>
      )}

      {offline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Offline detected. Sending is disabled until you reconnect.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-900/70 bg-slate-900/60 shadow-lg shadow-slate-950/30">
        <MessageList messages={currentMessages} isGenerating={isGenerating} />
      </div>
      <div className="shrink-0 rounded-2xl border border-slate-900/70 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30">
        <MessageInput disabled={isGenerating || offline} onSend={handleSend} />
      </div>
    </div>
  );
}
