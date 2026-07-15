$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "[1/6] Checking Node.js and npm..." -ForegroundColor Cyan
node --version
Assert-LastExitCode "Node.js check"
npm --version
Assert-LastExitCode "npm check"

Write-Host "[2/6] Checking Docker Desktop..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop is not running. Starting it now..." -ForegroundColor Yellow
    docker desktop start *> $null
    if ($LASTEXITCODE -ne 0) {
        $DockerExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $DockerExe) {
            Start-Process $DockerExe
        } else {
            throw "Docker Desktop is not installed or could not be started. Open Docker Desktop manually, wait for the engine to run, then rerun this script."
        }
    }

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        docker info *> $null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    }
    if (-not $ready) {
        throw "Docker Desktop did not become ready. Open Docker Desktop and confirm the Linux engine is running."
    }
}

Write-Host "[3/6] Starting PostgreSQL..." -ForegroundColor Cyan
Set-Location $Root
docker compose up -d db
Assert-LastExitCode "PostgreSQL startup"

Write-Host "Waiting for PostgreSQL to become healthy..." -ForegroundColor DarkCyan
$dbReady = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 2
    $status = docker inspect --format='{{.State.Health.Status}}' pqd_web_portal-db-1 2>$null
    if ($LASTEXITCODE -eq 0 -and $status -eq 'healthy') {
        $dbReady = $true
        break
    }
}
if (-not $dbReady) {
    docker compose ps
    throw "PostgreSQL did not become healthy. Check Docker Desktop logs and rerun the script."
}

Write-Host "[4/6] Repairing and installing backend packages..." -ForegroundColor Cyan
Set-Location "$Root\backend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
npm cache verify
Assert-LastExitCode "npm cache verification"
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Assert-LastExitCode "Backend package installation"

Write-Host "[5/6] Creating the demo database..." -ForegroundColor Cyan
npm run seed
Assert-LastExitCode "Database seed"

Write-Host "[6/6] Repairing and installing frontend packages..." -ForegroundColor Cyan
Set-Location "$Root\frontend"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
Assert-LastExitCode "Frontend package installation"

Set-Location $Root
Write-Host "Repair and setup complete." -ForegroundColor Green
Write-Host "Now run: .\run-windows.ps1" -ForegroundColor Cyan
