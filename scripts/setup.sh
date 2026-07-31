#!/usr/bin/env bash
# One-time setup for new developers.
# Usage:
#   ./scripts/setup.sh              # install deps, ensure .env, load companies
#   ./scripts/setup.sh --enrich     # also run Tavily enrichment (needs TAVILY_API_KEY)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BE_DIR="$ROOT_DIR/BE"
FE_DIR="$ROOT_DIR/FE"
DO_ENRICH=0

for arg in "$@"; do
  case "$arg" in
    --enrich) DO_ENRICH=1 ;;
    -h|--help)
      echo "Usage: $0 [--enrich]"
      echo "  --enrich   Run npm run enrich-companies after load (requires TAVILY_API_KEY)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--enrich]" >&2
      exit 1
      ;;
  esac
done

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

echo "==> Loading companies into SQLite"
npm run load-companies --prefix "$BE_DIR"

if [[ "$DO_ENRICH" -eq 1 ]]; then
  echo "==> Enriching companies (Tavily)"
  npm run enrich-companies --prefix "$BE_DIR"
else
  echo "==> Skipping enrichment (pass --enrich when TAVILY_API_KEY is set)"
fi

cat <<'EOF'

Setup complete.

Next:
  1. Ensure Ollama is running and the model is pulled:
       ollama serve
       ollama pull llama3.2
  2. Fill API keys in BE/.env if needed
  3. Start the stack:
       ./scripts/dev.sh
EOF
