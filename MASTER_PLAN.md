# Vault-AI Master Improvement Plan

## Context

Vault-AI is a local-first AI platform at ~70% completion. The core chat + routing works, but the project needs significant upgrades to become a competitive open-source community project. Research into the 2025-2026 AI ecosystem reveals major advances in model routing (RouteLLM, semantic routing), agentic architectures (LangGraph, MCP), RAG techniques (GraphRAG, hybrid search, reranking), and UI patterns (artifacts, generative UI, voice). This plan upgrades every major subsystem across 6 phases.

**Constraints**: Purely local (no cloud APIs), open-source, hardware auto-adaptive (from 4GB to 24GB+ VRAM).

---

## Phase 1: Foundation & Hardware Intelligence (Priority: Critical)

### 1.1 Hardware Auto-Detection & Adaptive Profiles
**Why**: Community project must work across diverse hardware. Currently hardcoded for RTX 3070.

**Changes**:
- New file: `backend/hardware/detector.py` — Detect GPU (NVIDIA via nvidia-smi, AMD via rocm-smi), VRAM, RAM, CPU cores
- New file: `backend/hardware/profiles.py` — Define hardware tiers (Minimal: 4GB, Standard: 8GB, Performance: 16GB, Ultra: 24GB+) with recommended model sets per tier
- Modify `backend/router/model_profiles.py` — Auto-select model recommendations based on detected hardware tier instead of hardcoded defaults
- Modify `backend/config.py` — Add `hardware_tier`, `auto_detect_hardware`, `max_vram_usage_percent` settings
- Modify `frontend/src/components/settings/SettingsPanel.tsx` — Show detected hardware info, allow manual tier override

**New dependencies**: `pynvml` (NVIDIA GPU monitoring)

### 1.2 Model Registry Overhaul
**Why**: Hardcoded to 6 models. Needs to support the full 2025-2026 model ecosystem.

**Changes**:
- Rewrite `backend/router/model_profiles.py`:
  - Dynamic model profiling via Ollama model metadata (parameter count, quantization, architecture)
  - Support model families: Qwen 3 (0.6B-235B), Llama 4 Scout/Maverick, DeepSeek R1/V3, Gemma 3, Mistral, Phi-4, CodeLlama, StarCoder2
  - Auto-detect model capabilities from modelfile (vision, tool-calling, embedding, code)
  - Estimate VRAM from parameter count + quantization (not hardcoded)
  - Per-model benchmarking: run a quick inference test on first discovery to measure actual tok/s
- Modify `backend/api/models.py` — Return enriched model metadata including capabilities, actual benchmarks, recommended hardware tier

### 1.3 Token Counting Fix
**Why**: Current `len(text) // 4 * 1.1` is inaccurate. Affects context packing and routing.

**Changes**:
- Add `tiktoken` or model-specific tokenizer integration to `backend/router/router.py`
- Fallback to current heuristic if tokenizer unavailable
- Cache tokenizer instances per model family

**New dependencies**: `tiktoken`

### 1.4 Configuration & First-Run Experience
**Why**: New users need guided setup.

**Changes**:
- New file: `backend/api/setup.py` — First-run wizard API (detect Ollama, suggest models for hardware, pull models)
- New frontend route/component: `frontend/src/components/setup/SetupWizard.tsx` — Step-by-step onboarding (hardware detected → models recommended → pull models → ready)
- Modify `backend/main.py` — Check if first-run, redirect to setup

---

## Phase 2: Intelligent Router 2.0 (Priority: Critical)

### 2.1 Embedding-Based Semantic Router
**Why**: Regex classification is brittle and misses nuance. Embedding-based routing (as used by RouteLLM, vLLM Semantic Router) is dramatically more accurate.

**Changes**:
- Rewrite `backend/router/classifier.py`:
  - Generate query embeddings using the local embedding model (nomic-embed-text or better)
  - Maintain a set of "route embeddings" — reference embeddings for each task type computed from example queries
  - Classify by cosine similarity to route embeddings (fast, no LLM call needed)
  - Keep regex as fast-path for obvious patterns (code blocks, image URLs)
  - Add confidence calibration: if embedding similarity is below threshold, fall back to LLM routing
