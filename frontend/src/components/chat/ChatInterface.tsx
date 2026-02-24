"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import MessageList from "./MessageList";
import MessageInput, { type ToolMode, type Attachment } from "./MessageInput";
import type { Message, ToolUsage } from "./types";
import { useChatStore } from "@/lib/stores/chat";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useAppStore, type AppMode } from "@/lib/stores/app";
import { streamChat, type SearchResult } from "@/lib/api/chat";
import { streamResearch } from "@/lib/api/research";

import type { RoutingInfo } from "./types";
import { useOffline } from "@/lib/hooks/useOffline";

import ChatHeader from "./layout/ChatHeader";
import ChatBody from "./layout/ChatBody";
import ChatInputSection from "./layout/ChatInputSection";
import { StaggerContainer, StaggerItem, PulseDots } from "@/components/animations";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

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

  // Sync app mode with tool mode
  useEffect(() => {
    const modeToTool: Record<AppMode, ToolMode> = {
      chat: "none",
      research: "research",
      code: "none",
      image: "vision",
      reasoning: "reasoning",
    };
    const newToolMode = modeToTool[appMode];
    if (newToolMode !== activeToolMode) {
      setActiveToolMode(newToolMode);
    }
  }, [appMode, activeToolMode]);

  const seededRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const assistantMsgIdRef = useRef<string>("");

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

  const thinkingRef = useRef<string>("");

  const appendAssistantChunk = (id: string, chunk: string) => {
    if (!activeId) return;
    useChatStore.setState((state) => {
      const conversation = state.conversations[activeId];
      if (!conversation) return state;

      const messages = conversation.messages.map((msg) => {
        if (msg.id === id) {
          return {
            ...msg,
            content: msg.content + chunk,
          };
        }
        return msg;
      });

      return {
        conversations: {
          ...state.conversations,
          [activeId]: { ...conversation, messages, updatedAt: Date.now() },
        },
      };
    });
  };

  const appendThinkingChunk = (id: string, chunk: string) => {
    if (!activeId) return;
    thinkingRef.current += chunk;
    useChatStore.setState((state) => {
      const conversation = state.conversations[activeId];
      if (!conversation) return state;

      const messages = conversation.messages.map((msg) => {
        if (msg.id === id) {
          return { ...msg, thinking: thinkingRef.current };
        }
        return msg;
      });

      return {
        conversations: {
          ...state.conversations,
          [activeId]: { ...conversation, messages, updatedAt: Date.now() },
        },
      };
    });
  };

  const appendToolUsage = (id: string, tool: ToolUsage) => {
    if (!activeId) return;
    useChatStore.setState((state) => {
      const conversation = state.conversations[activeId];
      if (!conversation) return state;

      const messages = conversation.messages.map((msg) => {
        if (msg.id === id) {
          const existing = msg.toolsUsed ?? [];
          const idx = existing.findIndex((t) => t.name === tool.name && t.success === undefined);
          if (idx >= 0) {
            const updated = [...existing];
            updated[idx] = { ...updated[idx], ...tool };
            return { ...msg, toolsUsed: updated };
          }
          return { ...msg, toolsUsed: [...existing, tool] };
        }
        return msg;
      });

      return {
        conversations: {
          ...state.conversations,
          [activeId]: { ...conversation, messages, updatedAt: Date.now() },
        },
      };
    });
  };

  const updateAssistantMessage = (id: string, newContent: string, error = false) => {
    if (!activeId) return;
    useChatStore.setState((state) => {
      const conversation = state.conversations[activeId];
      if (!conversation) return state;

      const messages = conversation.messages.map((msg) => {
        if (msg.id === id) {
          return { ...msg, content: newContent, error };
        }
        return msg;
      });

      return {
        conversations: {
          ...state.conversations,
          [activeId]: { ...conversation, messages, updatedAt: Date.now() },
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

  // Web search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchReason, setSearchReason] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const offline = useOffline();

  const handleSend = async (content: string, toolMode?: ToolMode, attachments?: Attachment[]) => {
    if ((!content.trim() && (!attachments || attachments.length === 0)) || !activeId || offline) return;

    const effectiveToolMode = toolMode ?? activeToolMode;

    if (effectiveToolMode !== "none") {
      const toolToMode: Record<ToolMode, AppMode | null> = {
        none: "chat", research: "research", reasoning: "reasoning", vision: "image", file: "chat",
      };
      const newMode = toolToMode[effectiveToolMode];
      if (newMode && newMode !== appMode) setAppMode(newMode);
    }

    const imageBase64: string[] = [];
    if (attachments) {
      for (const attachment of attachments) {
        if (attachment.type === "image" && attachment.preview) {
          const base64 = attachment.preview.split(",")[1];
          if (base64) imageBase64.push(base64);
        }
      }
    }

    // Image generation mode: vision tool + no image attachment = generate image
    if (effectiveToolMode === "vision" && (!attachments || attachments.length === 0 || !attachments.some((a) => a.type === "image"))) {
      const userMessageId = crypto.randomUUID();
      addMessage({ id: userMessageId, role: "user", content }, activeId);

      const assistantMessageId = crypto.randomUUID();
      assistantMsgIdRef.current = assistantMessageId;
      addMessage({ id: assistantMessageId, role: "assistant", content: "Generating image..." }, activeId);
      setIsGenerating(true);

      try {
        const res = await fetch(`${API_BASE}/image/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: content }),
        });

        if (!res.ok) {
          const statusRes = await fetch(`${API_BASE}/image/status`);
          const statusData = await statusRes.json();
          if (!statusData.comfyui_available && statusData.setup_instructions) {
            const instructions = statusData.setup_instructions.join("\n");
            updateAssistantMessage(
              assistantMessageId,
              `ComfyUI is not available for image generation.\n\n**Setup Instructions:**\n${instructions}`,
              true
            );
          } else {
            const err = await res.text();
            updateAssistantMessage(assistantMessageId, `Image generation failed: ${err}`, true);
          }
        } else {
          const data = await res.json();
          if (data.images && data.images.length > 0) {
            const imgMarkdown = data.images
              .map((b64: string) => `![Generated image](data:image/png;base64,${b64})`)
              .join("\n\n");
            updateAssistantMessage(assistantMessageId, imgMarkdown);
          } else {
            updateAssistantMessage(assistantMessageId, "No images were returned.", true);
          }
        }
      } catch (err) {
        updateAssistantMessage(assistantMessageId, `Image generation error: ${String(err)}`, true);
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // For vision mode with an image, use the dedicated upload endpoint
    if (effectiveToolMode === "vision" && attachments && attachments.length > 0) {
      const imageAttachment = attachments.find((a) => a.type === "image");
      if (imageAttachment) {
        const userMessageId = crypto.randomUUID();
        addMessage({
          id: userMessageId,
          role: "user",
          content: content || "Analyze this image.",
          imageUrl: imageAttachment.preview,
        }, activeId);

        const assistantMessageId = crypto.randomUUID();
        assistantMsgIdRef.current = assistantMessageId;
        addMessage({ id: assistantMessageId, role: "assistant", content: "🔍 Analyzing image…" }, activeId);
        setIsGenerating(true);

        try {
          const formData = new FormData();
          formData.append("file", imageAttachment.file);
          formData.append("prompt", content || "What is in this image? Describe in detail.");

          const res = await fetch("http://localhost:8001/api/image/analyze/upload", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.text();
            updateAssistantMessage(assistantMessageId, `⚠️ Vision analysis failed: ${err}`, true);
          } else {
            const data = await res.json();
            updateAssistantMessage(assistantMessageId, data.analysis ?? "No analysis returned.");
          }
        } catch (err) {
          updateAssistantMessage(assistantMessageId, `⚠️ Vision error: ${String(err)}`, true);
        } finally {
          setIsGenerating(false);
        }
        return;
      }
    }

    const userMessageId = crypto.randomUUID();
    addMessage({ id: userMessageId, role: "user", content }, activeId);

    const assistantMessageId = crypto.randomUUID();
    assistantMsgIdRef.current = assistantMessageId;
    addMessage({ id: assistantMessageId, role: "assistant", content: "" }, activeId);

    setIsGenerating(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const previous = [
      ...currentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: "user", content, images: imageBase64.length > 0 ? imageBase64 : undefined },
    ];

    if (effectiveToolMode === "research") {
      try {
        setResearchProgress({ step: 0, total: 6, message: "Starting research...", findings: [], sources: [], isComplete: false });

        await streamResearch(
          content,
          previous.slice(0, -1),
          { signal: abortRef.current.signal },
          {
            onQuestion: (questions) => {
              appendAssistantChunk(assistantMessageId, questions);
              setResearchProgress((prev) => prev ? { ...prev, message: "Waiting for your response..." } : null);
            },
            onProgress: (step, total, message) => setResearchProgress((prev) => prev ? { ...prev, step, total, message } : null),
            onFinding: (finding) => setResearchProgress((prev) => prev ? { ...prev, findings: [...prev.findings, finding] } : null),
            onReport: (chunk) => appendAssistantChunk(assistantMessageId, chunk),
            onSources: (sources) => setResearchProgress((prev) => prev ? { ...prev, sources } : null),
            onDone: (data) => {
              if (data?.phase === "clarification") {
                setIsGenerating(false);
              } else {
                setResearchProgress((prev) => prev ? { ...prev, isComplete: true, message: "Research complete" } : null);
                setIsGenerating(false);
              }
            },
            onError: (error) => {
              console.error("Research error", error);
              updateAssistantMessage(assistantMessageId, `⚠️ Research error: ${error}`, true);
              setIsGenerating(false);
              setResearchProgress(null);
            },
          }
        );
      } catch (error) {
        console.error("streamResearch failed", error);
        updateAssistantMessage(assistantMessageId, "⚠️ Unable to stream research response.", true);
        setIsGenerating(false);
        setResearchProgress(null);
      }
      return;
    }

    setIsSearching(false);
    setSearchQuery("");
    setSearchReason("");
    setSearchResults([]);
    thinkingRef.current = "";

    try {
      let firstChunk = true;
      await streamChat(
        previous,
        {
          signal: abortRef.current.signal,
          model: effectiveModel,
          images: imageBase64.length > 0 ? imageBase64 : undefined,
          forceReasoning: effectiveToolMode === "reasoning",
        },
        {
          onDelta: (chunk) => {
            if (firstChunk) {
              updateAssistantMessage(assistantMessageId, chunk);
              firstChunk = false;
            } else {
              appendAssistantChunk(assistantMessageId, chunk);
            }
          },
          onThinkingStart: () => {
            thinkingRef.current = "";
          },
          onThinkingDelta: (chunk) => {
            appendThinkingChunk(assistantMessageId, chunk);
          },
          onThinkingEnd: () => {
            // thinking is already stored on the message via appendThinkingChunk
          },
          onRouting: (payload) => { if (activeId) setRoutingInfo(activeId, payload as RoutingInfo); },
          onSearchStart: (payload) => { setIsSearching(true); setSearchQuery(payload.query); setSearchReason(payload.reason || ""); },
          onSearchResults: (payload) => { setIsSearching(false); setSearchResults(payload.results); },
          onSearchError: (error) => { console.error("search error", error); setIsSearching(false); },
          onToolStart: (payload) => {
            appendToolUsage(assistantMessageId, { name: payload.name, args: payload.args });
          },
          onToolResult: (payload) => {
            appendToolUsage(assistantMessageId, { name: payload.name, success: payload.success, resultPreview: payload.result_preview });
          },
          onDone: (payload) => {
            setIsGenerating(false);
            setIsSearching(false);
            if (payload?.sources && payload.sources.length > 0 && searchResults.length === 0) {
              setSearchResults(payload.sources.map((url: string) => ({ title: new URL(url).hostname, url, snippet: "", source: "web" })));
            }
          },
          onError: (message) => {
            console.error("stream error", message);
            updateAssistantMessage(assistantMessageId, `⚠️ ${message}`, true);
            setIsGenerating(false);
            setIsSearching(false);
          },
        }
      );
    } catch (error) {
      console.error("streamChat failed", error);
      updateAssistantMessage(assistantMessageId, "⚠️ Unable to stream response.", true);
      setIsGenerating(false);
      setIsSearching(false);
    }
  };

  if (!hydrated) {
    return (
      <motion.div
        className="flex h-full flex-col gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex-1 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-6">
          <StaggerContainer className="space-y-3" staggerDelay={0.1}>
            {[...Array(4)].map((_, idx) => (
              <StaggerItem key={idx}>
                <motion.div
                  className="h-20 rounded-xl bg-white/[0.05]"
                  animate={{
                    background: [
                      "rgba(255,255,255,0.05)",
                      "rgba(255,255,255,0.08)",
                      "rgba(255,255,255,0.05)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <motion.div
            className="h-14 rounded-xl bg-white/[0.05]"
            animate={{
              background: [
                "rgba(255,255,255,0.05)",
                "rgba(255,255,255,0.08)",
                "rgba(255,255,255,0.05)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex h-full flex-col gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <ChatHeader
        routingInfo={routingInfo}
        currentModel={currentModel}
        showRouting={showRouting}
        onToggleRouting={() => setShowRouting((v) => !v)}
        offline={offline}
        appMode={appMode}
      />

      <ChatBody
        messages={currentMessages}
        isGenerating={isGenerating}
        toolMode={activeToolMode !== "none" ? activeToolMode : undefined}
        modelUsed={currentModel}
        searchQuery={searchQuery}
        searchReason={searchReason}
        isSearching={isSearching}
        onDismissSearch={() => {
          setIsSearching(false);
          abortRef.current?.abort();
        }}
        searchResults={searchResults}
        researchProgress={researchProgress}
        onCancelResearch={() => {
          console.log("Cancelling research...");
          abortRef.current?.abort();
          setIsGenerating(false);
          setResearchProgress(null);
          appendAssistantChunk(assistantMsgIdRef.current, "\n\n⚠️ Research cancelled by user.");
        }}
        onDismissResearch={() => {
          console.log("Dismissing research progress...");
          if (!researchProgress?.isComplete) {
            abortRef.current?.abort();
            setIsGenerating(false);
            appendAssistantChunk(assistantMsgIdRef.current, "\n\n⚠️ Research cancelled.");
          }
          setResearchProgress(null);
        }}
      />

      <ChatInputSection
        disabled={offline}
        isGenerating={isGenerating}
        onSend={handleSend}
        onStop={() => {
          abortRef.current?.abort();
          setIsGenerating(false);
          setIsSearching(false);
          setResearchProgress(null);
          if (assistantMsgIdRef.current) {
            appendAssistantChunk(assistantMsgIdRef.current, "\n\n*(stopped)*");
          }
        }}
        toolMode={activeToolMode}
        onToolModeChange={setActiveToolMode}
      />
    </motion.div>
  );
}
