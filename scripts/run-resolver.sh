#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/run-resolver.sh [port]
# SCRYFALL_MODE defaults to bulk; set ALLOWED_ORIGIN to your frontend origin if needed.

PORT="${1:-4000}"
export RESOLVER_PORT="$PORT"
export SCRYFALL_MODE="${SCRYFALL_MODE:-bulk}"

echo "Starting resolver on port $PORT (SCRYFALL_MODE=$SCRYFALL_MODE)..."
npm run resolver:serve
