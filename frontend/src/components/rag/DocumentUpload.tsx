"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Trash2, Database, Check, AlertCircle, File } from "lucide-react";
import { GlowButton } from "@/components/animations";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

type Document = {
  id: string;
  metadata: Record<string, any>;
  preview: string;
};

type RagStats = {
  document_count: number;
  embedding_model: string;
};

type DocumentUploadProps = {
  open: boolean;
  onClose: () => void;
};

export default function DocumentUpload({ open, onClose }: DocumentUploadProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/rag/documents`),
        fetch(`${API_BASE}/rag/stats`),
      ]);
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents || []);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch {
      setError("Failed to load documents");
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchDocuments();
      setError(null);
      setSuccess(null);
    }
  }, [open, fetchDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    let uploadedCount = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "txt", "md"].includes(ext || "")) {
        setError(`Unsupported file type: ${file.name} (use PDF, TXT, or MD)`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("source", file.name);

        const res = await fetch(`${API_BASE}/rag/ingest`, {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedCount += data.chunks_added || 0;
        } else {
          const errText = await res.text();
          setError(`Failed to upload ${file.name}: ${errText}`);
        }
      } catch (err) {
        setError(`Upload error for ${file.name}: ${String(err)}`);
      }
    }

    if (uploadedCount > 0) {
      setSuccess(`Successfully ingested ${uploadedCount} chunks`);
    }
    setUploading(false);
    fetchDocuments();
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`${API_BASE}/rag/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setSuccess("Document deleted");
        setTimeout(() => setSuccess(null), 2000);
      }
    } catch {
      setError("Failed to delete document");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      handleUpload(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop with blur */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-white/[0.08] bg-gradient-to-b from-[#0a0a12]/98 via-[#111118]/99 to-[#16161f]/98 shadow-2xl backdrop-blur-xl"
        initial={{ x: "100%", opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.04] bg-white/[0.02] backdrop-blur-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold gradient-text">Knowledge Base</h2>
              {stats && (
                <p className="text-xs text-slate-500 mt-1">
                  {stats.document_count} chunks &middot; {stats.embedding_model}
                </p>
              )}
            </div>
            <motion.button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/5"
              whileHover={{ scale: 1.05, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        {/* Upload area */}
        <div className="px-6 py-4">
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`
              relative rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
              ${dragActive
                ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
              }
            `}
            whileHover={!dragActive ? { scale: 1.01 } : {}}
          >
            <motion.div
              className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center ring-1 ring-cyan-500/30"
              animate={uploading ? {
                rotate: [0, 10, -10, 0],
              } : {}}
              transition={{ duration: 1, repeat: uploading ? Infinity : 0 }}
            >
              <Upload className="h-6 w-6 text-cyan-400" />
            </motion.div>

            <p className="text-sm font-medium text-slate-200">
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="mt-2 text-xs text-slate-500">Supports PDF, TXT, MD files</p>

            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md"
              onChange={(e) => handleUpload(e.target.files)}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={uploading}
            />
          </motion.div>
        </div>

        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="mx-6 mb-2 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs text-red-400"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              className="mx-6 mb-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-xs text-emerald-400"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Check className="h-3.5 w-3.5" />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <Database className="h-3 w-3" />
              Documents
            </p>
            <span className="text-[10px] text-slate-500">{documents.length}</span>
          </div>

          {documents.length === 0 ? (
            <motion.div
              className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <File className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No documents in knowledge base</p>
              <p className="text-[10px] text-slate-600 mt-1">Upload PDFs, TXT, or MD files to get started</p>
            </motion.div>
          ) : (
            <motion.div className="space-y-2">
              {documents.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/[0.1] hover:bg-white/[0.04]"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4 }}
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center ring-1 ring-white/[0.08]">
                    <FileText className="h-4 w-4 text-cyan-400/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">
                      {doc.metadata?.source || doc.id.slice(0, 12)}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{doc.preview}</p>
                  </div>
                  <motion.button
                    onClick={() => handleDelete(doc.id)}
                    className="shrink-0 rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                    title="Delete"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </motion.button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Footer info */}
        <div className="shrink-0 border-t border-white/[0.04] bg-white/[0.02] px-6 py-4">
          <p className="text-[10px] text-slate-600">
            Documents are embedded using the configured embedding model for semantic search in RAG queries.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
