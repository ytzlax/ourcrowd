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
(cd "$BE_DIR" && npm install)

echo "==> Installing FE dependencies"
(cd "$FE_DIR" && npm install)

if [[ ! -f "$BE_DIR/.env" ]]; then
  cp "$BE_DIR/.env.example" "$BE_DIR/.env"
  echo "==> Created BE/.env from BE/.env.example — fill in NEWS_API_KEY / TAVILY_API_KEY"
else
  echo "==> BE/.env already exists — leaving it unchanged"
fi

echo "==> Enriching companies (Tavily)"
(cd "$BE_DIR" && npm run enrich-companies)

echo "==> Loading companies into SQLite (classifyCompanies via LLM)"
(cd "$BE_DIR" && npm run load-companies)

echo "==> Starting stack via dev-run.sh"
exec "$DEV_RUN"
