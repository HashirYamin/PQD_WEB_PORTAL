$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "[1/5] Checking Node.js..." -ForegroundColor Cyan
node --version
Assert-LastExitCode "Node.js check"
npm --version
Assert-LastExitCode "npm check"

Write-Host "[2/5] Starting PostgreSQL with Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running. Start Docker Desktop, wait until the Linux engine is ready, then rerun this script."
}
Set-Location $Root
docker compose up -d db
Assert-LastExitCode "PostgreSQL startup"

Write-Host "[3/5] Preparing backend..." -ForegroundColor Cyan
Set-Location "$Root\backend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Assert-LastExitCode "Backend package installation"

Write-Host "[4/5] Creating demo database..." -ForegroundColor Cyan
npm run seed
Assert-LastExitCode "Database seed"

Write-Host "[5/5] Preparing frontend..." -ForegroundColor Cyan
Set-Location "$Root\frontend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Assert-LastExitCode "Frontend package installation"

Set-Location $Root
Write-Host "Setup complete. Run .\run-windows.ps1 from the project root." -ForegroundColor Green
