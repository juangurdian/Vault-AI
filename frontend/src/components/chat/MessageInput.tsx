"use client";
import { FormEvent, KeyboardEvent, useState, useRef, useEffect, ChangeEvent } from "react";

export type ToolMode = "none" | "reasoning" | "vision";

export type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 for images, text for files
  isImage: boolean;
};

type MessageInputProps = {
  disabled?: boolean;
  onSend: (content: string, options?: { toolMode?: ToolMode; attachments?: Attachment[] }) => void;
};

export default function MessageInput({ disabled, onSend }: MessageInputProps) {
  const [value, setValue] = useState("");
  const [toolMode, setToolMode] = useState<ToolMode>("none");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const content = value.trim();
    if (!content || disabled) return;
    onSend(content, { 
      toolMode: attachments.some(a => a.isImage) ? "vision" : toolMode, 
      attachments: attachments.length > 0 ? attachments : undefined 
    });
    setValue("");
    setAttachments([]);
    setToolMode("none");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      
      const data = await new Promise<string>((resolve) => {
        reader.onload = () => {
          if (isImage) {
            resolve(reader.result as string);
          } else {
            // For text files, read as text
            const textReader = new FileReader();
            textReader.onload = () => resolve(textReader.result as string);
            textReader.readAsText(file);
          }
        };
        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });

      newAttachments.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        data,
        isImage,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    
    // Reset file input
    e.target.value = "";
    
    // Auto-switch to vision mode if image uploaded
    if (isImage && toolMode !== "vision") {
      setToolMode("vision");
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const updated = prev.filter(a => a.id !== id);
      // If no more images, reset vision mode
      if (!updated.some(a => a.isImage) && toolMode === "vision") {
        setToolMode("none");
      }
      return updated;
    });
  };

  const toggleReasoning = () => {
    setToolMode(prev => prev === "reasoning" ? "none" : "reasoning");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
          {attachments.map(att => (
            <div key={att.id} className="group relative">
              {att.isImage ? (
                <img 
                  src={att.data} 
                  alt={att.name}
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-700"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-400">
                  <div className="text-center">
                    <span className="text-lg">📄</span>
                    <p className="truncate w-14 px-1">{att.name.split('.').pop()}</p>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white group-hover:flex"
              >
                ×
              </button>
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
          toolMode === "reasoning" 
            ? "🧠 Reasoning mode: Ask complex analytical questions..."
            : toolMode === "vision" || attachments.some(a => a.isImage)
            ? "📷 Vision mode: Describe what you want to know about the image..."
            : "Ask anything… (Enter to send, Shift+Enter for newline)"
        }
        rows={1}
        disabled={disabled}
        className={`max-h-[150px] min-h-[44px] w-full resize-none rounded-xl border px-4 py-3 text-sm text-slate-100 shadow-inner shadow-slate-950/30 outline-none ring-1 ring-transparent transition focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          toolMode === "reasoning" 
            ? "border-purple-500/50 bg-purple-950/20" 
            : toolMode === "vision" || attachments.some(a => a.isImage)
            ? "border-emerald-500/50 bg-emerald-950/20"
            : "border-slate-800 bg-slate-950/70"
        }`}
      />
      
      <div className="flex items-center justify-between">
        {/* Tool buttons */}
        <div className="flex items-center gap-2">
          {/* Reasoning toggle */}
          <button
            type="button"
            onClick={toggleReasoning}
            disabled={disabled || attachments.some(a => a.isImage)}
            title="Toggle deep reasoning mode (deepseek-r1)"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              toolMode === "reasoning"
                ? "border-purple-500 bg-purple-500/20 text-purple-300"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-purple-500/50 hover:text-purple-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>🧠</span>
            <span className="hidden sm:inline">Reasoning</span>
          </button>

          {/* Image upload */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e, true)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={disabled}
            title="Upload images (uses vision model)"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              attachments.some(a => a.isImage)
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>📷</span>
            <span className="hidden sm:inline">Image</span>
          </button>

          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.js,.ts,.py,.html,.css,.csv,.xml,.yaml,.yml,.log,.sh,.bat,.ps1,.sql,.r,.java,.c,.cpp,.h,.go,.rs,.rb,.php,.swift,.kt"
            multiple
            onChange={(e) => handleFileSelect(e, false)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            title="Upload code/text files"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              attachments.some(a => !a.isImage)
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-amber-500/50 hover:text-amber-300"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>📎</span>
            <span className="hidden sm:inline">File</span>
          </button>

          {/* Active mode indicator */}
          {(toolMode !== "none" || attachments.length > 0) && (
            <span className="ml-2 text-[10px] text-slate-500">
              {toolMode === "reasoning" && "Using deepseek-r1 for analysis"}
              {attachments.some(a => a.isImage) && "Using llava for vision"}
              {attachments.some(a => !a.isImage) && !attachments.some(a => a.isImage) && `${attachments.length} file(s) attached`}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
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
