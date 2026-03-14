"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Copy, Check, Loader2, Terminal, Edit3, Eye, CheckCircle2, XCircle } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeRunnerProps {
  code: string;
  language: string;
  onRun?: (code: string, language: string) => Promise<{ stdout: string; stderr: string; success: boolean }>;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  success: boolean;
}

async function executeCode(code: string, language: string): Promise<ExecutionResult> {
  const res = await fetch("/api/agents/execute-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language }),
  });
  if (!res.ok) {
    return { stdout: "", stderr: `Request failed with status ${res.status}`, success: false };
  }
  return res.json();
}

export default function CodeRunner({ code: initialCode, language, onRun }: CodeRunnerProps) {
  const [code, setCode] = useState(initialCode);
  const [editing, setEditing] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = onRun ? await onRun(code, language) : await executeCode(code, language);
      setResult(res);
    } catch (err: any) {
      setResult({ stdout: "", stderr: err?.message ?? "Execution failed", success: false });
    } finally {
      setRunning(false);
    }
  }, [code, language, onRun]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const toggleEdit = useCallback(() => {
    setEditing(prev => {
      const next = !prev;
      if (next) {
        // Focus textarea after render
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
      return next;
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border border-white/[0.06] bg-zinc-900 overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-indigo-400" />
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleEdit}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
            title={editing ? "Preview" : "Edit"}
          >
            {editing ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
            {editing ? "Preview" : "Edit"}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {running ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      {/* Code display / editor */}
      <div className="relative">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            spellCheck={false}
            className="w-full min-h-[120px] p-4 bg-[#282c34] text-zinc-200 text-sm font-mono leading-relaxed resize-y outline-none border-none"
            style={{ tabSize: 2 }}
          />
        ) : (
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: "1rem",
              background: "#282c34",
              fontSize: "0.875rem",
              lineHeight: "1.625",
              borderRadius: 0,
            }}
            wrapLongLines
          >
            {code}
          </SyntaxHighlighter>
        )}
      </div>

      {/* Output panel */}
      <AnimatePresence>
        {(result || running) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/[0.06] overflow-hidden"
          >
            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/[0.04] bg-zinc-950/50">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Output</span>
              {result && (
                result.success ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400" />
                )
              )}
              {running && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
            </div>
            <div className="p-4 bg-zinc-950/30 max-h-64 overflow-auto">
              {running && !result && (
                <span className="text-xs text-zinc-500">Executing...</span>
              )}
              {result && (
                <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
                  {result.stdout && (
                    <span className="text-emerald-400">{result.stdout}</span>
                  )}
                  {result.stderr && (
                    <span className="text-red-400">{result.stdout ? "\n" : ""}{result.stderr}</span>
                  )}
                  {!result.stdout && !result.stderr && (
                    <span className="text-zinc-500">(no output)</span>
                  )}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
