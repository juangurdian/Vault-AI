"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AppMode = "chat" | "research" | "code" | "image" | "reasoning";

type AppState = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: "chat",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "beast-app-store",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return window.localStorage;
      }),
      skipHydration: true,
    }
  )
);

if (typeof window !== "undefined") {
  useAppStore.persist.rehydrate();
}

