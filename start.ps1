<#
.SYNOPSIS
    BeastAI — one-command launcher.

.DESCRIPTION
    Starts the full BeastAI stack. Supports Docker (recommended) or local dev mode.

.PARAMETER Dev
    Run in local development mode (no Docker required).
    Starts backend and frontend in separate processes.

.PARAMETER Heavy
    (Docker mode only) Include optional services: ComfyUI + SearXNG.

.PARAMETER Gpu
    (Docker mode only) Enable NVIDIA GPU acceleration.

.PARAMETER Stop
    Stop all running Docker containers for BeastAI.

.PARAMETER Logs
    Stream logs from all running Docker containers.

.EXAMPLE
    # Easiest — Docker, CPU mode
    .\start.ps1

    # Docker + GPU
    .\start.ps1 -Gpu

    # Docker + GPU + ComfyUI/SearXNG
    .\start.ps1 -Gpu -Heavy

    # Local dev (no Docker)
    .\start.ps1 -Dev

    # Stop everything
    .\start.ps1 -Stop
#>

[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$Heavy,
    [switch]$Gpu,
    [switch]$Stop,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot

function Write-Header($msg) {
    Write-Host ""
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "  $('─' * $msg.Length)" -ForegroundColor DarkCyan
}

function Write-Ok($msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERR]  $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "  [...]  $msg" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "  ██████╗ ███████╗ █████╗ ███████╗████████╗ █████╗ ██╗" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║" -ForegroundColor Cyan
Write-Host "  ██████╔╝█████╗  ███████║███████╗   ██║   ███████║██║" -ForegroundColor Cyan
Write-Host "  ██╔══██╗██╔══╝  ██╔══██║╚════██║   ██║   ██╔══██║██║" -ForegroundColor Cyan
Write-Host "  ██████╔╝███████╗██║  ██║███████║   ██║   ██║  ██║██║" -ForegroundColor Cyan
Write-Host "  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "         The Ultimate Local AI Platform" -ForegroundColor DarkCyan
Write-Host ""

# ── STOP mode ──────────────────────────────────────────────────────────────
if ($Stop) {
    Write-Header "Stopping BeastAI Docker stack"
    docker compose -f "$repoRoot\docker-compose.yml" down
    Write-Ok "Stack stopped."
    exit 0
}

# ── LOGS mode ──────────────────────────────────────────────────────────────
if ($Logs) {
    docker compose -f "$repoRoot\docker-compose.yml" logs -f
    exit 0
}

# ── DEV mode ───────────────────────────────────────────────────────────────
if ($Dev) {
    Write-Header "Local Development Mode"
    Write-Info "This mode runs the backend and frontend without Docker."
    Write-Info "Requirements: Python 3.12+, Node.js 20+, Ollama"
    Write-Host ""

    # Check Ollama
    try {
        Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop | Out-Null
        Write-Ok "Ollama is running"
    } catch {
        Write-Warn "Ollama not found at localhost:11434"
        Write-Info "Start Ollama: ollama serve"
        Write-Info "Then re-run this script."
        Write-Host ""
    }

    # Create .env from .env.example if missing
    $envPath = "$repoRoot\backend\.env"
    if (-not (Test-Path $envPath)) {
        $examplePath = "$repoRoot\.env.example"
        if (Test-Path $examplePath) {
            Copy-Item $examplePath $envPath
            Write-Ok "Created backend/.env from .env.example"
        }
    }

    # Backend
    $backendDir = Join-Path $repoRoot "backend"
    $venvActivate = Join-Path $backendDir "venv\Scripts\Activate.ps1"

    if (-not (Test-Path $venvActivate)) {
        Write-Info "Creating Python virtual environment..."
        Set-Location $repoRoot
        python -m venv "$backendDir\venv"
        & $venvActivate
        pip install -r "$backendDir\requirements.txt" --quiet
        Write-Ok "Python environment ready"
    }

    Write-Info "Starting backend on http://localhost:8001 ..."
    $backendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "Set-Location '$repoRoot'; & '$venvActivate'; uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload" `
        -PassThru -WindowStyle Normal

    Start-Sleep -Seconds 3

    # Frontend
    $frontendDir = Join-Path $repoRoot "frontend"
    if (-not (Test-Path "$frontendDir\node_modules")) {
        Write-Info "Installing frontend dependencies (this takes a minute)..."
        Set-Location $frontendDir
        npm install --silent
        Write-Ok "Frontend dependencies installed"
    }

    # Create frontend .env.local if missing
    $frontendEnv = Join-Path $frontendDir ".env.local"
    if (-not (Test-Path $frontendEnv)) {
        "NEXT_PUBLIC_API_BASE=http://localhost:8001/api" | Out-File $frontendEnv -Encoding utf8
        Write-Ok "Created frontend/.env.local"
    }

    Write-Info "Starting frontend on http://localhost:3000 ..."
    $frontendProc = Start-Process powershell -ArgumentList "-NoExit", "-Command",
        "Set-Location '$frontendDir'; npm run dev" `
        -PassThru -WindowStyle Normal

    Write-Host ""
    Write-Ok "BeastAI Dev Stack is running!"
    Write-Host ""
    Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  Backend:   http://localhost:8001" -ForegroundColor Cyan
    Write-Host "  API Docs:  http://localhost:8001/docs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Close the two terminal windows to stop." -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# ── DOCKER mode (default) ──────────────────────────────────────────────────
Write-Header "Docker Mode"

# Check Docker
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
    Write-Ok "Docker is running"
} catch {
    Write-Err "Docker Desktop is not running."
    Write-Info "Download Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
}

# Prepare compose files
$composeFiles = @("-f", "$repoRoot\docker-compose.yml")
if ($Gpu) {
    $composeFiles += @("-f", "$repoRoot\docker-compose.gpu.yml")
    Write-Ok "GPU acceleration enabled"
}

$upArgs = @("up", "-d", "--build")
if ($Heavy) {
    $upArgs += @("--profile", "heavy")
    Write-Ok "Heavy services (ComfyUI + SearXNG) enabled"
}

# Copy .env.example if no .env exists
$rootEnv = Join-Path $repoRoot ".env"
if (-not (Test-Path $rootEnv)) {
    $examplePath = Join-Path $repoRoot ".env.example"
    if (Test-Path $examplePath) {
        Copy-Item $examplePath $rootEnv
        Write-Ok "Created .env from .env.example"
    }
}

Write-Info "Building and starting containers..."
Write-Info "(First run takes 2-5 minutes to build images)"
Write-Host ""

docker compose @composeFiles @upArgs
if ($LASTEXITCODE -ne 0) {
    Write-Err "Docker Compose failed. Check the output above."
    exit 1
}

# Wait and health-check
Write-Host ""
Write-Info "Waiting for services to become healthy..."
Start-Sleep -Seconds 5

$services = @(
    @{ Name = "Ollama";      URL = "http://localhost:11434/api/tags" },
    @{ Name = "Backend API"; URL = "http://localhost:8001/health" },
    @{ Name = "Frontend UI"; URL = "http://localhost:3000" }
)
if ($Heavy) {
    $services += @{ Name = "SearXNG"; URL = "http://localhost:8080" }
    $services += @{ Name = "ComfyUI"; URL = "http://localhost:8188/system_stats" }
}

foreach ($svc in $services) {
    $ok = $false
    for ($i = 0; $i -lt 20; $i++) {
        try {
            Invoke-WebRequest -Uri $svc.URL -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop | Out-Null
            $ok = $true; break
        } catch { Start-Sleep -Seconds 3 }
    }
    if ($ok) { Write-Ok "$($svc.Name)" }
    else      { Write-Warn "$($svc.Name) - still starting (check: docker compose logs)" }
}

Write-Host ""
Write-Ok "BeastAI is ready!"
Write-Host ""
Write-Host "  Frontend:   http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend:    http://localhost:8001" -ForegroundColor Cyan
Write-Host "  API Docs:   http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "  Ollama:     http://localhost:11434" -ForegroundColor Cyan
if ($Heavy) {
    Write-Host "  SearXNG:    http://localhost:8080" -ForegroundColor Cyan
    Write-Host "  ComfyUI:    http://localhost:8188" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    Pull models:  ollama pull qwen3:4b" -ForegroundColor DarkGray
Write-Host "    Pull embed:   ollama pull nomic-embed-text" -ForegroundColor DarkGray
Write-Host "    Stop stack:   .\start.ps1 -Stop" -ForegroundColor DarkGray
Write-Host "    View logs:    .\start.ps1 -Logs" -ForegroundColor DarkGray
Write-Host ""
