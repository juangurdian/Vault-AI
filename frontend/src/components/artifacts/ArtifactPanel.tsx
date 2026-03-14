"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Code,
  FileText,
  Table,
  Image,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Play,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ArtifactType = "code" | "document" | "table" | "image" | "html";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

interface ArtifactPanelProps {
  artifacts: Artifact[];
  onClose: () => void;
  onRunCode?: (code: string, language: string) => void;
}

const typeIcons: Record<ArtifactType, React.ReactNode> = {
  code: <Code className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  html: <Code className="h-4 w-4" />,
};

export default function ArtifactPanel({
  artifacts,
  onClose,
  onRunCode,
}: ArtifactPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(artifacts.length - 1);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (artifacts.length === 0) return null;

  const current = artifacts[currentIndex] || artifacts[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    if (onRunCode && current.type === "code") {
      onRunCode(current.content, current.language || "python");
    }
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`flex flex-col border-l border-white/10 bg-zinc-900/95 backdrop-blur-xl ${
        isExpanded ? "fixed inset-0 z-50" : "h-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">{typeIcons[current.type]}</span>
          <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
            {current.title}
          </span>
          {artifacts.length > 1 && (
            <span className="text-[10px] text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">
              {currentIndex + 1}/{artifacts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {artifacts.length > 1 && (
            <>
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() =>
                  setCurrentIndex(Math.min(artifacts.length - 1, currentIndex + 1))
                }
                disabled={currentIndex === artifacts.length - 1}
                className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {current.type === "code" && onRunCode && (
            <button
              onClick={handleRun}
              className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10"
              title="Run code"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          >
            {isExpanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {current.type === "code" && (
              <SyntaxHighlighter
                language={current.language || "text"}
                style={oneDark}
                customStyle={{
                  margin: 0,
                  borderRadius: "0.5rem",
                  fontSize: "0.8rem",
                  background: "rgba(0,0,0,0.3)",
                }}
                showLineNumbers
              >
                {current.content}
              </SyntaxHighlighter>
            )}
            {current.type === "document" && (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {current.content}
                </ReactMarkdown>
              </div>
            )}
            {current.type === "table" && (
              <div className="overflow-x-auto">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {current.content}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            {current.type === "image" && (
              <div className="flex justify-center">
                <img
                  src={current.content}
                  alt={current.title}
                  className="max-w-full rounded-lg"
                />
              </div>
            )}
            {current.type === "html" && (
              <iframe
                srcDoc={current.content}
                className="w-full h-[500px] rounded-lg border border-white/10 bg-white"
                sandbox="allow-scripts"
                title={current.title}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
