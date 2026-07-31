#!/usr/bin/env bash
# Full first-time install: deps, load/enrich companies, then start the local stack.
# Usage: ./scripts/full-install.sh
# Requires: Ollama running; TAVILY_API_KEY in BE/.env for enrichment.
# Ctrl+C stops all processes after the stack starts.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE_DIR="$ROOT_DIR/BE"
FE_DIR="$ROOT_DIR/FE"
DEV_RUN="$ROOT_DIR/scripts/dev-run.sh"

echo "==> Installing BE dependencies"
npm install --prefix "$BE_DIR"

echo "==> Installing FE dependencies"
npm install --prefix "$FE_DIR"

if [[ ! -f "$BE_DIR/.env" ]]; then
  cp "$BE_DIR/.env.example" "$BE_DIR/.env"
  echo "==> Created BE/.env from BE/.env.example — fill in NEWS_API_KEY / TAVILY_API_KEY"
else
  echo "==> BE/.env already exists — leaving it unchanged"
fi

echo "==> Enriching companies (Tavily)"
npm run enrich-companies --prefix "$BE_DIR"

echo "==> Loading companies into SQLite (classifyCompanies via LLM)"
npm run load-companies --prefix "$BE_DIR"

echo "==> Starting stack via dev-run.sh"
exec "$DEV_RUN"
