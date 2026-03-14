"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Upload,
  FileText,
  Trash2,
  Database,
  Check,
  AlertCircle,
  File,
  Search,
  RefreshCw,
  FolderPlus,
  Folder,
  ChevronDown,
  BarChart3,
  CheckSquare,
  Square,
  Layers,
  Hash,
  HardDrive,
  Cpu,
} from "lucide-react";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "html", "csv"];
const SUPPORTED_LABEL = "PDF, DOCX, TXT, MD, HTML, CSV";

type Document = {
  id: string;
  metadata: Record<string, any>;
  preview: string;
};

type RagStats = {
  document_count: number;
  embedding_model: string;
  bm25_index_size?: number;
  collection_name?: string;
};

type Collection = {
  id: string;
  name: string;
  documentIds: string[];
  createdAt: string;
};

type Tab = "documents" | "collections";

type DocumentManagerProps = {
  open: boolean;
  onClose: () => void;
};

export default function DocumentManager({ open, onClose }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<RagStats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("documents");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reindexingIds, setReindexingIds] = useState<Set<string>>(new Set());

  // Collections (client-side, persisted in localStorage)
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  const newCollectionInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Persistence for collections ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rag-collections");
      if (stored) setCollections(JSON.parse(stored));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (collections.length > 0) {
      localStorage.setItem("rag-collections", JSON.stringify(collections));
    }
  }, [collections]);

  // ---- Data fetching ----
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchDocuments();
      setError(null);
      setSuccess(null);
      setSelectedIds(new Set());
      setSearchQuery("");
    }
  }, [open, fetchDocuments]);

  // ---- Filtered documents ----
  const filteredDocuments = useMemo(() => {
    let docs = documents;

    // Filter by active collection
    if (activeCollectionId) {
      const col = collections.find((c) => c.id === activeCollectionId);
      if (col) {
        const idSet = new Set(col.documentIds);
        docs = docs.filter((d) => idSet.has(d.id));
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(
        (d) =>
          (d.metadata?.source || "").toLowerCase().includes(q) ||
          (d.preview || "").toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      );
    }

    return docs;
  }, [documents, searchQuery, activeCollectionId, collections]);

  // ---- Upload ----
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    let uploadedCount = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext || "")) {
        setError(`Unsupported file type: ${file.name} (use ${SUPPORTED_LABEL})`);
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

  // ---- Delete single ----
  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`${API_BASE}/rag/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        // Remove from collections
        setCollections((prev) =>
          prev.map((c) => ({
            ...c,
            documentIds: c.documentIds.filter((id) => id !== docId),
          }))
        );
        setSuccess("Document deleted");
        setTimeout(() => setSuccess(null), 2000);
      }
    } catch {
      setError("Failed to delete document");
    }
  };

  // ---- Bulk delete ----
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setError(null);
    setSuccess(null);

    let deleted = 0;
    for (const docId of selectedIds) {
      try {
        const res = await fetch(`${API_BASE}/rag/documents/${docId}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch {
        /* continue */
      }
    }

    if (deleted > 0) {
      setSuccess(`Deleted ${deleted} document${deleted > 1 ? "s" : ""}`);
      setTimeout(() => setSuccess(null), 3000);
    }
    setSelectedIds(new Set());
    fetchDocuments();
  };

  // ---- Re-index ----
  const handleReindex = async (doc: Document) => {
    const docId = doc.id;
    setReindexingIds((prev) => new Set(prev).add(docId));
    setError(null);

    try {
      // Delete then re-ingest via JSON with the preview text
      await fetch(`${API_BASE}/rag/documents/${docId}`, { method: "DELETE" });

      const res = await fetch(`${API_BASE}/rag/ingest/json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: doc.preview,
          source: doc.metadata?.source || docId,
        }),
      });

      if (res.ok) {
        setSuccess("Document re-indexed successfully");
        setTimeout(() => setSuccess(null), 2000);
        fetchDocuments();
      } else {
        const errText = await res.text();
        setError(`Re-index failed: ${errText}`);
      }
    } catch (err) {
      setError(`Re-index error: ${String(err)}`);
    } finally {
      setReindexingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  // ---- Drag-and-drop ----
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      handleUpload(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---- Selection helpers ----
  const toggleSelect = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map((d) => d.id)));
    }
  };

  // ---- Collection helpers ----
  const createCollection = () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const col: Collection = {
      id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      documentIds: [],
      createdAt: new Date().toISOString(),
    };
    setCollections((prev) => [...prev, col]);
    setNewCollectionName("");
    setShowNewCollection(false);
  };

  const deleteCollection = (colId: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== colId));
    if (activeCollectionId === colId) setActiveCollectionId(null);
  };

  const addSelectedToCollection = (colId: string) => {
    if (selectedIds.size === 0) return;
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== colId) return c;
        const merged = new Set([...c.documentIds, ...selectedIds]);
        return { ...c, documentIds: Array.from(merged) };
      })
    );
    setSuccess(`Added ${selectedIds.size} doc(s) to collection`);
    setTimeout(() => setSuccess(null), 2000);
    setSelectedIds(new Set());
  };

  // ---- Format helpers ----
  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // ---- Focus new collection input ----
  useEffect(() => {
    if (showNewCollection && newCollectionInputRef.current) {
      newCollectionInputRef.current.focus();
    }
  }, [showNewCollection]);

  if (!open) return null;

  const allSelected =
    filteredDocuments.length > 0 && selectedIds.size === filteredDocuments.length;
  const someSelected = selectedIds.size > 0;

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
        className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-white/[0.08] bg-gradient-to-b from-[#0a0a12]/98 via-[#111118]/99 to-[#16161f]/98 shadow-2xl backdrop-blur-xl"
        initial={{ x: "100%", opacity: 0.8 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.04] bg-white/[0.02] backdrop-blur-xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold gradient-text">Document Manager</h2>
              {stats && (
                <p className="text-xs text-slate-500 mt-1">
                  {stats.document_count} chunks &middot; {stats.embedding_model}
                  {stats.collection_name ? ` &middot; ${stats.collection_name}` : ""}
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

          {/* Stats bar */}
          {stats && (
            <motion.div
              className="mt-3 grid grid-cols-4 gap-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {[
                { icon: Layers, label: "Documents", value: documents.length },
                { icon: Hash, label: "Chunks", value: stats.document_count },
                { icon: Cpu, label: "Model", value: stats.embedding_model?.split("/").pop() || "—" },
                { icon: HardDrive, label: "BM25 Size", value: formatSize(stats.bm25_index_size) },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center"
                >
                  <Icon className="h-3 w-3 text-cyan-400/60 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="text-xs font-medium text-slate-300 truncate">{value}</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* Tabs */}
          <div className="mt-4 flex gap-1 rounded-xl bg-white/[0.03] p-1">
            {(["documents", "collections"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "documents") setActiveCollectionId(null);
                }}
                className={`
                  flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all
                  ${
                    activeTab === tab
                      ? "bg-white/[0.08] text-slate-200 shadow-sm"
                      : "text-slate-500 hover:text-slate-400 hover:bg-white/[0.03]"
                  }
                `}
              >
                {tab === "documents" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <FileText className="h-3 w-3" /> Documents
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Folder className="h-3 w-3" /> Collections
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="px-6 py-4 shrink-0">
          <motion.div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`
              relative rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-300
              ${
                dragActive
                  ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04]"
              }
            `}
            whileHover={!dragActive ? { scale: 1.005 } : {}}
          >
            <motion.div
              className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 flex items-center justify-center ring-1 ring-cyan-500/30"
              animate={
                uploading
                  ? { rotate: [0, 10, -10, 0] }
                  : {}
              }
              transition={{ duration: 1, repeat: uploading ? Infinity : 0 }}
            >
              <Upload className="h-5 w-5 text-cyan-400" />
            </motion.div>

            <p className="text-sm font-medium text-slate-200">
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              Supports {SUPPORTED_LABEL} files
            </p>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.html,.csv"
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
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{error}</span>
              <button
                onClick={() => setError(null)}
                className="shrink-0 rounded p-0.5 hover:bg-red-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              className="mx-6 mb-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-xs text-emerald-400"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <AnimatePresence mode="wait">
            {activeTab === "documents" ? (
              <motion.div
                key="documents-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
              >
                {/* Search bar and bulk actions */}
                <div className="mb-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search documents..."
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none transition-all focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-400"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-3 w-3 text-cyan-400" />
                        ) : (
                          <Square className="h-3 w-3" />
                        )}
                        {allSelected ? "Deselect all" : "Select all"}
                      </button>

                      {someSelected && (
                        <motion.div
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <span className="text-[10px] text-cyan-400 font-medium">
                            {selectedIds.size} selected
                          </span>
                          <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1 text-[10px] text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                            Delete
                          </button>

                          {/* Assign to collection dropdown */}
                          {collections.length > 0 && (
                            <div className="relative group">
                              <button className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 text-[10px] text-cyan-400 transition-colors hover:bg-cyan-500/20">
                                <FolderPlus className="h-2.5 w-2.5" />
                                Add to
                                <ChevronDown className="h-2.5 w-2.5" />
                              </button>
                              <div className="absolute left-0 top-full z-20 mt-1 hidden min-w-[160px] rounded-xl border border-white/[0.08] bg-[#111118] p-1 shadow-2xl group-hover:block">
                                {collections.map((col) => (
                                  <button
                                    key={col.id}
                                    onClick={() => addSelectedToCollection(col.id)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] text-slate-300 transition-colors hover:bg-white/[0.06]"
                                  >
                                    <Folder className="h-3 w-3 text-cyan-400/60" />
                                    {col.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {activeCollectionId && (
                        <button
                          onClick={() => setActiveCollectionId(null)}
                          className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-2 py-1 text-[10px] text-violet-400 transition-colors hover:bg-violet-500/20"
                        >
                          Clear filter
                        </button>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {filteredDocuments.length} doc{filteredDocuments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Loading state */}
                {loading && documents.length === 0 ? (
                  <motion.div
                    className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-12 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <motion.div
                      className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <p className="text-xs text-slate-500">Loading documents...</p>
                  </motion.div>
                ) : filteredDocuments.length === 0 ? (
                  <motion.div
                    className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <File className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      {searchQuery
                        ? "No documents match your search"
                        : activeCollectionId
                        ? "No documents in this collection"
                        : "No documents in knowledge base"}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Upload {SUPPORTED_LABEL} files to get started
                    </p>
                  </motion.div>
                ) : (
                  <motion.div className="space-y-2">
                    {filteredDocuments.map((doc, index) => {
                      const isSelected = selectedIds.has(doc.id);
                      const isReindexing = reindexingIds.has(doc.id);
                      const source = doc.metadata?.source || doc.id.slice(0, 12);
                      const chunkCount = doc.metadata?.chunk_count;
                      const fileSize = doc.metadata?.file_size;
                      const dateAdded = doc.metadata?.date_added || doc.metadata?.created_at;

                      return (
                        <motion.div
                          key={doc.id}
                          className={`
                            group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all
                            ${
                              isSelected
                                ? "border-cyan-500/30 bg-cyan-500/5"
                                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                            }
                          `}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          whileHover={{ x: 4 }}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleSelect(doc.id)}
                            className="mt-0.5 shrink-0 text-slate-500 transition-colors hover:text-slate-300"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-cyan-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>

                          {/* Icon */}
                          <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500/10 to-violet-500/10 flex items-center justify-center ring-1 ring-white/[0.08]">
                            <FileText className="h-4 w-4 text-cyan-400/80" />
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-200">{source}</p>
                            <p className="mt-0.5 truncate text-[10px] text-slate-500">
                              {doc.preview}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-600">
                              {chunkCount != null && (
                                <span className="flex items-center gap-0.5">
                                  <Hash className="h-2.5 w-2.5" />
                                  {chunkCount} chunks
                                </span>
                              )}
                              {fileSize != null && (
                                <span className="flex items-center gap-0.5">
                                  <HardDrive className="h-2.5 w-2.5" />
                                  {formatSize(fileSize)}
                                </span>
                              )}
                              {dateAdded && (
                                <span>{formatDate(dateAdded)}</span>
                              )}
                              <span className="truncate max-w-[100px]" title={doc.id}>
                                {doc.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <motion.button
                              onClick={() => handleReindex(doc)}
                              disabled={isReindexing}
                              className="rounded-lg p-2 text-slate-500 transition-all hover:bg-cyan-500/10 hover:text-cyan-400 disabled:opacity-50"
                              title="Re-index"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${isReindexing ? "animate-spin" : ""}`}
                              />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDelete(doc.id)}
                              className="rounded-lg p-2 text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-400"
                              title="Delete"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              /* Collections Tab */
              <motion.div
                key="collections-tab"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {/* Create collection */}
                <div className="mb-4">
                  {showNewCollection ? (
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <input
                        ref={newCollectionInputRef}
                        type="text"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") createCollection();
                          if (e.key === "Escape") setShowNewCollection(false);
                        }}
                        placeholder="Collection name..."
                        className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/20"
                      />
                      <button
                        onClick={createCollection}
                        disabled={!newCollectionName.trim()}
                        className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:opacity-40"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewCollection(false);
                          setNewCollectionName("");
                        }}
                        className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => setShowNewCollection(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-3 text-xs text-slate-400 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400"
                    >
                      <FolderPlus className="h-4 w-4" />
                      New Collection
                    </button>
                  )}
                </div>

                {/* Collection list */}
                {collections.length === 0 ? (
                  <motion.div
                    className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Folder className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No collections yet</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Create collections to organize documents by topic
                    </p>
                  </motion.div>
                ) : (
                  <motion.div className="space-y-2">
                    {collections.map((col, index) => (
                      <motion.div
                        key={col.id}
                        className={`
                          group flex items-start gap-3 rounded-xl border px-4 py-3 transition-all cursor-pointer
                          ${
                            activeCollectionId === col.id
                              ? "border-violet-500/30 bg-violet-500/5"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                          }
                        `}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4 }}
                        onClick={() => {
                          setActiveCollectionId(col.id);
                          setActiveTab("documents");
                        }}
                      >
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-violet-500/10 to-cyan-500/10 flex items-center justify-center ring-1 ring-white/[0.08]">
                          <Folder className="h-4 w-4 text-violet-400/80" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">
                            {col.name}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                            <span>{col.documentIds.length} document{col.documentIds.length !== 1 ? "s" : ""}</span>
                            <span>{formatDate(col.createdAt)}</span>
                          </div>
                        </div>
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCollection(col.id);
                          }}
                          className="shrink-0 rounded-lg p-2 text-slate-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          title="Delete collection"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </motion.button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="shrink-0 border-t border-white/[0.04] bg-white/[0.02] px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600">
              Documents are embedded for semantic search and BM25 hybrid retrieval in RAG queries.
            </p>
            <motion.button
              onClick={fetchDocuments}
              disabled={loading}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-400 disabled:opacity-50"
              title="Refresh"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
