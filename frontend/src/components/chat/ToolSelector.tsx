"use client";

import { useState, useRef, useEffect } from "react";
import type { ToolMode } from "./MessageInput";

type ToolOption = {
  mode: ToolMode;
  label: string;
  icon: string;
  description: string;
  shortcut?: string;
};

const tools: ToolOption[] = [
  {
    mode: "none",
    label: "Chat",
    icon: "💬",
    description: "Standard chat conversation",
  },
  {
    mode: "research",
    label: "Research",
    icon: "🔍",
    description: "Deep research with web search & RAG",
  },
  {
    mode: "reasoning",
    label: "Reasoning",
    icon: "🧠",
    description: "Force reasoning model for complex analysis",
  },
  {
    mode: "vision",
    label: "Image",
    icon: "🖼️",
    description: "Image generation and analysis",
  },
  {
    mode: "file",
    label: "File",
    icon: "📎",
    description: "Upload and analyze files",
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTool = tools.find((t) => t.mode === value) || tools[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Keyboard shortcut: Cmd/Ctrl+K to open
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
          value !== "none"
            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
            : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-200 hover:bg-slate-900/80"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""} ${compact ? "px-2 py-1" : ""}`}
        title={selectedTool.description}
        aria-label={`Select tool. Current: ${selectedTool.label}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span>{selectedTool.icon}</span>
        {!compact && <span>{selectedTool.label}</span>}
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 animate-in fade-in slide-in-from-top-2 rounded-lg border border-slate-800 bg-slate-900 shadow-xl duration-200">
          <div className="p-1">
            {tools.map((tool) => (
              <button
                key={tool.mode}
                type="button"
                onClick={() => {
                  onChange(tool.mode);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  value === tool.mode
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <span className="text-base">{tool.icon}</span>
                <div className="flex-1">
                  <div className="font-medium">{tool.label}</div>
                  <div className="text-xs text-slate-500">{tool.description}</div>
                </div>
                {value === tool.mode && (
                  <svg className="h-4 w-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

