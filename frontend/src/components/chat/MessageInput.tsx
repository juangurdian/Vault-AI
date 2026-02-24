"use client";
import { FormEvent, KeyboardEvent, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ToolSelector from "./ToolSelector";
import { Send, Paperclip, X, Sparkles, Brain, Image as ImageIcon, FileText, Search, Loader2, Square } from "lucide-react";

export type ToolMode = "none" | "research" | "reasoning" | "vision" | "file";
export type Attachment = {
  type: "image" | "file";
  file: File;
  preview?: string;
};

type MessageInputProps = {
  disabled?: boolean;
  isGenerating?: boolean;
  onSend: (content: string, toolMode?: ToolMode, attachments?: Attachment[]) => void;
  onStop?: () => void;
  toolMode?: ToolMode;
  onToolModeChange?: (mode: ToolMode) => void;
};

const toolModeIcons: Record<ToolMode, React.ReactNode> = {
  none: <Sparkles className="h-4 w-4" />,
  research: <Search className="h-4 w-4" />,
  reasoning: <Brain className="h-4 w-4" />,
  vision: <ImageIcon className="h-4 w-4" />,
  file: <FileText className="h-4 w-4" />,
};

const toolModeColors: Record<ToolMode, string> = {
  none: "bg-indigo-500",
  research: "bg-amber-500",
  reasoning: "bg-violet-500",
  vision: "bg-pink-500",
  file: "bg-blue-500",
};

const toolModeLabels: Record<ToolMode, string> = {
  none: "Chat",
  research: "Research",
  reasoning: "Reasoning",
  vision: "Vision",
  file: "File",
};

export default function MessageInput({ disabled, isGenerating, onSend, onStop, toolMode: controlledToolMode, onToolModeChange }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [internalToolMode, setInternalToolMode] = useState<ToolMode>("none");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toolMode = controlledToolMode ?? internalToolMode;
  const setToolMode = (mode: ToolMode | ((current: ToolMode) => ToolMode)) => {
    if (onToolModeChange) {
      const newMode = typeof mode === "function" ? mode(toolMode) : mode;
      onToolModeChange(newMode);
    } else {
      setInternalToolMode(typeof mode === "function" ? mode(toolMode) : mode);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Sync with controlled tool mode
  useEffect(() => {
    if (controlledToolMode !== undefined) {
      setInternalToolMode(controlledToolMode);
    }
  }, [controlledToolMode]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const content = value.trim();
    if ((!content && attachments.length === 0) || disabled || isSending) return;

    setIsSending(true);
    onSend(content, toolMode !== "none" ? toolMode : undefined, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setTimeout(() => setIsSending(false), 300);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      if (isGenerating && onStop) {
        onStop();
      } else {
        setValue("");
        setAttachments([]);
      }
    }
  };

  const hasContent = value.trim() || attachments.length > 0;

  return (
    <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
      {/* Tool selector */}
      <ToolSelector
        value={toolMode}
        onChange={setToolMode}
        disabled={disabled}
      />

      {/* Attachment previews */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {attachments.map((attachment, index) => (
              <motion.div
                key={index}
                className="relative rounded-lg border border-white/[0.08] bg-white/[0.03] p-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                {attachment.type === "image" && attachment.preview ? (
                  <div className="relative">
                    <img
                      src={attachment.preview}
                      alt={attachment.file.name}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-white text-xs hover:bg-zinc-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pr-6">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <span className="max-w-[120px] truncate text-xs text-zinc-300">
                      {attachment.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute right-2 rounded-md p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input container - Clean, minimal design */}
      <div
        className={`
          relative rounded-xl border-2 transition-all duration-150
          ${isFocused 
            ? "border-indigo-500/40 bg-[#121214]" 
            : "border-white/[0.08] bg-[#0c0c0e] hover:border-white/[0.12]"
          }
        `}
      >
        {/* Tool mode indicator */}
        {toolMode !== "none" && (
          <div
            className={`absolute -top-2.5 left-3 flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium text-white ${toolModeColors[toolMode]}`}
          >
            {toolModeIcons[toolMode]}
            {toolModeLabels[toolMode]}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            toolMode === "research"
              ? "Enter your research topic..."
              : toolMode === "vision"
              ? "Describe the image or ask about it..."
              : "Ask anything..."
          }
          rows={1}
          disabled={disabled}
          className="w-full resize-none bg-transparent px-4 py-3.5 pr-24 text-[15px] text-zinc-200 placeholder:text-zinc-500 focus:outline-none min-h-[52px] max-h-[200px]"
        />

        {/* Action buttons */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {/* File attach button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:text-zinc-300 hover:bg-white/5"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Stop/Send button */}
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.button
                key="stop"
                type="button"
                onClick={onStop}
                className="flex items-center justify-center rounded-lg bg-red-500 text-white p-2 hover:bg-red-600 transition-colors"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                title="Stop generation"
              >
                <Square className="h-4 w-4 fill-white" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                type="submit"
                disabled={disabled || !hasContent}
                className={`
                  flex items-center justify-center rounded-lg p-2 transition-all
                  ${hasContent
                    ? "bg-indigo-500 text-white hover:bg-indigo-400"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  }
                `}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="flex items-center justify-between text-[11px] text-zinc-600 px-1">
        <div className="flex items-center gap-2">
          <span>Press</span>
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Enter</kbd>
          <span>to send,</span>
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Shift</kbd>
          <span>+</span>
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">Enter</kbd>
          <span>for new line</span>
        </div>
      </div>
    </form>
  );
}
