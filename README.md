# BeastAI — The Ultimate Local AI Platform

Run multiple AI models intelligently on your own hardware. Complete privacy, no cloud required.

[![Local First](https://img.shields.io/badge/Local%20First-100%25%20Private-green)](https://github.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-blue)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)

---

## Quick Start (Two Options)

### Option A — Docker (Recommended, one command)

```bash
# Linux / macOS
git clone https://github.com/your-username/beastai.git
cd beastai
./start.sh
```

```powershell
# Windows
git clone https://github.com/your-username/beastai.git
cd beastai
.\start.ps1
```

That's it. Docker builds and starts everything automatically.  
Open **http://localhost:3000** when ready.

> **With NVIDIA GPU:**
> ```bash
> ./start.sh --gpu          # Linux/Mac
> .\start.ps1 -Gpu          # Windows
> ```

> **With ComfyUI (image generation) + SearXNG (self-hosted search):**
> ```bash
> ./start.sh --heavy        # Linux/Mac
> .\start.ps1 -Heavy        # Windows
> ```

---

### Option B — Local Development (No Docker)

```bash
# Linux / macOS
./start.sh --dev
```

```powershell
# Windows
.\start.ps1 -Dev
```

Requirements: **Python 3.12+**, **Node.js 20+**, **Ollama** running locally.

---

## Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | For Option A | With WSL2 on Windows |
| [Ollama](https://ollama.ai/) | Always | LLM runtime |
| Python 3.12+ | Option B only | |
| Node.js 20+ | Option B only | |
| NVIDIA GPU | Optional | Dramatically speeds up models |

---

## Install AI Models

After starting, pull models from Ollama. The router automatically detects them:

```bash
# General chat (pick one based on your VRAM)
ollama pull qwen3:4b    # ~3 GB  — fast, low VRAM
ollama pull qwen3:8b    # ~5 GB  — balanced

# Reasoning (shows thinking process)
ollama pull deepseek-r1:8b   # ~5 GB

# Coding
ollama pull qwen2.5-coder:7b  # ~4 GB

# Vision (image analysis)
ollama pull llava:7b           # ~5 GB

# Embeddings (required for RAG / document search)
ollama pull nomic-embed-text
```

---

## Features

### Intelligent Model Router
- Auto-discovers every model installed in Ollama at startup
- Routes each query to the best model: fast → general → coding → reasoning → vision
- LLM-based routing with regex fallback for reliability
- Learns from your feedback to improve routing over time

### Reasoning Transparency
- Collapsible "Thinking" block on every reasoning model response
- Force reasoning mode on any query with the tool selector
- Real-time streaming of the thinking process

### Research Agent
- Deep multi-step web research pipeline
- Asks clarifying questions before researching
- Supports Brave Search, Perplexity, DuckDuckGo, and SearXNG (configure in Settings)
- Source citations with progress tracking

### Image Generation (ComfyUI)
- Generate images from text prompts directly in chat
- Supports SDXL, FLUX, and any ComfyUI-compatible model
- Negative prompts, width/height/steps controls

### Vision Analysis
- Upload images for AI analysis
- Automatically routes to your best vision model (LLaVA, etc.)

### RAG — Document Knowledge Base
- Drag-and-drop document upload (PDF, TXT, Markdown)
- ChromaDB vector store for semantic search
- Documents become part of every relevant response

### Coding Agent
- Automatic routing to your best coding model
- Code generation, debugging, and explanation

### Conversation Persistence
- Full conversation history stored in SQLite
- Resumes where you left off after restarts

### Settings Panel
- Change API keys, model defaults, and service URLs without restarting
- Toggle search providers and view which ones are active

---

## Architecture

```
Browser (http://localhost:3000)
         │
         │  HTTP + SSE (streaming)
         ▼
   FastAPI Backend (port 8001)
         │
    ┌────┴──────────────────────────────┐
    │                                   │
    ▼                                   ▼
Intelligent Router              Research Agent
    │                                   │
    ▼                                   ▼
Model Registry              Web Search (Brave/Perplexity/DDG)
    │
    ▼
Ollama (port 11434)
    ├── Fast models    (qwen3:4b)
    ├── General models (qwen3:8b)
    ├── Reasoning      (deepseek-r1:8b)
    ├── Coding         (qwen2.5-coder:7b)
    └── Vision         (llava:7b)

ChromaDB  — document vectors (RAG)
SQLite    — conversations, feedback
ComfyUI   — image generation (port 8188, optional)
SearXNG   — self-hosted search (port 8080, optional)
```

---

## Configuration

Copy `.env.example` to `.env` and set values. All settings can also be changed live through the **Settings** panel in the UI.

```env
# Service URLs (set automatically in Docker, only change for custom setups)
OLLAMA_BASE_URL=http://localhost:11434
COMFYUI_BASE_URL=http://localhost:8188
SEARXNG_BASE_URL=http://localhost:8080

# Optional API keys for better web search
BRAVE_API_KEY=           # https://brave.com/search/api/
PERPLEXITY_API_KEY=      # https://www.perplexity.ai/settings/api
```

---

## Useful Commands

```bash
# Docker
./start.sh                  # start (CPU)
./start.sh --gpu            # start with NVIDIA GPU
./start.sh --gpu --heavy    # + ComfyUI + SearXNG
./start.sh --stop           # stop everything
./start.sh --logs           # stream logs

# Windows equivalents
.\start.ps1
.\start.ps1 -Gpu
.\start.ps1 -Gpu -Heavy
.\start.ps1 -Stop
.\start.ps1 -Logs

# Docker Compose directly
docker compose logs -f backend          # backend logs only
docker compose restart backend          # restart one service
docker compose exec ollama ollama pull qwen3:8b   # pull model into Docker Ollama
```

---

## Troubleshooting

**Ollama models not detected**
- Ensure Ollama is running: `ollama list`
- Check backend logs: `./start.sh --logs`
- Restart backend to re-run model discovery

**Frontend can't reach backend**
- Verify backend is healthy: http://localhost:8001/health
- Check `NEXT_PUBLIC_API_BASE` env var
- In Docker, both containers must be on `beastai-network`

**GPU not being used**
- Run with `--gpu` / `-Gpu` flag
- Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- Windows: ensure WSL2 is the Docker backend

**First startup is slow**
- Docker needs to build images on the first run (~2-5 minutes)
- Subsequent startups are fast (cached layers)

**SearXNG not working in Docker**
- Run with `--heavy` flag to enable SearXNG
- Or use Brave/Perplexity API keys instead (Settings panel)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand |
| Backend | FastAPI, Python 3.12, Uvicorn |
| LLM Runtime | Ollama |
| Vector DB | ChromaDB |
| Conversations | SQLite (aiosqlite) |
| Image Gen | ComfyUI |
| Web Search | Brave, Perplexity, DuckDuckGo, SearXNG |
| Infrastructure | Docker Compose |

---

## Roadmap

- [ ] Voice input/output
- [ ] Agent tool execution (run code, file ops)
- [ ] Real-time model discovery (no restart needed)
- [ ] Advanced RAG chunking strategies
- [ ] Performance analytics dashboard
- [ ] Plugin/extension system
- [ ] Computer control agent (OpenClaw-style)

---

## Contributing

PRs welcome. Areas of interest:
- Model profile improvements
- New agent tools
- UI/UX enhancements
- Additional search providers
- Performance optimisations

---

Built with [Ollama](https://ollama.ai/) · [FastAPI](https://fastapi.tiangolo.com/) · [Next.js](https://nextjs.org/) · [ChromaDB](https://www.trychroma.com/) · [ComfyUI](https://github.com/comfyanonymous/ComfyUI) · [SearXNG](https://docs.searxng.org/)
