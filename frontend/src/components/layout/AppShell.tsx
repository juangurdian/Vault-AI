"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "./Header";
import Sidebar from "./Sidebar";
import StatusBar from "./StatusBar";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-full overflow-hidden bg-[#09090b] text-zinc-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <div
            className="fixed inset-y-0 left-0 z-50 w-[280px] md:hidden"
          >
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden border-l border-white/[0.06] bg-[#0c0c0e]">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 overflow-hidden px-3 pb-2 sm:px-4">
          {children}
        </main>

        <StatusBar />
      </div>
    </div>
  );
}