- New file: `backend/router/route_embeddings.py` — Pre-computed route embeddings + online learning from user feedback
- Modify `backend/router/router.py`:
  - New routing pipeline: Cache → Embedding Router → LLM Router → Regex Fallback
  - Add model cascading: try fast model first, escalate to larger if response quality is low
  - Implement quality scoring on responses (coherence, completeness heuristics)

### 2.2 Learned Router with Feedback Loop
**Why**: RouteLLM showed that learned routers outperform heuristic ones by 85% cost reduction.

**Changes**:
- Modify `backend/storage/feedback.py`:
  - Store detailed routing outcomes: query embedding, chosen model, task type, user rating, response time, token count
  - Build training data for router improvement
- New file: `backend/router/learned_router.py`:
  - Simple logistic regression / small neural net trained on routing outcomes
  - Periodically retrain from feedback data (background task)
  - Predict optimal model for new queries based on embedding + features
- Modify `backend/router/router.py` — Integrate learned router as primary, with embedding router as fallback

### 2.3 Multi-Model Orchestration
**Why**: Complex tasks benefit from using multiple models (fast for planning, reasoning for analysis, coding for implementation).

**Changes**:
- New file: `backend/router/orchestrator.py`:
  - Query decomposition: break complex queries into subtasks
  - Assign each subtask to optimal model type
  - Parallel execution where possible
  - Result synthesis using general model
- Modify `backend/api/chat.py` — Support orchestrated multi-model responses
- Modify frontend to show which models contributed to each part of the response

---

## Phase 3: Advanced RAG & Knowledge System (Priority: High)

### 3.1 Hybrid Search (BM25 + Vector)
**Why**: Pure vector search misses keyword-exact matches. Hybrid search is now standard for production RAG.

**Changes**:
- Rewrite `backend/rag/vector_store.py`:
  - Add BM25 index alongside ChromaDB vectors (using `rank_bm25` library)
  - Implement Reciprocal Rank Fusion (RRF) to merge BM25 + vector results
  - Add metadata filtering support
- New file: `backend/rag/reranker.py`:
  - Cross-encoder reranking using a small local model (e.g., `cross-encoder/ms-marco-MiniLM-L-6-v2` via sentence-transformers, already a dependency)
  - Rerank top-K results from hybrid search to top-N
  - Optional: ColBERT-style late interaction if model available

**New dependencies**: `rank_bm25`

### 3.2 Smart Chunking & Ingestion Pipeline
**Why**: Current ingestion is minimal (just content/text keys). No chunking strategy.

**Changes**:
- Rewrite `backend/rag/ingestion.py`:
  - Semantic chunking: split by meaning boundaries, not fixed size
  - Overlapping chunks with configurable window
  - Contextual embedding (Anthropic pattern): prepend document context to each chunk before embedding
  - Support formats: PDF (via `pymupdf`), DOCX (via `python-docx`), Markdown, HTML, CSV, code files
  - Extract metadata: title, author, date, section headers
  - Deduplication via content hashing
- New file: `backend/rag/chunking.py` — Chunking strategies (semantic, recursive, fixed-size)

**New dependencies**: `pymupdf`, `python-docx`

### 3.3 Better Embeddings
**Why**: nomic-embed-text is decent but Nomic Embed v2 (MoE) and BGE-M3 are significantly better.

**Changes**:
- Modify `backend/rag/vector_store.py`:
  - Support multiple embedding models (configurable)
  - Default to `nomic-embed-text-v2` if available via Ollama, or `bge-m3`
  - Add embedding model benchmark on first run
  - Support matryoshka embeddings (variable dimension for speed/quality tradeoff)

### 3.4 Document Management UI
**Why**: RAG backend exists but no frontend for document upload/management.

