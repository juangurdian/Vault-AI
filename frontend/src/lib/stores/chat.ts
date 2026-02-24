"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message, Role, RoutingInfo } from "@/components/chat/types";

const CONV_API =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

function syncToBackend(path: string, method: string, body?: any) {
  try {
    fetch(`${CONV_API}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => {});
  } catch {}
}

type ChatState = {
  conversations: Record<string, Conversation>;
  activeId: string | null;
  isGenerating: boolean;
  routingInfo: Record<string, RoutingInfo | null>;
  currentModel: Record<string, string | null>;
  selectedModel: string; // "auto" or specific model name
  smartRoutingEnabled: boolean; // Whether to use intelligent routing
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  setRoutingInfo: (conversationId: string, info: RoutingInfo | null) => void;
  addMessage: (message: Partial<Message> & { role: Role; content: string }, conversationId?: string) => void;
  replaceMessages: (conversationId: string, messages: Message[]) => void;
  deleteConversation: (id: string) => void;
  setIsGenerating: (val: boolean) => void;
  setSelectedModel: (model: string) => void;
  setSmartRoutingEnabled: (enabled: boolean) => void;
  reset: () => void;
};

const newConversation = (title = "New chat"): Conversation => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

// Create the store with persist middleware
export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: {},
      activeId: null,
      isGenerating: false,
      routingInfo: {},
      currentModel: {},
      selectedModel: "auto",
      smartRoutingEnabled: true,

      createConversation: (title) => {
        const convo = newConversation(title);
        set((state) => ({
          conversations: { ...state.conversations, [convo.id]: convo },
          activeId: convo.id,
        }));
        syncToBackend("/conversations", "POST", {
          id: convo.id,
          title: convo.title,
          created_at: convo.createdAt,
        });
        return convo.id;
      },

      setActiveConversation: (id) => {
        if (get().conversations[id]) {
          set({ activeId: id });
        }
      },

      setRoutingInfo: (conversationId, info) => {
        set((state) => ({
          routingInfo: {
            ...state.routingInfo,
            [conversationId]: info,
          },
          currentModel: {
            ...state.currentModel,
            [conversationId]: info?.model ?? state.currentModel[conversationId] ?? null,
          },
        }));
      },

      addMessage: (message, conversationId) => {
        const convId = conversationId || get().activeId;
        if (!convId) return;

        const msgId = message.id || crypto.randomUUID();
        const createdAt = message.createdAt || Date.now();

        set((state) => {
          const existing = state.conversations[convId];
          if (!existing) return state;

          const msg: Message = {
            id: msgId,
            role: message.role,
            content: message.content,
            createdAt,
            ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
            ...(message.thinking ? { thinking: message.thinking } : {}),
          };

          const shouldUpdateTitle =
            existing.messages.length === 0 && message.role === "user" && message.content;

          const newTitle = shouldUpdateTitle
            ? (message.content || "New chat").slice(0, 60)
            : existing.title;

          const updated: Conversation = {
            ...existing,
            messages: [...existing.messages, msg],
            updatedAt: createdAt,
            title: newTitle,
          };

          if (shouldUpdateTitle) {
            syncToBackend(`/conversations/${convId}`, "PUT", {
              title: newTitle,
              updated_at: createdAt,
            });
          }

          return {
            conversations: { ...state.conversations, [convId]: updated },
          };
        });

        syncToBackend(`/conversations/${convId}/messages`, "POST", {
          id: msgId,
          role: message.role,
          content: message.content,
          created_at: createdAt,
          thinking: message.thinking || null,
          image_url: message.imageUrl || null,
        });
      },

      replaceMessages: (conversationId, messages) => {
        set((state) => {
          const existing = state.conversations[conversationId];
          if (!existing) return state;
          const updated: Conversation = {
            ...existing,
            messages,
            updatedAt: Date.now(),
          };
          return { conversations: { ...state.conversations, [conversationId]: updated } };
        });
      },

      deleteConversation: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.conversations;
          const newActive = state.activeId === id ? Object.keys(rest)[0] ?? null : state.activeId;
          return { conversations: rest, activeId: newActive };
        });
        syncToBackend(`/conversations/${id}`, "DELETE");
      },

      setIsGenerating: (val) => set({ isGenerating: val }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      setSmartRoutingEnabled: (enabled) => set({ smartRoutingEnabled: enabled }),

      reset: () =>
        set({
          conversations: {},
          activeId: null,
          isGenerating: false,
          routingInfo: {},
          currentModel: {},
          selectedModel: "auto",
          smartRoutingEnabled: true,
        }),
    }),
    {
      name: "beast-chat-store",
      storage: createJSONStorage(() => {
        // Only use localStorage on client side
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      version: 1,
      // Skip hydration during SSR - we'll hydrate on client only
      skipHydration: true,
    }
  )
);

// Hydrate on client side only
if (typeof window !== "undefined") {
  useChatStore.persist.rehydrate();
}
