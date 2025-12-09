"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - style import
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type MarkdownRendererProps = {
  content: string;
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="markdown-content"
      components={{
        // Headers
        h1: ({ node, ...props }) => (
          <h1 className="mb-3 mt-4 text-xl font-bold text-slate-100 first:mt-0" {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className="mb-2 mt-3 text-lg font-semibold text-slate-100" {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="mb-2 mt-3 text-base font-semibold text-slate-200" {...props} />
        ),
        // Paragraphs
        p: ({ node, ...props }) => (
          <p className="mb-3 text-sm leading-relaxed text-slate-200 last:mb-0" {...props} />
        ),
        // Lists
        ul: ({ node, ...props }) => (
          <ul className="mb-3 ml-4 list-disc space-y-1 text-slate-200" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="mb-3 ml-4 list-decimal space-y-1 text-slate-200" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="text-sm leading-relaxed" {...props} />
        ),
        // Code blocks
        code: ({ node, inline, className, children, ...props }: any) => {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");

          if (!inline && match) {
            return (
              <div className="my-3 overflow-hidden rounded-lg border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400">{language}</span>
                </div>
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  className="!m-0 !rounded-b-lg !bg-slate-950 !p-4 text-xs"
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: "#020617",
                    borderRadius: 0,
                  }}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Inline code
          return (
            <code
              className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-cyan-300"
              {...props}
            >
              {children}
            </code>
          );
        },
        // Blockquotes
        blockquote: ({ node, ...props }) => (
          <blockquote
            className="my-3 border-l-4 border-cyan-500/50 bg-slate-900/50 pl-4 italic text-slate-300"
            {...props}
          />
        ),
        // Links
        a: ({ node, ...props }) => (
          <a
            className="text-cyan-400 underline decoration-cyan-500/50 underline-offset-2 transition hover:text-cyan-300 hover:decoration-cyan-400"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        // Horizontal rule
        hr: ({ node, ...props }) => (
          <hr className="my-4 border-slate-700" {...props} />
        ),
        // Tables
        table: ({ node, ...props }) => (
          <div className="my-3 overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-700" {...props} />
          </div>
        ),
        thead: ({ node, ...props }) => (
          <thead className="bg-slate-800/50" {...props} />
        ),
        tbody: ({ node, ...props }) => (
          <tbody className="divide-y divide-slate-800" {...props} />
        ),
        tr: ({ node, ...props }) => (
          <tr className="border-b border-slate-700" {...props} />
        ),
        th: ({ node, ...props }) => (
          <th className="border border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-200" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="border border-slate-700 px-3 py-2 text-xs text-slate-300" {...props} />
        ),
        // Strong (bold)
        strong: ({ node, ...props }) => (
          <strong className="font-semibold text-slate-100" {...props} />
        ),
        // Emphasis (italic)
        em: ({ node, ...props }) => (
          <em className="italic text-slate-200" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

