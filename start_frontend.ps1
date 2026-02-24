# BeastAI — Frontend Dev Server
# Starts the Next.js frontend in development mode (local dev, no Docker).
# For full stack startup use: .\start.ps1 -Dev

$repoRoot   = $PSScriptRoot
$frontendDir = Join-Path $repoRoot "frontend"

Write-Host ""
Write-Host "Starting BeastAI Frontend (dev)..." -ForegroundColor Cyan
Write-Host "══════════════════════════════════" -ForegroundColor Cyan

# Check Node.js
try {
    $v = node --version
    Write-Host "  Node.js: $v" -ForegroundColor Green
} catch {
    Write-Host "  [ERR] Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Install deps if needed
if (-not (Test-Path "$frontendDir\node_modules")) {
    Write-Host "  Installing dependencies..." -ForegroundColor Yellow
    Set-Location $frontendDir
    npm install
}

# Create .env.local if missing
$envLocal = Join-Path $frontendDir ".env.local"
if (-not (Test-Path $envLocal)) {
    "NEXT_PUBLIC_API_BASE=http://localhost:8001/api" | Out-File $envLocal -Encoding utf8
    Write-Host "  Created .env.local" -ForegroundColor Green
}

Write-Host ""
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "══════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Set-Location $frontendDir
npm run dev
