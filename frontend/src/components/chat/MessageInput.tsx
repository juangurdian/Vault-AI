"use client";
import { FormEvent, KeyboardEvent, useState, useRef, useEffect } from "react";
import ToolSelector from "./ToolSelector";

export type ToolMode = "none" | "research" | "reasoning" | "vision" | "file";
export type Attachment = {
  type: "image" | "file";
  file: File;
  preview?: string;
};

type MessageInputProps = {
  disabled?: boolean;
  onSend: (content: string, toolMode?: ToolMode, attachments?: Attachment[]) => void;
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
};

export default function MessageInput({ disabled, onSend, toolMode: controlledToolMode, onToolModeChange }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [internalToolMode, setInternalToolMode] = useState<ToolMode>("none");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use controlled mode if provided, otherwise use internal state
  const toolMode = controlledToolMode ?? internalToolMode;
  const setToolMode = (mode: ToolMode) => {
    if (onToolModeChange) {
      onToolModeChange(mode);
    } else {
      setInternalToolMode(mode);
    }
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  // Sync with controlled tool mode
  useEffect(() => {
    if (controlledToolMode !== undefined) {
      setInternalToolMode(controlledToolMode);
    }
  }, [controlledToolMode]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = value.trim();
    if ((!content && attachments.length === 0) || disabled) return;
    onSend(content, toolMode !== "none" ? toolMode : undefined, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    // Reset tool mode after sending (except for research which may need follow-up)
    if (toolMode !== "research") {
      setToolMode("none");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = [];

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = e.target?.result as string;
          setAttachments((prev) => {
            const existing = prev.find((a) => a.file.name === file.name);
            if (existing) return prev;
            return [...prev, { type: "image", file, preview }];
          });
        };
        reader.readAsDataURL(file);
        newAttachments.push({ type: "image", file });
      } else {
        newAttachments.push({ type: "file", file });
      }
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleToolMode = (mode: ToolMode) => {
    setToolMode((current) => (current === mode ? "none" : mode));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends the message
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter allows newline (default behavior)
    // Escape clears input
    if (e.key === "Escape") {
      setValue("");
      setAttachments([]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ToolSelector
          value={toolMode}
          onChange={setToolMode}
          disabled={disabled}
        />
        {(toolMode === "vision" || toolMode === "file") && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={toolMode === "vision" ? "image/*" : "*"}
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              title={toolMode === "vision" ? "Upload image" : "Upload file"}
            >
              <span>{toolMode === "vision" ? "🖼️" : "📎"}</span>
              <span className="hidden sm:inline">Upload</span>
            </button>
          </>
        )}
      </div>
      
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="relative rounded-lg border border-slate-800 bg-slate-900/60 p-2"
            >
              {attachment.type === "image" && attachment.preview ? (
                <div className="relative">
                  <img
                    src={attachment.preview}
                    alt={attachment.file.name}
                    className="h-20 w-20 rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">📎</span>
                  <span className="max-w-[100px] truncate text-xs text-slate-400">
                    {attachment.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          toolMode === "research"
            ? "Enter your research topic… (AI will ask clarifying questions)"
            : toolMode === "vision"
            ? "Describe the image or ask about it…"
            : toolMode === "file"
            ? "Ask about the uploaded file…"
            : "Ask anything… (Enter to send, Shift+Enter for newline)"
        }
        rows={1}
        disabled={disabled}
        className={`max-h-[150px] min-h-[44px] w-full resize-none rounded-xl border bg-slate-950/70 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-slate-950/30 outline-none ring-1 ring-transparent transition focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          toolMode === "research"
            ? "border-cyan-500/50"
            : toolMode !== "none"
            ? "border-purple-500/50"
            : "border-slate-800"
        }`}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          {toolMode === "research" && (
            <span className="mr-2 text-cyan-400">🔍 Research mode active</span>
          )}
          <span className="hidden sm:inline">
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
            {" "}to send
            <span className="mx-2 text-slate-700">•</span>
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">Shift</kbd>
            {" + "}
            <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
            {" "}for newline
          </span>
        </div>
        <button
          type="submit"
          disabled={disabled || (!value.trim() && attachments.length === 0)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition-all hover:bg-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
          aria-label="Send message"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Send
        </button>
      </div>
    </form>
  );
}
