<# Local AI Beast - Unified Stack Startup
   Starts Docker Compose services and runs health checks #>

param(
    [switch]$Heavy # include heavy profile (comfyui, searxng)
)

Write-Host "🚀 Starting Local AI Beast stack..." -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$repoRoot = $PSScriptRoot
$composeFile = Join-Path $repoRoot "docker\docker-compose.yml"

if (-not (Test-Path $composeFile)) {
    Write-Host "❌ docker-compose.yml not found at $composeFile" -ForegroundColor Red
    exit 1
}

# Compose command
$composeCmd = "docker compose -f `"$composeFile`""
if ($Heavy) { $composeCmd += " --profile heavy" }

# Bring up stack
Write-Host "`n🐳 Starting services..." -ForegroundColor Yellow
Write-Host "$composeCmd up -d" -ForegroundColor Gray
cmd /c "$composeCmd up -d"

Write-Host "`n⏳ Waiting for services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Health checks
$services = @(
    @{Name="Ollama"; URL="http://localhost:${env:OLLAMA_PORT -ne $null ? $env:OLLAMA_PORT : 11434}/api/tags"},
    @{Name="Backend"; URL="http://localhost:${env:BACKEND_PORT -ne $null ? $env:BACKEND_PORT : 8001}/health"},
    @{Name="Frontend"; URL="http://localhost:${env:FRONTEND_PORT -ne $null ? $env:FRONTEND_PORT : 3000}"},
    @{Name="ComfyUI (heavy)"; URL="http://localhost:${env:COMFYUI_PORT -ne $null ? $env:COMFYUI_PORT : 8188}/system_stats", Profile="heavy"},
    @{Name="SearXNG (heavy)"; URL="http://localhost:${env:SEARXNG_PORT -ne $null ? $env:SEARXNG_PORT : 8080}", Profile="heavy"}
)

foreach ($svc in $services) {
    if ($svc.Profile -and -not $Heavy) {
        Write-Host "  ⏭️  Skipping $($svc.Name) (heavy profile disabled)" -ForegroundColor DarkGray
        continue
    }
    try {
        $response = Invoke-WebRequest -Uri $svc.URL -TimeoutSec 5 -UseBasicParsing
        Write-Host "  ✅ $($svc.Name)" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ $($svc.Name) not responding at $($svc.URL)" -ForegroundColor Red
    }
}

Write-Host "`nDone. Use 'docker compose -f $composeFile ps' to view status." -ForegroundColor Cyan
Write-Host "Stop with: docker compose -f $composeFile down" -ForegroundColor Gray
Write-Host "=================================`n" -ForegroundColor Cyan

