#!/usr/bin/env bash
# Install deps and start the local stack (API, FE, crons).
# Usage: ./scripts/dev-run.sh
# Ctrl+C stops all processes.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE_DIR="$ROOT_DIR/BE"
FE_DIR="$ROOT_DIR/FE"

PIDS=()

cleanup() {
  echo ""
  echo "==> Shutting down..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "==> All processes stopped"
}

trap cleanup EXIT INT TERM

echo "==> Installing BE dependencies"
(cd "$BE_DIR" && npm install)

echo "==> Installing FE dependencies"
(cd "$FE_DIR" && npm install)

if [[ ! -f "$BE_DIR/.env" ]]; then
  cp "$BE_DIR/.env.example" "$BE_DIR/.env"
  echo "==> Created BE/.env from BE/.env.example — fill in NEWS_API_KEY / TAVILY_API_KEY"
else
  echo "==> BE/.env already exists — leaving it unchanged"
fi

start_bg() {
  local label="$1"
  shift
  echo "==> Starting $label"
  (
    cd "$BE_DIR"
    "$@"
  ) &
  PIDS+=($!)
}

echo "==> Starting OurCrowd local stack"
echo "    API:       http://localhost:3000"
echo "    Dashboard: http://localhost:5173"
echo "    Press Ctrl+C to stop everything"
echo ""

start_bg "API gateway" npm run dev
start_bg "fetch-cron" npm run fetch-cron
start_bg "analysis-cron" npm run analysis-cron
start_bg "alert-cron" npm run alert-cron

echo "==> Starting FE dashboard"
(
  cd "$FE_DIR"
  npm run dev
) &
PIDS+=($!)

wait
