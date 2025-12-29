# 🐳 Local AI Beast Docker Stack Setup Guide

This guide explains how to set up and run the entire Local AI Beast platform using Docker Compose. This provides a unified, one-command solution for managing all services.

---

## 🚀 Quick Start

1. **Ensure Docker Desktop is Running:**
   - Make sure Docker Desktop is installed and running on your system.
   - For GPU support, ensure WSL2 backend is enabled (Windows) and NVIDIA Container Toolkit is configured.

2. **Navigate to Project Root:**
   ```powershell
   cd C:\Users\jcgus\Documents\beastAI
   ```

3. **Start the Stack:**
   - **Core Services (Ollama, Backend, Frontend):**
     ```powershell
     .\start_stack.ps1
     ```
     This will start the essential services.
   
   - **Heavy Services (Includes ComfyUI & SearXNG):**
     ```powershell
     .\start_stack.ps1 -Heavy
     ```
     Use this if you plan to use image generation (ComfyUI) or web search (SearXNG).

4. **Access the Frontend:**
   - Open your browser to: [http://localhost:3000](http://localhost:3000)

---

## ⚙️ Services Included

The `docker-compose.yml` defines the following services:

- **`ollama`**:
  - **Purpose:** Hosts local LLMs and embedding models.
  - **Port:** `11434`
  - **GPU:** Enabled by default.
  - **Volume:** `ollama_models` (persists downloaded models).

- **`backend`**:
  - **Purpose:** The FastAPI application with intelligent router, agents, RAG, and image generation API.
  - **Port:** `8001`
  - **Dependencies:** `ollama`.
  - **Environment:** Configured to communicate with `ollama` and `comfyui` containers.

- **`frontend`**:
  - **Purpose:** The Next.js chat interface.
  - **Port:** `3000`
  - **Dependencies:** `backend`.
  - **Environment:** Configured to communicate with the `backend` container.

- **`comfyui` (Profile: `heavy`)**:
  - **Purpose:** Image generation server (e.g., Stable Diffusion XL).
  - **Port:** `8188`
  - **GPU:** Enabled by default.
  - **Volume:** `comfyui_models` (for checkpoint models).
  - **Note:** Requires downloading models like `sd_xl_base_1.0.safetensors` into the `comfyui_models` volume. See [COMFYUI_SETUP.md](COMFYUI_SETUP.md) for details.

- **`searxng` (Profile: `heavy`)**:
  - **Purpose:** Privacy-respecting meta-search engine for web research.
  - **Port:** `8080`
  - **Note:** Can be configured via `docker/searxng/settings.yml`.

---

## 💾 Volumes

- **`ollama_models`**: Persists your downloaded Ollama models.
- **`comfyui_models`**: Persists your downloaded ComfyUI checkpoint models.

These volumes ensure that your models are not re-downloaded when containers are rebuilt or restarted.

---

## 🛑 Stopping the Stack

To stop all running Docker Compose services:

```powershell
docker compose -f docker\docker-compose.yml down
```

To stop and remove volumes (⚠️ **WARNING:** This will delete your models):

```powershell
docker compose -f docker\docker-compose.yml down -v
```

---

## 📋 Useful Commands

### View Logs
```powershell
# All services
docker compose -f docker\docker-compose.yml logs -f

# Specific service
docker compose -f docker\docker-compose.yml logs -f backend
```

### View Status
```powershell
docker compose -f docker\docker-compose.yml ps
```

### Restart a Service
```powershell
docker compose -f docker\docker-compose.yml restart backend
```

### Rebuild After Code Changes
```powershell
docker compose -f docker\docker-compose.yml up -d --build
```

---

## 💡 Tips for Development

- **Frontend Hot Reloading:** For active frontend development, it's often easier to run the frontend locally (`cd frontend; npm run dev`) instead of via Docker Compose. Ensure `NEXT_PUBLIC_API_BASE` in your local `.env` points to `http://localhost:8001/api`.
- **Backend Hot Reloading:** The `backend` service in Docker Compose is configured with `--reload`, so changes to Python files will trigger a restart.
- **Ollama Models:** Download Ollama models directly using `ollama pull <model_name>` on your host machine. The `ollama_models` volume will ensure they are accessible to the container.
- **ComfyUI Models:** Download ComfyUI models (e.g., `sd_xl_base_1.0.safetensors`) into a local directory that you then map to the `comfyui_models` volume. The `COMFYUI_SETUP.md` provides detailed instructions.

---

## 🔧 Troubleshooting

### Services Not Starting
- Check Docker Desktop is running: `docker ps`
- Check logs: `docker compose -f docker\docker-compose.yml logs`
- Ensure ports 11434, 8001, 3000 (and optionally 8188, 8080) are not in use.

### GPU Not Available
- Ensure NVIDIA drivers are installed and up to date.
- Verify Docker Desktop has GPU support enabled (Settings → Resources → WSL Integration).
- Check NVIDIA Container Toolkit is installed.

### Models Not Found
- For Ollama: Models must be pulled using `ollama pull <model_name>` on the host or inside the container.
- For ComfyUI: Models must be placed in the `comfyui_models` volume or mounted directory.

---

*This document is part of the Local AI Beast project. For overall project setup, refer to `README.md`.*