**Changes**:
- New component: `frontend/src/components/rag/DocumentManager.tsx`:
  - Drag-and-drop file upload
  - Document list with metadata, chunk count, status
  - Search within documents
  - Delete/re-index documents
  - Collection management (create topic-specific collections)
- New API endpoints in `backend/api/rag.py`:
  - `GET /api/rag/documents` — List all documents
  - `DELETE /api/rag/documents/{id}` — Remove document
  - `POST /api/rag/collections` — Create collection
  - `GET /api/rag/stats` — Index statistics

### 3.5 GraphRAG (Future-Ready)
**Why**: GraphRAG enables multi-hop reasoning over connected knowledge. Major advancement in RAG.

**Changes**:
- New file: `backend/rag/graph_store.py`:
  - Entity extraction from documents using local LLM
  - Relationship extraction and knowledge graph construction
  - Store as adjacency list in SQLite (lightweight, no Neo4j dependency)
  - Graph traversal for multi-hop queries
  - Community detection for document clustering
- Modify `backend/rag/deep_research.py` — Use graph context alongside vector search

---

## Phase 4: MCP Integration & Agentic Architecture (Priority: High)

### 4.1 MCP Server Implementation
**Why**: MCP is the industry standard for tool integration. Implementing MCP makes Vault-AI compatible with the entire MCP ecosystem (1000+ tools).

**Changes**:
- New file: `backend/mcp/server.py`:
  - Implement MCP server protocol (JSON-RPC over stdio/SSE)
  - Expose Vault-AI's capabilities as MCP tools: chat, search, RAG query, image generate
  - Expose documents as MCP resources
  - Support MCP prompts (reusable prompt templates)
- New file: `backend/mcp/client.py`:
  - MCP client to connect to external MCP servers
  - Auto-discover and register tools from connected MCP servers
  - Proxy MCP tool calls through the agent system
- Modify `backend/agents/tools/registry.py`:
  - Register MCP tools alongside native tools
  - Unified tool interface: native tools + MCP tools appear identical to agents
- Modify `backend/config.py` — Add MCP server configuration (list of MCP server commands/URLs)

**New dependencies**: `mcp` (official MCP Python SDK)

### 4.2 Multi-Agent Orchestration (LangGraph-Inspired)
**Why**: Current agent system is simple dispatch. Modern agentic patterns use graph-based state machines for complex workflows.

**Changes**:
- Rewrite `backend/agents/manager.py` → `backend/agents/orchestrator.py`:
  - Graph-based workflow engine (inspired by LangGraph but lightweight, no dependency)
  - Define agent workflows as state machines: nodes (agent steps) + edges (transitions) + conditions
  - Support patterns: sequential, parallel fan-out/fan-in, conditional branching, loops with exit conditions
  - Shared state object passed between agent nodes
  - Built-in patterns: Plan-and-Execute, ReAct, Research-Synthesize
- Rewrite `backend/agents/base.py`:
  - Agent as a node in the graph
  - Input/output type contracts
  - Memory: short-term (conversation), long-term (persistent storage)
  - Agent-to-agent communication via shared state

### 4.3 New Specialized Agents
**Why**: Only research and code agents exist. Users need more capabilities.

**Changes**:
- New file: `backend/agents/writing_agent.py` — Creative writing, document drafting, editing
- New file: `backend/agents/data_agent.py` — Data analysis, CSV/JSON processing, chart generation
- New file: `backend/agents/system_agent.py` — System tasks, file management, automation
- Modify each agent to follow the new base agent interface with graph-compatible I/O

### 4.4 Agent Memory System
**Why**: Agents currently have no memory between sessions. Long-term memory enables personalization and learning.

**Changes**:
- New file: `backend/agents/memory.py`:
  - Short-term: conversation context (existing, via message packing)
  - Working memory: current task state, intermediate results
  - Long-term: persistent facts, user preferences, learned patterns (stored in SQLite)
  - Episodic: past interaction summaries for similar queries (stored as embeddings in vector store)
