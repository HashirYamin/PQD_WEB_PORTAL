#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
docker compose up -d db
cd backend
[ -f .env ] || cp .env.example .env
npm install
npm run seed
cd ../frontend
[ -f .env ] || cp .env.example .env
npm install
echo "Setup complete. Start backend with: cd backend && npm run dev"
echo "Start frontend in another terminal with: cd frontend && npm run dev"
