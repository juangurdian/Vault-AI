"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownRendererProps = {
  content: string;
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-content prose prose-invert prose-slate max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ node, ...props }) => (
            <h1 className="mb-4 mt-6 text-2xl font-bold text-slate-100" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="mb-3 mt-5 text-xl font-bold text-slate-100" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="mb-2 mt-4 text-lg font-semibold text-slate-100" {...props} />
          ),
          // Paragraphs
          p: ({ node, ...props }) => (
            <p className="mb-3 leading-relaxed text-slate-200" {...props} />
          ),
          // Lists
          ul: ({ node, ...props }) => (
            <ul className="mb-3 ml-6 list-disc space-y-1 text-slate-200" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="mb-3 ml-6 list-decimal space-y-1 text-slate-200" {...props} />
          ),
          li: ({ node, ...props }) => <li className="text-slate-200" {...props} />,
          // Code blocks
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            
            if (isInline) {
              return (
                <code
                  className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-cyan-300"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            return (
              <code
                className="block overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-200"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node, ...props }) => (
            <pre className="mb-4 overflow-x-auto rounded-lg bg-slate-900 p-4" {...props} />
          ),
          // Links
          a: ({ node, ...props }) => (
            <a
              className="text-cyan-400 underline hover:text-cyan-300"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          // Blockquotes
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="my-4 border-l-4 border-cyan-500/50 bg-slate-900/50 pl-4 italic text-slate-300"
              {...props}
            />
          ),
          // Tables
          table: ({ node, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-slate-700" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th
              className="border border-slate-700 bg-slate-800 px-4 py-2 text-left font-semibold text-slate-100"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-slate-700 px-4 py-2 text-slate-200" {...props} />
          ),
          // Horizontal rule
          hr: ({ node, ...props }) => (
            <hr className="my-6 border-slate-700" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}



