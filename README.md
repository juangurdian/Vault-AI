<div align="center">

<!-- Animated Header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:1f6feb&height=220&section=header&text=🧠%20Vault%20AI&fontSize=72&fontColor=ffffff&fontAlignY=35&desc=Your%20Private%20AI%20Fortress%20—%20Run%20Multiple%20AI%20Models%20Locally&descSize=18&descAlignY=55&animation=fadeIn" width="100%"/>

<br/>

<!-- Badges Row 1 -->
[![Local First](https://img.shields.io/badge/🔒_Local_First-100%25_Private-00d26a?style=for-the-badge&labelColor=0d1117)](https://github.com/juangurdian/Vault-AI)
[![Smart Router](https://img.shields.io/badge/🧠_Smart_Router-AI_Powered-1f6feb?style=for-the-badge&labelColor=0d1117)](https://github.com/juangurdian/Vault-AI)
[![Docker](https://img.shields.io/badge/🐳_Docker-One_Command-2496ED?style=for-the-badge&labelColor=0d1117)](https://www.docker.com/)

<!-- Badges Row 2 -->
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Powered-white?style=flat-square&logo=ollama&logoColor=black)](https://ollama.ai/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<!-- Badges Row 3 -->
[![Stars](https://img.shields.io/github/stars/juangurdian/Vault-AI?style=social)](https://github.com/juangurdian/Vault-AI/stargazers)
[![Forks](https://img.shields.io/github/forks/juangurdian/Vault-AI?style=social)](https://github.com/juangurdian/Vault-AI/network/members)
[![Issues](https://img.shields.io/github/issues/juangurdian/Vault-AI?style=flat-square&color=yellow)](https://github.com/juangurdian/Vault-AI/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/juangurdian/Vault-AI/pulls)
[![License](https://img.shields.io/github/license/juangurdian/Vault-AI?style=flat-square)](LICENSE)

<br/>

**The open-source, privacy-first AI platform that runs entirely on your hardware.**
**No cloud. No subscriptions. No data leaving your machine. Ever.**

[🚀 Quick Start](#-quick-start) · [🧠 Smart Router](#-the-smart-router--the-brain-behind-vault-ai) · [✨ Features](#-features) · [🏗️ Architecture](#%EF%B8%8F-architecture) · [🤝 Contributing](#-contributing)

---

<br/>

</div>

## 🤔 Why Vault AI?

> *"Why should you trust a corporation with your most intimate thoughts, your business ideas, your private conversations with AI?"*

Every time you use ChatGPT, Claude, or Gemini, your data travels to someone else's servers. Your prompts, your documents, your ideas — all stored on infrastructure you don't control.

**Vault AI changes that.** It's a complete AI platform that runs **entirely on your machine** — with an intelligent routing system that automatically picks the best model for every query. No API keys required. No internet needed. No compromises.

<div align="center">

| | Cloud AI (ChatGPT, etc.) | 🧠 Vault AI |
|---|---|---|
| **Your data** | Sent to third-party servers | ✅ Never leaves your machine |
| **Cost** | $20-200+/month | ✅ Free forever |
| **Internet required** | Always | ✅ Works fully offline |
| **Model choice** | What they give you | ✅ Any model you want |
| **Censorship** | Heavy filtering | ✅ Uncensored, your rules |
| **Speed** | Depends on their servers | ✅ Depends on YOUR hardware |

</div>

---

## 🚀 Quick Start

Get running in **under 2 minutes**. One command. That's it.

### 🐳 Option A — Docker (Recommended)

```bash
# Clone and start
git clone https://github.com/juangurdian/Vault-AI.git
cd Vault-AI
./start.sh
```

```powershell
# Windows
git clone https://github.com/juangurdian/Vault-AI.git
cd Vault-AI
.\start.ps1
```

> **Open [http://localhost:3000](http://localhost:3000)** when ready. Done. 🎉

<details>
<summary>🎮 <b>With NVIDIA GPU acceleration</b></summary>

```bash
./start.sh --gpu          # Linux/Mac
.\start.ps1 -Gpu          # Windows
```
Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html). Dramatically speeds up inference.
</details>

<details>
<summary>🎨 <b>With Image Generation + Self-Hosted Search</b></summary>

```bash
./start.sh --gpu --heavy    # Linux/Mac
.\start.ps1 -Gpu -Heavy     # Windows
```
Adds **ComfyUI** (Stable Diffusion/FLUX) and **SearXNG** (private web search).
</details>

### 💻 Option B — Local Development (No Docker)

```bash
./start.sh --dev            # Linux/Mac
.\start.ps1 -Dev            # Windows
```

Requires: **Python 3.12+** · **Node.js 20+** · **Ollama** running locally

---

## 📦 Install AI Models

After starting, pull models via Ollama. The Smart Router auto-detects them instantly:

```bash
# ⚡ Fast chat (low VRAM)
ollama pull qwen3:4b          # ~3 GB

# 💬 General conversation
ollama pull qwen3:8b          # ~5 GB

# 🧠 Deep reasoning (shows thinking process!)
ollama pull deepseek-r1:8b    # ~5 GB

# 💻 Code specialist
ollama pull qwen2.5-coder:7b  # ~4 GB

# 👁️ Vision (image analysis)
ollama pull llava:7b           # ~5 GB

# 📄 Embeddings (required for document search / RAG)
ollama pull nomic-embed-text
```

> 💡 **Tip:** Pull any Ollama model and the Smart Router will automatically profile it, detect its capabilities, and route queries to it. No configuration needed.

---

<div align="center">

## 🧠 The Smart Router — The Brain Behind Vault AI

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:161b22,100:1f6feb&height=2&section=header" width="60%"/>

</div>

> *This is the cherry on top — the feature that makes Vault AI more than just "another Ollama UI."*

Most local AI tools make you **manually pick** which model to use for every single message. The Smart Router eliminates that entirely. It's an **AI-powered query routing engine** that analyzes every message you send and instantly routes it to the optimal model — all in under 500ms.

### 🔄 How It Works

```
   Your Message
       │
       ▼
┌─────────────────────────────────────────────┐
│            🧠 SMART ROUTER                  │
│                                             │
│  ┌─────────────┐    ┌────────────────────┐  │
│  │  LLM-Based  │───▶│  Model Selection   │  │
│  │  Analysis   │    │                    │  │
│  │  (Primary)  │    │  • Task type       │  │
│  └──────┬──────┘    │  • Complexity      │  │
│         │           │  • Context needs   │  │
│    timeout?         │  • Speed vs depth  │  │
│         │           └────────┬───────────┘  │
│  ┌──────▼──────┐             │              │
│  │   Regex     │─────────────┘              │
│  │  Fallback   │                            │
│  │ (Backup)    │     500ms guarantee        │
│  └─────────────┘                            │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
              🎯 Best Model Selected
                       │
       ┌───────────────┼───────────────┐
       │               │               │
   ⚡ Fast          🧠 Reasoning    💻 Coding
   qwen3:4b      deepseek-r1:8b   qwen2.5-coder
   "hi!"         "explain quantum  "fix this
                  entanglement"     Python bug"
```

### 🎯 Seven Task Types, Automatically Detected

| Type | Icon | Routed To | Example Query |
|------|------|-----------|---------------|
| **Simple Chat** | ⚡ | Fastest model (3-4B) | *"What's the capital of France?"* |
| **General** | 💬 | Balanced model (8B) | *"Tell me about renewable energy"* |
| **Reasoning** | 🧠 | Reasoning model (8B+) | *"Explain why P ≠ NP matters"* |
| **Coding** | 💻 | Code specialist (7B+) | *"Write a REST API in Python"* |
| **Vision** | 👁️ | Vision model (LLaVA) | *"What's in this image?"* |
| **Creative** | 🎨 | Creative/General model | *"Write a poem about the ocean"* |
| **Research** | 🔍 | General + Web Search | *"Latest news about SpaceX"* |

### 🏎️ Why It's Fast

- **Dual-mode routing**: Uses a fast LLM for analysis, with regex pattern matching as instant fallback
- **500ms timeout**: If the LLM router takes too long, regex kicks in immediately
- **Response caching**: Same query patterns reuse previous routing decisions (100-item cache)
- **Auto-discovery**: New models are profiled automatically — context window, VRAM, speed, all estimated

### 🧩 What Makes It Special

- **Context overflow protection** — If your conversation is too long for the selected model, it automatically upgrades to a model with a larger context window
- **LLM-powered summarization** — When conversation history must be truncated, it uses a fast model to summarize dropped messages instead of just cutting them off
- **Transparent decisions** — Every routing decision is shown in the UI: which model was selected, why, confidence level, and processing time
- **Custom profiles** — Override any model's profile with JSON configuration for full control
- **Zero configuration** — Pull any model from Ollama and it just works. The router figures out the rest

---

## ✨ Features

<div align="center">

### Core Capabilities

</div>

<table>
<tr>
<td width="50%" valign="top">

### 🧠 Intelligent Model Routing
Auto-discovers all installed Ollama models and routes each query to the best one. LLM-based analysis with regex fallback for reliability. Transparent routing info shown in the UI.

### 💭 Reasoning Transparency
Collapsible `<think>` blocks show the model's reasoning process in real-time. Force reasoning mode on any query. Watch the AI think step-by-step as it streams.

### 🔍 Deep Research Agent
Multi-step web research pipeline that asks clarifying questions before diving in. Combines results from Brave, Perplexity, DuckDuckGo, and self-hosted SearXNG. Full source citation tracking.

### 💻 Code Agent
Automatically routes to your best coding model. Code generation, debugging, review, and explanation with syntax-highlighted output. Supports all major languages.

</td>
<td width="50%" valign="top">

### 🎨 Image Generation
Generate images from text prompts via ComfyUI integration. Supports SDXL, FLUX, and any ComfyUI-compatible model. Negative prompts, dimensions, and step controls.

### 👁️ Vision Analysis
Upload images for AI analysis. Automatically routes to your best vision model (LLaVA, BakLLaVA, etc.). Ask questions about any image.

### 📄 RAG — Document Knowledge Base
Drag-and-drop document upload (PDF, TXT, Markdown). ChromaDB vector store with local Ollama embeddings. Documents seamlessly integrate into relevant responses.

### 🔧 Tool System
Extensible agent tool framework with auto-discovery. Native Ollama tool calling with tag-based fallback. Planning injections for complex multi-step queries.

</td>
</tr>
</table>

<details>
<summary><b>🔽 Even More Features</b></summary>

<br/>

- **🌊 Real-time Streaming** — Token-by-token response display via Server-Sent Events (SSE)
- **💾 Conversation Persistence** — Full chat history in SQLite, survives restarts
- **⚙️ Live Settings** — Change API keys, model defaults, and service URLs without restarting
- **🔍 Multi-Provider Search** — Brave, Perplexity, DuckDuckGo, SearXNG — configure priority order
- **📊 Routing Analytics** — View cache stats, model availability, routing method distribution
- **🎛️ Tool Selector** — Switch between chat, reasoning, code, research, and image modes
- **📱 Responsive Design** — Works on desktop and mobile
- **🔌 Self-Hosted Everything** — SearXNG replaces cloud search, Ollama replaces cloud LLMs

</details>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    🖥️  Browser (localhost:3000)                   │
│                                                                  │
│   Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zustand │
└──────────────────────────┬───────────────────────────────────────┘
                           │  HTTP + SSE (real-time streaming)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ⚡ FastAPI Backend (port 8001)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ 🧠 Smart     │  │ 🔍 Research  │  │ 🛠️  Agent Tools        │  │
│  │    Router    │  │    Agent     │  │  • Web Search          │  │
│  │              │  │              │  │  • Code Execution      │  │
│  │  Classifier  │  │  Clarify →   │  │  • Vision Analysis     │  │
│  │  Profiler    │  │  Search →    │  │  • RAG Retrieval       │  │
│  │  Cache       │  │  Synthesize  │  │  • Image Generation    │  │
│  └──────┬───────┘  └──────────────┘  └────────────────────────┘  │
│         │                                                        │
│  ┌──────▼───────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Model        │  │ 📄 ChromaDB  │  │ 💾 SQLite              │  │
│  │ Registry     │  │ Vector Store │  │ Conversations          │  │
│  │ (Auto-       │  │ (RAG)        │  │ Feedback               │  │
│  │  Discovery)  │  │              │  │ Settings               │  │
│  └──────┬───────┘  └──────────────┘  └────────────────────────┘  │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    🦙 Ollama (port 11434)                        │
│                                                                  │
│   ⚡ qwen3:4b     💬 qwen3:8b       🧠 deepseek-r1:8b          │
│   💻 qwen2.5-coder:7b   👁️ llava:7b   📄 nomic-embed-text      │
│                                                                  │
│   + Any model you pull — auto-detected & profiled instantly      │
└──────────────────────────────────────────────────────────────────┘

┌─────────────────────────────┐  ┌─────────────────────────────────┐
│  🎨 ComfyUI (port 8188)    │  │  🔍 SearXNG (port 8080)         │
│  Image Generation           │  │  Self-Hosted Web Search          │
│  SDXL · FLUX · Any model    │  │  100+ search engines · Private   │
│  (Optional — --heavy flag)  │  │  (Optional — --heavy flag)       │
└─────────────────────────────┘  └─────────────────────────────────┘
```

---

## 🛠️ Configuration

Copy `.env.example` to `.env` and customize. All settings can also be changed live through the **Settings** panel in the UI — no restart needed.

```env
# 🦙 Service URLs (auto-configured in Docker)
OLLAMA_BASE_URL=http://localhost:11434
COMFYUI_BASE_URL=http://localhost:8188
SEARXNG_BASE_URL=http://localhost:8080

# 🔑 Optional API keys for enhanced web search
BRAVE_API_KEY=           # https://brave.com/search/api/
PERPLEXITY_API_KEY=      # https://www.perplexity.ai/settings/api
```

> 💡 **Zero API keys needed** to get started. DuckDuckGo search works out of the box with no key. Add Brave or Perplexity keys for higher quality results, or use `--heavy` mode for fully self-hosted SearXNG search.

---

## 📋 Prerequisites

| Tool | Required? | Notes |
|------|:---------:|-------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | For Docker setup | With WSL2 on Windows |
| [Ollama](https://ollama.ai/) | ✅ Always | The LLM runtime — pull any model |
| Python 3.12+ | Dev mode only | For running backend natively |
| Node.js 20+ | Dev mode only | For running frontend natively |
| NVIDIA GPU | Optional | Dramatically speeds up inference |

---

## ⌨️ Useful Commands

```bash
# 🐳 Docker commands
./start.sh                          # Start (CPU mode)
./start.sh --gpu                    # Start with NVIDIA GPU
./start.sh --gpu --heavy            # + ComfyUI + SearXNG
./start.sh --stop                   # Stop all services
./start.sh --logs                   # Stream all logs

# 🪟 Windows equivalents
.\start.ps1                         # Start (CPU mode)
.\start.ps1 -Gpu                    # Start with NVIDIA GPU
.\start.ps1 -Gpu -Heavy             # + ComfyUI + SearXNG
.\start.ps1 -Stop                   # Stop all services
.\start.ps1 -Logs                   # Stream all logs

# 🔧 Docker Compose direct
docker compose logs -f backend                       # Backend logs only
docker compose restart backend                       # Restart one service
docker compose exec ollama ollama pull qwen3:8b      # Pull model into Docker
```

---

## 🧰 Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Zustand · Framer Motion | Beautiful, responsive chat UI with real-time streaming |
| **Backend** | FastAPI · Python 3.12 · Uvicorn · Pydantic | High-performance async API with SSE streaming |
| **LLM Runtime** | Ollama | Run any open-source model locally |
| **Vector DB** | ChromaDB | Semantic search for RAG document retrieval |
| **Database** | SQLite (aiosqlite) | Conversation persistence and feedback |
| **Image Gen** | ComfyUI | Stable Diffusion, FLUX, any diffusion model |
| **Web Search** | Brave · Perplexity · DuckDuckGo · SearXNG | Multi-provider search with privacy options |
| **Infra** | Docker Compose | One-command deployment with health checks |

</div>

---

## ❓ Troubleshooting

<details>
<summary><b>🦙 Ollama models not detected</b></summary>

- Ensure Ollama is running: `ollama list`
- Check backend logs: `./start.sh --logs`
- Restart backend to re-run model discovery
- In Docker, Ollama must be healthy before backend starts (automatic)
</details>

<details>
<summary><b>🌐 Frontend can't reach backend</b></summary>

- Verify backend health: [http://localhost:8001/health](http://localhost:8001/health)
- Check `NEXT_PUBLIC_API_BASE` environment variable
- In Docker, both containers must be on `beastai-network` (automatic)
</details>

<details>
<summary><b>🎮 GPU not being used</b></summary>

- Run with `--gpu` / `-Gpu` flag
- Install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- Windows: ensure WSL2 is the Docker backend
- Verify: `docker compose exec ollama nvidia-smi`
</details>

<details>
<summary><b>🐢 First startup is slow</b></summary>

- Docker needs to build images on first run (~2-5 min)
- Subsequent startups use cached layers and are fast
- Model downloads are separate and depend on your connection
</details>

<details>
<summary><b>🔍 SearXNG not working</b></summary>

- Must use `--heavy` flag to enable SearXNG
- Or use Brave/Perplexity API keys instead (Settings panel)
- DuckDuckGo works without any setup as the default
</details>

---

## 🗺️ Roadmap

We're building Vault AI in the open. Here's what's coming:

- [ ] 🎤 **Voice input/output** — Talk to your AI
- [ ] ⚙️ **Agent tool execution** — Run code, file operations, shell commands
- [ ] 🔄 **Hot model discovery** — Detect new models without restart
- [ ] 📊 **Performance analytics dashboard** — Track model usage, speed, quality
- [ ] 🧩 **Plugin/extension system** — Community-built tools and integrations
- [ ] 🖥️ **Computer control agent** — Let AI interact with your desktop
- [ ] 📚 **Advanced RAG strategies** — Better chunking, hybrid search, reranking
- [ ] 🌍 **Multi-language UI** — Interface localization

> Have an idea? [Open an issue](https://github.com/juangurdian/Vault-AI/issues) — we'd love to hear it.

---

## 🤝 Contributing

<div align="center">

**Vault AI is built by the community, for the community.**

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)](https://github.com/juangurdian/Vault-AI/pulls)

</div>

We welcome contributions of all kinds! Whether you're fixing a bug, adding a feature, or improving docs — every PR matters.

### 🎯 Areas We'd Love Help With

| Area | Description | Difficulty |
|------|-------------|:----------:|
| 🧠 **Model Profiles** | Improve auto-detection heuristics, add known model defaults | 🟢 Easy |
| 🛠️ **Agent Tools** | Build new tools (calculator, file ops, web scraper, etc.) | 🟡 Medium |
| 🎨 **UI/UX** | Animations, themes, accessibility, mobile improvements | 🟡 Medium |
| 🔍 **Search Providers** | Add Google, Bing, or other search provider integrations | 🟡 Medium |
| ⚡ **Performance** | Optimize routing, caching, streaming, memory usage | 🔴 Advanced |
| 📄 **RAG Pipeline** | Better chunking, hybrid search, reranking strategies | 🔴 Advanced |
| 🧪 **Testing** | Unit tests, integration tests, E2E tests | 🟡 Medium |

### 🚀 Getting Started Contributing

```bash
# 1. Fork the repo and clone
git clone https://github.com/YOUR_USERNAME/Vault-AI.git
cd Vault-AI

# 2. Start in dev mode
./start.sh --dev

# 3. Make your changes, test them

# 4. Submit a PR!
```

---

## 📜 License

This project is open source. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

### ⭐ If Vault AI helps you, consider giving it a star!

It helps others discover the project and motivates continued development.

[![Star History Chart](https://api.star-history.com/svg?repos=juangurdian/Vault-AI&type=Date)](https://star-history.com/#juangurdian/Vault-AI&Date)

<br/>

**Built with ❤️ using**

[Ollama](https://ollama.ai/) · [FastAPI](https://fastapi.tiangolo.com/) · [Next.js](https://nextjs.org/) · [ChromaDB](https://www.trychroma.com/) · [ComfyUI](https://github.com/comfyanonymous/ComfyUI) · [SearXNG](https://docs.searxng.org/)

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:1f6feb&height=120&section=footer" width="100%"/>

</div>
