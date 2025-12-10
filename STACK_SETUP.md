# Local AI Beast - Unified Stack (Docker Compose)

This brings up Ollama, backend, frontend, and optional heavy services (ComfyUI, SearXNG) with one command.

## Prerequisites
- Docker Desktop (with WSL2 on Windows)
- Ports free: 11434 (ollama), 8001 (backend), 3000 (frontend), 8188 (comfyui), 8080 (searxng)

## Services
- `ollama` (always on): LLM inference
- `backend` (always on): FastAPI + router
- `frontend` (ui profile): Next.js app
- `comfyui` (heavy profile): Image generation
- `searxng` (heavy profile): Web search

## Quick start (default: ollama + backend, frontend)
```powershell
cd C:\Users\jcgus\Documents\beastAI
docker compose -f docker\docker-compose.yml --profile ui up -d
```

## Enable heavy services (ComfyUI, SearXNG)
```powershell
docker compose -f docker\docker-compose.yml --profile ui --profile heavy up -d
```

## Using the helper script
```powershell
cd C:\Users\jcgus\Documents\beastAI
.\start_stack.ps1              # default (ollama + backend + frontend)
.\start_stack.ps1 -Heavy       # include ComfyUI + SearXNG
```

## Environment / Ports
Defaults are baked into the compose file:
- BACKEND_PORT=8001
- FRONTEND_PORT=3000
- OLLAMA_PORT=11434
- COMFYUI_PORT=8188
- SEARXNG_PORT=8080

Override by setting env vars before running compose, e.g.:
```powershell
$env:BACKEND_PORT=9001
docker compose -f docker\docker-compose.yml up -d
```

## Volumes
- `ollama_models`: persists downloaded models
- `comfyui_models`: persists ComfyUI checkpoints

## Building images
Compose builds backend and frontend from local sources:
```powershell
docker compose -f docker\docker-compose.yml build
```

## Logs & status
```powershell
docker compose -f docker\docker-compose.yml ps
docker compose -f docker\docker-compose.yml logs -f backend
```

## Stop / clean
```powershell
docker compose -f docker\docker-compose.yml down
```

## Notes
- ComfyUI requires models (e.g., `sd_xl_base_1.0.safetensors`) in `comfyui_models` volume (`/root/ComfyUI/models/checkpoints` inside container).
- Frontend uses `NEXT_PUBLIC_API_BASE=http://backend:8001/api` inside the compose network.
- For local dev with HMR, you can skip frontend in compose and run `npm run dev` locally.

