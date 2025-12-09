"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message, Role, RoutingInfo } from "@/components/chat/types";

type ChatState = {
  conversations: Record<string, Conversation>;
  activeId: string | null;
  isGenerating: boolean;
  routingInfo: Record<string, RoutingInfo | null>;
  currentModel: Record<string, string | null>;
  selectedModel: string; // "auto" or specific model name
  createConversation: (title?: string) => string;
  setActiveConversation: (id: string) => void;
  setRoutingInfo: (conversationId: string, info: RoutingInfo | null) => void;
  addMessage: (message: { role: Role; content: string }, conversationId?: string) => void;
  replaceMessages: (conversationId: string, messages: Message[]) => void;
  deleteConversation: (id: string) => void;
  setIsGenerating: (val: boolean) => void;
  setSelectedModel: (model: string) => void;
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

      createConversation: (title) => {
        const convo = newConversation(title);
        set((state) => ({
          conversations: { ...state.conversations, [convo.id]: convo },
          activeId: convo.id,
        }));
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

        set((state) => {
          const existing = state.conversations[convId];
          if (!existing) return state;

          const msg: Message = {
            id: crypto.randomUUID(),
            role: message.role,
            content: message.content,
            createdAt: Date.now(),
          };

          const shouldUpdateTitle =
            existing.messages.length === 0 && message.role === "user" && message.content;

          const updated: Conversation = {
            ...existing,
            messages: [...existing.messages, msg],
            updatedAt: msg.createdAt,
            title: shouldUpdateTitle
              ? (message.content || "New chat").slice(0, 60)
              : existing.title,
          };

          return {
            conversations: { ...state.conversations, [convId]: updated },
          };
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
      },

      setIsGenerating: (val) => set({ isGenerating: val }),

      setSelectedModel: (model) => set({ selectedModel: model }),

      reset: () =>
        set({
          conversations: {},
          activeId: null,
          isGenerating: false,
          routingInfo: {},
          currentModel: {},
          selectedModel: "auto",
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
