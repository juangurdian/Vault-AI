<# Local AI Beast - Unified Docker Stack Startup Script
   Starts the entire Local AI Beast stack using Docker Compose.
   Supports profiles for heavy services like ComfyUI and SearXNG. #>

[CmdletBinding()]
param (
    [switch]$Heavy # Include heavy services (ComfyUI, SearXNG)
)

Write-Host "Starting Local AI Beast Docker Stack..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Resolve repo root and docker-compose path
$repoRoot = $PSScriptRoot
$dockerComposeFile = Join-Path $repoRoot "docker\docker-compose.yml"

if (-not (Test-Path $dockerComposeFile)) {
    Write-Host "[ERROR] docker-compose.yml not found at $dockerComposeFile" -ForegroundColor Red
    exit 1
}

Set-Location $repoRoot

# Build arguments
$composeArgs = @("-f", $dockerComposeFile, "up", "-d", "--build")

if ($Heavy) {
    Write-Host "`n[DOCKER] Including heavy services (ComfyUI, SearXNG)..." -ForegroundColor Yellow
    $composeArgs += @("--profile", "heavy")
} else {
    Write-Host "`n[DOCKER] Starting core services (Ollama, Backend, Frontend)..." -ForegroundColor Yellow
}

# Start Docker Compose
Write-Host "`n[BUILD] Building and starting containers..." -ForegroundColor Yellow
try {
    docker compose @composeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed with exit code $LASTEXITCODE"
    }
    Write-Host "`n[OK] Docker Compose services started." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to start Docker Compose services." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "`n[WAIT] Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Health checks
Write-Host "`n[HEALTH] Running health checks..." -ForegroundColor Yellow
$services = @(
    @{Name="Ollama"; URL="http://localhost:11434/api/tags"},
    @{Name="Backend API"; URL="http://localhost:8001/health"},
    @{Name="Frontend UI"; URL="http://localhost:3000"}
)

if ($Heavy) {
    $services += @(
        @{Name="ComfyUI"; URL="http://localhost:8188/system_stats"},
        @{Name="SearXNG"; URL="http://localhost:8080"}
    )
}

$allHealthy = $true
foreach ($service in $services) {
    Write-Host "  Checking $($service.Name)..." -NoNewline -ForegroundColor DarkGray
    $isHealthy = $false
    for ($i = 0; $i -lt 15; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $service.URL -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            $isHealthy = $true
            break
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    if ($isHealthy) {
        Write-Host "`r  [OK] $($service.Name) is healthy." -ForegroundColor Green
    } else {
        Write-Host "`r  [FAIL] $($service.Name) is not responding." -ForegroundColor Red
        $allHealthy = $false
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
if ($allHealthy) {
    Write-Host "[SUCCESS] Local AI Beast Stack is ready!" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Some services may still be starting. Check logs with:" -ForegroundColor Yellow
    Write-Host "   docker compose -f $dockerComposeFile logs" -ForegroundColor Gray
}
Write-Host "`nAccess points:" -ForegroundColor White
Write-Host "   Frontend UI:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Backend API:  http://localhost:8001/api" -ForegroundColor Cyan
Write-Host "   Ollama:       http://localhost:11434" -ForegroundColor Cyan
if ($Heavy) {
    Write-Host "   ComfyUI:      http://localhost:8188" -ForegroundColor Cyan
    Write-Host "   SearXNG:      http://localhost:8080" -ForegroundColor Cyan
}
Write-Host "`nUseful commands:" -ForegroundColor White
Write-Host "   View logs:    docker compose -f $dockerComposeFile logs -f" -ForegroundColor Gray
Write-Host "   Stop stack:   docker compose -f $dockerComposeFile down" -ForegroundColor Gray
Write-Host "   View status:  docker compose -f $dockerComposeFile ps" -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Cyan

