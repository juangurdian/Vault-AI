"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolMode } from "./MessageInput";
import { MessageSquare, Search, Brain, Image as ImageIcon, FileText, Check } from "lucide-react";

type ToolOption = {
  mode: ToolMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  description: string;
};

const tools: ToolOption[] = [
  {
    mode: "none",
    label: "Chat",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-zinc-300",
    bg: "bg-white/[0.05]",
    border: "border-white/[0.08]",
    description: "Standard conversation",
  },
  {
    mode: "research",
    label: "Research",
    icon: <Search className="h-4 w-4" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    description: "Deep research with web search",
  },
  {
    mode: "reasoning",
    label: "Reasoning",
    icon: <Brain className="h-4 w-4" />,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    description: "Complex analysis & reasoning",
  },
  {
    mode: "vision",
    label: "Vision",
    icon: <ImageIcon className="h-4 w-4" />,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    description: "Image generation & analysis",
  },
  {
    mode: "file",
    label: "File",
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    description: "Upload & analyze documents",
  },
];

type ToolSelectorProps = {
  value: ToolMode;
  onChange: (mode: ToolMode) => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function ToolSelector({ value, onChange, disabled, compact = false }: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const selectedTool = tools.find((t) => t.mode === value) || tools[0];

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.top - 8,
      left: rect.left,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        portalRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !isOpen && !disabled) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, disabled]);

  const dropdown = isOpen && dropdownPos && createPortal(
    <AnimatePresence>
      <motion.div
        ref={portalRef}
        className="fixed z-[9999] w-60 overflow-hidden rounded-xl border border-white/[0.08] bg-[#121214] shadow-xl"
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          transform: "translateY(-100%)",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
      >
        <div className="border-b border-white/[0.06] px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">Select Mode</p>
        </div>

        <div className="p-1.5 space-y-0.5">
          {tools.map((tool) => (
            <button
              key={tool.mode}
              type="button"
              onClick={() => {
                onChange(tool.mode);
                setIsOpen(false);
              }}
              className={`
                group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all
                ${value === tool.mode
                  ? `${tool.bg} ${tool.border} border`
                  : "hover:bg-white/[0.03]"
                }
              `}
            >
              <div
                className={`
                  flex h-8 w-8 items-center justify-center rounded-lg
                  ${value === tool.mode
                    ? `${tool.bg} ${tool.color} border ${tool.border}`
                    : `bg-white/[0.05] text-zinc-500 group-hover:text-zinc-300`
                  }
                `}
              >
                {tool.icon}
              </div>

              <div className="flex-1">
                <div className={`font-medium ${value === tool.mode ? tool.color : "text-zinc-300"}`}>
                  {tool.label}
                </div>
                <div className="text-[10px] text-zinc-600 leading-tight">{tool.description}</div>
              </div>

              {value === tool.mode && (
                <Check className={`h-4 w-4 ${tool.color}`} />
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-white/[0.06] px-3 py-2">
          <p className="text-[9px] text-zinc-700">
            Press <kbd className="rounded bg-white/[0.05] px-1 font-mono text-zinc-600">Ctrl+K</kbd> to toggle
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all
          ${value !== "none"
            ? `${selectedTool.bg} ${selectedTool.color} ${selectedTool.border} border`
            : "bg-white/[0.05] text-zinc-500 border border-white/[0.06] hover:bg-white/[0.08] hover:text-zinc-300"
          }
          ${disabled ? "cursor-not-allowed opacity-50" : ""}
          ${compact ? "px-2 py-1" : ""}
        `}
        title={selectedTool.description}
      >
        {selectedTool.icon}
        {!compact && <span>{selectedTool.label}</span>}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdown}
    </div>
  );
}
