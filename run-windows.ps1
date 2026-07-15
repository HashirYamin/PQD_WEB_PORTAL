$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
docker compose up -d db
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend'; npm run dev"
Write-Host "Backend and frontend are starting in separate windows." -ForegroundColor Green
Write-Host "Open http://localhost:5173" -ForegroundColor Cyan
