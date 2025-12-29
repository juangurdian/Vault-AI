"use client";

import { useEffect, useRef, useState } from "react";
import MessageList from "./MessageList";
import MessageInput, { type ToolMode, type Attachment } from "./MessageInput";
import type { Message } from "./types";
import { useChatStore } from "@/lib/stores/chat";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useAppStore, type AppMode } from "@/lib/stores/app";
import { streamChat } from "@/lib/api/chat";
import { streamResearch } from "@/lib/api/research";
import RoutingInfoPanel from "./RoutingInfoPanel";
import ResearchProgress from "./ResearchProgress";
import SourcesList from "./SourcesList";
import type { RoutingInfo } from "./types";
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
  const smartRoutingEnabled = useChatStore((state) => state.smartRoutingEnabled);

  // Get app mode and sync with tool mode
  const appMode = useAppStore((state) => state.mode);
  const setAppMode = useAppStore((state) => state.setMode);
  const [activeToolMode, setActiveToolMode] = useState<ToolMode>("none");

  // Determine effective model: "auto" if smart routing is on, otherwise the selected model
  const effectiveModel = smartRoutingEnabled ? "auto" : selectedModel;

  // Sync app mode with tool mode with smooth transition
  useEffect(() => {
    const modeToTool: Record<AppMode, ToolMode> = {
      chat: "none",
      research: "research",
      code: "reasoning", // Code mode uses reasoning tool
      image: "vision",
    };
    const newToolMode = modeToTool[appMode];
    if (newToolMode !== activeToolMode) {
      // Smooth transition - preserve conversation context
      setActiveToolMode(newToolMode);
    }
  }, [appMode, activeToolMode]);

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
  const [researchProgress, setResearchProgress] = useState<{
    step: number;
    total: number;
    message: string;
    findings: Array<{ title: string; url: string; snippet: string }>;
    sources: string[];
    isComplete: boolean;
  } | null>(null);
  const offline = useOffline();

  const handleSend = async (content: string, toolMode?: ToolMode, attachments?: Attachment[]) => {
    if ((!content.trim() && (!attachments || attachments.length === 0)) || !activeId || offline) return;
    
    // Use active tool mode from state if not provided
    const effectiveToolMode = toolMode ?? activeToolMode;
    
    // Sync tool mode back to app mode if changed manually
    if (effectiveToolMode !== "none") {
      const toolToMode: Record<ToolMode, AppMode | null> = {
        none: "chat",
        research: "research",
        reasoning: "code",
        vision: "image",
        file: "chat",
      };
      const newMode = toolToMode[effectiveToolMode];
      if (newMode && newMode !== appMode) {
        setAppMode(newMode);
      }
    }
    
    // Convert image attachments to base64
    const imageBase64: string[] = [];
    if (attachments) {
      for (const attachment of attachments) {
        if (attachment.type === "image" && attachment.preview) {
          // Extract base64 from data URL
          const base64 = attachment.preview.split(",")[1];
          if (base64) {
            imageBase64.push(base64);
          }
        }
      }
    }
    
    addMessage({ role: "user", content }, activeId);
    setIsGenerating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Build the payload locally to avoid race conditions with store updates
    const previous = [
      ...currentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: "user", content, images: imageBase64.length > 0 ? imageBase64 : undefined },
    ];

    // Handle research mode
    if (effectiveToolMode === "research") {
      try {
        // Initialize research progress
        setResearchProgress({
          step: 0,
          total: 6,
          message: "Starting research...",
          findings: [],
          sources: [],
          isComplete: false,
        });

        await streamResearch(
          content,
          previous.slice(0, -1), // Exclude the current message from history
          { signal: abortRef.current.signal },
          {
            onQuestion: (questions) => {
              // Add clarification question as assistant message
              console.log("Research question received:", questions);
              appendAssistantChunk(questions);
              // Update research progress to show we're in clarification phase
              setResearchProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      step: 0,
                      total: 6,
                      message: "Waiting for your response to clarification questions...",
                    }
                  : {
                      step: 0,
                      total: 6,
                      message: "Waiting for your response to clarification questions...",
                      findings: [],
                      sources: [],
                      isComplete: false,
                    }
              );
            },
            onProgress: (step, total, message) => {
              setResearchProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      step,
                      total,
                      message,
                    }
                  : {
                      step,
                      total,
                      message,
                      findings: [],
                      sources: [],
                      isComplete: false,
                    }
              );
            },
            onFinding: (finding) => {
              setResearchProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      findings: [...prev.findings, finding],
                    }
                  : {
                      step: 0,
                      total: 6,
                      message: "",
                      findings: [finding],
                      sources: [],
                      isComplete: false,
                    }
              );
            },
            onReport: (chunk) => {
              appendAssistantChunk(chunk);
            },
            onSources: (sources) => {
              setResearchProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      sources,
                    }
                  : {
                      step: 6,
                      total: 6,
                      message: "Research complete",
                      findings: [],
                      sources,
                      isComplete: true,
                    }
              );
            },
            onDone: (data) => {
              console.log("Research done event:", data);
              // If it's just clarification phase, don't mark as complete
              if (data?.phase === "clarification") {
                setResearchProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        step: 0,
                        total: 6,
                        message: "Waiting for your response...",
                      }
                    : null
                );
                setIsGenerating(false); // Allow user to respond
              } else {
                // Research is actually complete
                setResearchProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        isComplete: true,
                        message: "Research complete",
                      }
                    : null
                );
                setIsGenerating(false);
              }
            },
            onError: (error) => {
              console.error("Research error", error);
              appendAssistantChunk(`\n⚠️ Research error: ${error}`);
              setIsGenerating(false);
              setResearchProgress((prev) =>
                prev
                  ? {
                      ...prev,
                      isComplete: false,
                      message: `Error: ${error}`,
                    }
                  : null
              );
            },
          }
        );
      } catch (error) {
        console.error("streamResearch failed", error);
        appendAssistantChunk("\n⚠️ Unable to stream research response.");
        setIsGenerating(false);
        setResearchProgress(null);
      }
      return;
    }

    // Regular chat mode (including vision mode with images)
    try {
      await streamChat(
        previous,
        { signal: abortRef.current.signal, model: effectiveModel, images: imageBase64.length > 0 ? imageBase64 : undefined },
        {
          onDelta: (chunk) => appendAssistantChunk(chunk),
          onRouting: (payload) => {
            console.debug("routing payload", payload);
            if (activeId) {
              setRoutingInfo(activeId, payload as RoutingInfo);
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

      {/* Mode indicator with transition */}
      {appMode !== "chat" && (
        <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-300 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold capitalize">{appMode}</span>
          <span className="text-cyan-400/70">mode active</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-900/70 bg-slate-900/60 shadow-lg shadow-slate-950/30">
        <MessageList 
          messages={currentMessages} 
          isGenerating={isGenerating}
          toolMode={activeToolMode !== "none" ? activeToolMode : undefined}
          modelUsed={currentModel}
        />
        {/* Research progress overlay */}
        {researchProgress && (
          <div className="border-t border-slate-800 bg-slate-900/80 p-4">
            <ResearchProgress
              step={researchProgress.step}
              total={researchProgress.total}
              message={researchProgress.message}
              findings={researchProgress.findings}
              sources={researchProgress.sources}
              isComplete={researchProgress.isComplete}
              onCancel={() => {
                console.log("Cancelling research...");
                abortRef.current?.abort();
                setIsGenerating(false);
                setResearchProgress(null);
                appendAssistantChunk("\n\n⚠️ Research cancelled by user.");
              }}
              onDismiss={() => {
                console.log("Dismissing research progress...");
                // If research is still in progress, cancel it first
                if (!researchProgress.isComplete) {
                  abortRef.current?.abort();
                  setIsGenerating(false);
                  appendAssistantChunk("\n\n⚠️ Research cancelled.");
                }
                setResearchProgress(null);
              }}
            />
          </div>
        )}
      </div>
      <div className="shrink-0 rounded-2xl border border-slate-900/70 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/30">
        <MessageInput 
          disabled={isGenerating || offline} 
          onSend={handleSend}
          toolMode={activeToolMode}
          onToolModeChange={setActiveToolMode}
        />
      </div>
    </div>
  );
}