- Modify `backend/storage/conversations.py` — Add memory tables

### 4.5 Enhanced Tool System
**Why**: Current tools are basic. Need code execution, file operations, and more.

**Changes**:
- New file: `backend/agents/tools/code_executor.py`:
  - Sandboxed Python/JS execution using subprocess with resource limits
  - Capture stdout, stderr, return values
  - Timeout and memory limits
  - Support for data visualization (matplotlib → base64 image)
- New file: `backend/agents/tools/file_tool.py`:
  - Read/write/list files in a sandboxed workspace directory
  - Support for creating project structures
- Modify `backend/agents/tools/search_service.py`:
  - Add Tavily API support (optional, for users who have keys)
  - Add Exa API support (optional)
  - Better result deduplication and ranking

**New dependencies**: None (uses subprocess for sandboxing)

---

## Phase 5: Modern UI & Multimodal (Priority: High)

### 5.1 Artifacts Panel (Claude-Style)
**Why**: Artifacts let users view, edit, and interact with generated content (code, documents, diagrams) in a dedicated panel instead of inline chat.

**Changes**:
- New component: `frontend/src/components/artifacts/ArtifactPanel.tsx`:
  - Side panel that opens when AI generates structured content
  - Artifact types: code (with syntax highlighting + copy), document (markdown editor), table (data grid), chart (rendered visualization), image, HTML preview
  - Version history: track artifact iterations
  - Edit-in-place: user can modify artifacts and re-submit to AI
- New component: `frontend/src/components/artifacts/CodeArtifact.tsx` — Code editor with Monaco or CodeMirror
- New component: `frontend/src/components/artifacts/DocumentArtifact.tsx` — Rich text/markdown viewer-editor
- Modify `frontend/src/components/chat/ChatInterface.tsx`:
  - Detect artifact-worthy content in responses (code blocks, tables, long documents)
  - Split view: chat on left, artifact on right
  - Artifact references in chat messages
- Modify `frontend/src/lib/stores/chat.ts` — Add artifact state management
- New backend support in `backend/api/chat.py` — Artifact metadata in streaming events

**New frontend dependencies**: `@monaco-editor/react` or `codemirror`

### 5.2 Voice Input/Output
**Why**: Multimodal interaction is a major trend. Voice makes the app more accessible.

**Changes**:
- New file: `backend/voice/stt.py`:
  - Local speech-to-text using Whisper (via `faster-whisper` for speed)
  - Streaming audio input support
  - Language auto-detection
- New file: `backend/voice/tts.py`:
  - Local text-to-speech using Coqui TTS or Piper (lightweight)
  - Multiple voice options
  - Streaming audio output
- New API endpoints: `backend/api/voice.py`:
  - `POST /api/voice/transcribe` — Audio → text
  - `POST /api/voice/synthesize` — Text → audio
  - WebSocket endpoint for real-time voice chat
- New frontend components:
  - `frontend/src/components/voice/VoiceButton.tsx` — Push-to-talk / continuous listening
  - `frontend/src/components/voice/AudioPlayer.tsx` — Streaming audio playback
- Modify `frontend/src/components/chat/MessageInput.tsx` — Add microphone button

**New backend dependencies**: `faster-whisper`, `piper-tts` (or `coqui-tts`)

### 5.3 Enhanced Chat UI
**Why**: Several UI improvements needed for a polished product.

**Changes**:
- Modify `frontend/src/components/chat/MessageBubble.tsx`:
  - Copy-to-clipboard for code blocks
  - Inline artifact expansion
  - Better image display (lightbox)
  - Message actions: copy, regenerate, edit, branch conversation
- Modify `frontend/src/components/chat/ChatInterface.tsx`:
  - Conversation branching (fork from any message)
  - Conversation search
  - Export conversation (Markdown, JSON, PDF)
- Modify `frontend/src/components/layout/Sidebar.tsx`:
  - Conversation folders/tags
  - Pin conversations
  - Search across all conversations
