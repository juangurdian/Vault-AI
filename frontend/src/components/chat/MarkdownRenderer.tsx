"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check } from "lucide-react";

type MarkdownRendererProps = {
  content: string;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded-md bg-white/[0.08] px-2.5 py-1.5 text-[10px] font-medium text-zinc-400 transition hover:bg-white/[0.12] hover:text-zinc-200 flex items-center gap-1.5"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.div
            key="check"
            className="flex items-center gap-1.5 text-emerald-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Check className="h-3 w-3" />
            <span>Copied</span>
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            className="flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Copy className="h-3 w-3" />
            <span>Copy</span>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1
              className="mb-4 mt-6 border-b border-white/[0.08] pb-2 text-xl font-semibold text-zinc-100"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="mb-3 mt-5 text-lg font-semibold text-zinc-100"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="mb-2 mt-4 text-base font-medium text-zinc-200"
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="mb-2 mt-3 text-sm font-medium text-zinc-200"
              {...props}
            />
          ),
          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="mb-3 leading-7 text-zinc-300" {...props} />
          ),
          // Lists
          ul: ({ node, ...props }) => (
            <ul
              className="mb-3 ml-5 list-disc space-y-1 text-zinc-300"
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="mb-3 ml-5 list-decimal space-y-1 text-zinc-300"
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li className="text-zinc-300 leading-7" {...props} />
          ),
          // Code — handles both inline and block
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");

            // Inline code
            if (!match) {
              return (
                <code
                  className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[0.85em] font-mono text-indigo-300"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Block code with syntax highlighting
            const codeString = String(children).replace(/\n$/, "");
            const language = match[1];

            return (
              <div className="mb-4 overflow-hidden rounded-lg border border-white/[0.08]">
                {/* Header bar */}
                <div className="flex items-center justify-between bg-[#0c0c0e] px-4 py-2.5 border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <span className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                      {language}
                    </span>
                  </div>
                  <CopyButton text={codeString} />
                </div>
                {/* Code body */}
                <SyntaxHighlighter
                  style={oneDark}
                  language={language}
                  PreTag="div"
                  showLineNumbers={codeString.split("\n").length > 5}
                  customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    background: "#09090b",
                    fontSize: "0.8rem",
                    lineHeight: "1.65",
                    padding: "1rem",
                  }}
                  lineNumberStyle={{
                    color: "#52525b",
                    minWidth: "2.5em",
                    paddingRight: "1em",
                    userSelect: "none",
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          },
          // Pre — just pass through children (code block handles rendering)
          pre: ({ node, children }) => <>{children}</>,
          // Links
          a: ({ node, ...props }) => (
            <a
              className="text-indigo-400 underline decoration-indigo-400/30 underline-offset-2 transition hover:text-indigo-300 hover:decoration-indigo-300"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-4 border-l-2 border-indigo-500/50 bg-white/[0.03] pl-4 pr-2 py-2 italic text-zinc-400 rounded-r-lg"
              {...props}
            />
          ),
          // Tables
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-white/[0.08]">
              <table
                className="min-w-full border-collapse"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-white/[0.03]" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="border-b border-white/[0.06] px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-400"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className="border-b border-white/[0.04] px-4 py-2.5 text-sm text-zinc-300"
              {...props}
            />
          ),
          tr: ({ node, ...props }) => (
            <tr
              className="transition-colors hover:bg-white/[0.02]"
              {...props}
            />
          ),
          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-white/[0.06]" {...props} />
          ),
          // Strong / em
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-zinc-200" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-zinc-400" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
