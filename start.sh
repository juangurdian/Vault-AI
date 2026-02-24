#!/usr/bin/env bash
# BeastAI — one-command launcher (Linux / macOS)
#
# Usage:
#   ./start.sh              # Docker, CPU mode
#   ./start.sh --gpu        # Docker + NVIDIA GPU
#   ./start.sh --heavy      # Docker + ComfyUI + SearXNG
#   ./start.sh --gpu --heavy
#   ./start.sh --dev        # Local dev (no Docker)
#   ./start.sh --stop       # Stop Docker stack
#   ./start.sh --logs       # Stream Docker logs

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m' DC='\033[0;34m' GREEN='\033[0;32m'
YELLOW='\033[1;33m' RED='\033[0;31m' GRAY='\033[0;37m' NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "  ${RED}[ERR]${NC}  $*"; }
info() { echo -e "  ${GRAY}[...]${NC}  $*"; }

echo ""
echo -e "${CYAN}  ██████╗ ███████╗ █████╗ ███████╗████████╗ █████╗ ██╗${NC}"
echo -e "${CYAN}  ██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║${NC}"
echo -e "${CYAN}  ██████╔╝█████╗  ███████║███████╗   ██║   ███████║██║${NC}"
echo -e "${CYAN}  ██╔══██╗██╔══╝  ██╔══██║╚════██║   ██║   ██╔══██║██║${NC}"
echo -e "${CYAN}  ██████╔╝███████╗██║  ██║███████║   ██║   ██║  ██║██║${NC}"
echo -e "${CYAN}  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝${NC}"
echo ""
echo -e "${DC}         The Ultimate Local AI Platform${NC}"
echo ""

# ── parse args ───────────────────────────────────────────────────────────────
DEV=false GPU=false HEAVY=false STOP=false LOGS=false
for arg in "$@"; do
  case $arg in
    --dev)   DEV=true   ;;
    --gpu)   GPU=true   ;;
    --heavy) HEAVY=true ;;
    --stop)  STOP=true  ;;
    --logs)  LOGS=true  ;;
  esac
done

# ── STOP ─────────────────────────────────────────────────────────────────────
if $STOP; then
  info "Stopping BeastAI Docker stack..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" down
  ok "Stack stopped."
  exit 0
fi

# ── LOGS ─────────────────────────────────────────────────────────────────────
if $LOGS; then
  docker compose -f "$REPO_ROOT/docker-compose.yml" logs -f
  exit 0
fi

# ── DEV mode ─────────────────────────────────────────────────────────────────
if $DEV; then
  echo -e "  ${CYAN}─── Local Development Mode ───${NC}"
  info "Requirements: Python 3.12+, Node.js 20+, Ollama"
  echo ""

  # Check Ollama
  if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    ok "Ollama is running"
  else
    warn "Ollama not found at localhost:11434"
    info "Start it with:  ollama serve"
    echo ""
  fi

  # Backend venv
  BACKEND_DIR="$REPO_ROOT/backend"
  if [ ! -d "$BACKEND_DIR/venv" ]; then
    info "Creating Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
    # shellcheck disable=SC1090
    source "$BACKEND_DIR/venv/bin/activate"
    pip install -r "$BACKEND_DIR/requirements.txt" -q
    ok "Python environment ready"
  fi

  # backend .env
  if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$REPO_ROOT/.env.example" ]; then
    cp "$REPO_ROOT/.env.example" "$BACKEND_DIR/.env"
    ok "Created backend/.env from .env.example"
  fi

  # Start backend in background
  info "Starting backend on http://localhost:8001 ..."
  (cd "$REPO_ROOT" && source "$BACKEND_DIR/venv/bin/activate" && \
    uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload) &
  BACKEND_PID=$!

  sleep 3

  # Frontend deps
  FRONTEND_DIR="$REPO_ROOT/frontend"
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install --silent)
    ok "Frontend dependencies installed"
  fi

  # frontend .env.local
  if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
    echo "NEXT_PUBLIC_API_BASE=http://localhost:8001/api" > "$FRONTEND_DIR/.env.local"
    ok "Created frontend/.env.local"
  fi

  info "Starting frontend on http://localhost:3000 ..."
  (cd "$FRONTEND_DIR" && npm run dev) &
  FRONTEND_PID=$!

  echo ""
  ok "BeastAI Dev Stack is running!"
  echo ""
  echo -e "  ${CYAN}Frontend:${NC}  http://localhost:3000"
  echo -e "  ${CYAN}Backend:${NC}   http://localhost:8001"
  echo -e "  ${CYAN}API Docs:${NC}  http://localhost:8001/docs"
  echo ""
  echo -e "  ${GRAY}Press Ctrl+C to stop both servers.${NC}"
  echo ""

  # Wait and clean up on Ctrl+C
  trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
  wait
  exit 0
fi

# ── DOCKER mode ───────────────────────────────────────────────────────────────
echo -e "  ${CYAN}─── Docker Mode ───${NC}"

if ! docker info > /dev/null 2>&1; then
  err "Docker is not running."
  info "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi
ok "Docker is running"

# Compose files
COMPOSE_FILES="-f $REPO_ROOT/docker-compose.yml"
if $GPU; then
  COMPOSE_FILES="$COMPOSE_FILES -f $REPO_ROOT/docker-compose.gpu.yml"
  ok "GPU acceleration enabled"
fi

UP_ARGS="up -d --build"
if $HEAVY; then
  UP_ARGS="$UP_ARGS --profile heavy"
  ok "Heavy services (ComfyUI + SearXNG) enabled"
fi

# Create .env from example if missing
if [ ! -f "$REPO_ROOT/.env" ] && [ -f "$REPO_ROOT/.env.example" ]; then
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
  ok "Created .env from .env.example"
fi

info "Building and starting containers..."
info "(First run takes 2-5 minutes to build images)"
echo ""

# shellcheck disable=SC2086
docker compose $COMPOSE_FILES $UP_ARGS

echo ""
info "Waiting for services to become healthy..."
sleep 5

check_service() {
  local name=$1 url=$2
  for i in $(seq 1 20); do
    if curl -sf "$url" > /dev/null 2>&1; then
      ok "$name"
      return
    fi
    sleep 3
  done
  warn "$name — still starting (check: docker compose logs $name)"
}

check_service "Ollama"      "http://localhost:11434/api/tags"
check_service "Backend API" "http://localhost:8001/health"
check_service "Frontend UI" "http://localhost:3000"
if $HEAVY; then
  check_service "SearXNG" "http://localhost:8080"
  check_service "ComfyUI" "http://localhost:8188/system_stats"
fi

echo ""
ok "BeastAI is ready!"
echo ""
echo -e "  ${CYAN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${CYAN}Backend:${NC}    http://localhost:8001"
echo -e "  ${CYAN}API Docs:${NC}   http://localhost:8001/docs"
echo -e "  ${CYAN}Ollama:${NC}     http://localhost:11434"
if $HEAVY; then
  echo -e "  ${CYAN}SearXNG:${NC}    http://localhost:8080"
  echo -e "  ${CYAN}ComfyUI:${NC}    http://localhost:8188"
fi
echo ""
echo -e "  ${GRAY}Next steps:${NC}"
echo -e "  ${GRAY}  Pull models:  ollama pull qwen3:4b${NC}"
echo -e "  ${GRAY}  Pull embed:   ollama pull nomic-embed-text${NC}"
echo -e "  ${GRAY}  Stop stack:   ./start.sh --stop${NC}"
echo -e "  ${GRAY}  View logs:    ./start.sh --logs${NC}"
echo ""