- New component: `frontend/src/components/chat/ModelIndicator.tsx` — Show which model is responding, with routing explanation tooltip

### 5.4 Generative UI Components
**Why**: Different response types deserve different rendering (not everything should be plain markdown).

**Changes**:
- New component: `frontend/src/components/generative/DataTable.tsx` — Render tables from structured data
- New component: `frontend/src/components/generative/Chart.tsx` — Render charts from data (using recharts)
- New component: `frontend/src/components/generative/CodeRunner.tsx` — Interactive code blocks with "Run" button (calls backend code executor)
- New component: `frontend/src/components/generative/ImageGallery.tsx` — Grid view for generated/analyzed images
- Modify `frontend/src/components/chat/MarkdownRenderer.tsx` — Detect and render generative components inline

**New frontend dependencies**: `recharts` (charting), `@monaco-editor/react`

---

## Phase 6: Production Hardening & Community (Priority: Medium)

### 6.1 Testing Suite
**Changes**:
- New directory: `backend/tests/` with pytest
  - `test_router.py` — Router classification, model selection, caching
  - `test_agents.py` — Agent execution, tool calling
  - `test_rag.py` — Ingestion, search, reranking
  - `test_api.py` — All API endpoints
  - `test_mcp.py` — MCP server/client
- New directory: `frontend/__tests__/` with Vitest
  - Component tests for ChatInterface, ArtifactPanel, etc.
  - Store tests for Zustand state
  - API client tests
- CI/CD: `.github/workflows/test.yml`

**New dependencies**: `pytest`, `pytest-asyncio`, `httpx` (test client) | `vitest`, `@testing-library/react`

### 6.2 Monitoring & Observability
**Changes**:
- New file: `backend/monitoring/metrics.py`:
  - Request latency, model usage, routing decisions, error rates
  - Token throughput per model
  - VRAM usage tracking
- Modify `frontend/src/components/layout/SystemMonitor.tsx`:
  - Real-time dashboard: model performance, routing stats, system resources
  - Usage analytics over time

### 6.3 Security & Multi-User
**Changes**:
- New file: `backend/auth/local_auth.py`:
  - Optional local authentication (PIN/password)
  - Session management
  - Per-user conversation isolation
- Modify `backend/main.py` — Optional auth middleware
- Sandboxed file access for agents (restrict to workspace directory)

### 6.4 Plugin System
**Why**: Community extensibility.

**Changes**:
- New file: `backend/plugins/loader.py`:
  - Load plugins from `plugins/` directory
  - Plugin manifest (name, version, tools, agents, UI components)
  - Hot-reload support
- Plugin API: register tools, agents, UI components
- Document plugin development guide

---

## Implementation Order & Dependencies

```
Phase 1 (Foundation)          Phase 2 (Router)           Phase 3 (RAG)
  1.1 Hardware Detection  →     2.1 Embedding Router  →    3.1 Hybrid Search
  1.2 Model Registry      →     2.2 Learned Router         3.2 Smart Chunking
  1.3 Token Counting       →     2.3 Multi-Model            3.3 Better Embeddings
  1.4 First-Run Wizard                                      3.4 Document UI
                                                            3.5 GraphRAG

Phase 4 (Agents/MCP)          Phase 5 (UI)               Phase 6 (Production)
  4.1 MCP Integration     →     5.1 Artifacts Panel        6.1 Testing
  4.2 Multi-Agent Orch         5.2 Voice I/O              6.2 Monitoring
  4.3 New Agents               5.3 Enhanced Chat UI       6.3 Security
  4.4 Agent Memory             5.4 Generative UI          6.4 Plugins
  4.5 Enhanced Tools
```

Phases 1-2 are sequential (router depends on hardware/models).
Phases 3, 4, 5 can be parallelized (independent subsystems).
Phase 6 runs continuously alongside others.

---

## New Dependencies Summary

