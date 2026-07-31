#!/usr/bin/env bash
# Start API, dashboard, and background jobs for local development.
# Usage: ./scripts/dev.sh
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

if [[ ! -f "$BE_DIR/.env" ]]; then
  echo "Missing BE/.env — run ./scripts/setup.sh first" >&2
  exit 1
fi

if [[ ! -d "$BE_DIR/node_modules" || ! -d "$FE_DIR/node_modules" ]]; then
  echo "Dependencies missing — run ./scripts/setup.sh first" >&2
  exit 1
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

# Keep the script alive until a child exits or Ctrl+C
wait
