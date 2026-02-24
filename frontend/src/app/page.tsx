"use client";

import AppShell from "@/components/layout/AppShell";
import ChatInterface from "@/components/chat/ChatInterface";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <main className="h-screen overflow-hidden bg-[#0a0a12] text-slate-100">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ height: "100%" }}
      >
        <AppShell>
          <ChatInterface />
        </AppShell>
      </motion.div>
    </main>
  );
}