| Package | Purpose | Phase |
|---------|---------|-------|
| `pynvml` | GPU detection | 1 |
| `tiktoken` | Accurate token counting | 1 |
| `rank_bm25` | BM25 keyword search | 3 |
| `pymupdf` | PDF parsing | 3 |
| `python-docx` | DOCX parsing | 3 |
| `mcp` | MCP protocol SDK | 4 |
| `faster-whisper` | Speech-to-text | 5 |
| `piper-tts` | Text-to-speech | 5 |
| `@monaco-editor/react` | Code editor (frontend) | 5 |
| `recharts` | Charts (frontend) | 5 |
| `pytest` + `pytest-asyncio` | Testing | 6 |
| `vitest` | Frontend testing | 6 |

---

## Key Files Modified (Existing)

| File | Phases | Changes |
|------|--------|---------|
| `backend/config.py` | 1,4 | Hardware, MCP settings |
| `backend/main.py` | 1,6 | Setup wizard, auth middleware |
| `backend/router/router.py` | 1,2 | Embedding router, cascading, orchestration |
| `backend/router/classifier.py` | 2 | Embedding-based classification |
| `backend/router/model_profiles.py` | 1 | Dynamic profiling, hardware-adaptive |
| `backend/agents/base.py` | 4 | Graph-compatible agent interface |
| `backend/agents/manager.py` | 4 | → orchestrator.py rewrite |
| `backend/agents/tools/registry.py` | 4 | MCP tool integration |
| `backend/agents/tools/search_service.py` | 4 | New search providers |
| `backend/rag/vector_store.py` | 3 | Hybrid search, better embeddings |
| `backend/rag/ingestion.py` | 3 | Smart chunking, format support |
| `backend/rag/deep_research.py` | 3 | Graph context integration |
| `backend/api/chat.py` | 2,5 | Multi-model, artifact events |
| `backend/api/rag.py` | 3 | Document management endpoints |
| `backend/storage/feedback.py` | 2 | Detailed routing outcome storage |
| `backend/storage/conversations.py` | 4 | Memory tables |
| `frontend/src/components/chat/ChatInterface.tsx` | 5 | Artifacts, split view |
| `frontend/src/components/chat/MessageInput.tsx` | 5 | Voice button |
| `frontend/src/components/chat/MessageBubble.tsx` | 5 | Actions, copy, artifacts |
| `frontend/src/components/chat/MarkdownRenderer.tsx` | 5 | Generative UI |
| `frontend/src/components/settings/SettingsPanel.tsx` | 1 | Hardware info |
| `frontend/src/components/layout/Sidebar.tsx` | 5 | Folders, search, pins |
| `frontend/src/lib/stores/chat.ts` | 5 | Artifact state |
| `frontend/src/lib/api/chat.ts` | 5 | Artifact events |
| `docker-compose.yml` | 5 | Voice service volumes |

---

## Verification Plan

### Per-Phase Testing

**Phase 1**:
- Run `python -c "from backend.hardware.detector import detect_hardware; print(detect_hardware())"` — should return GPU info
- Start backend, hit `GET /api/models` — should return enriched model profiles with hardware recommendations
- Access frontend setup wizard on first run

**Phase 2**:
- Send queries of different types, verify routing decisions in response metadata
- Check that embedding router classifies faster than LLM router
- Submit feedback, verify learned router updates

**Phase 3**:
- Upload a PDF via Document Manager UI, verify chunks in ChromaDB
- Search for keyword-exact match (BM25 should catch it)
- Search for semantic match (vector should catch it)
- Verify reranked results are more relevant

**Phase 4**:
- Connect an external MCP server, verify tools appear in tool registry
- Run a multi-step research workflow, verify agent orchestration graph executes correctly
- Test code execution sandbox with Python snippet

**Phase 5**:
- Send a message that generates code — artifact panel should open
- Click voice button, speak, verify transcription appears in input
- Verify charts render for data-containing responses

**Phase 6**:
- Run `pytest backend/tests/` — all pass
- Run `npm test` in frontend — all pass
- Check monitoring dashboard shows real-time metrics
