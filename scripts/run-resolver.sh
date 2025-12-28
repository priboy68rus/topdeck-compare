#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/run-resolver.sh [port]
# SCRYFALL_MODE defaults to bulk; set ALLOWED_ORIGIN to your frontend origin if needed.

PORT="${1:-4000}"
export RESOLVER_PORT="$PORT"
export SCRYFALL_MODE="${SCRYFALL_MODE:-bulk}"
# Bump Node heap to reduce OOM risk when loading bulk data.
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

echo "Starting resolver on port $PORT (SCRYFALL_MODE=$SCRYFALL_MODE, NODE_OPTIONS=$NODE_OPTIONS)..."
npm run resolver:serve
