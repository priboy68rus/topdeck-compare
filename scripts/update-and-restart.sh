#!/usr/bin/env bash
set -euo pipefail

# Ensure common paths are available when run under systemd/webhook.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# If npm is managed by nvm, load it.
if ! command -v npm >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[update] ERROR: npm not found in PATH. Update PATH or install Node.js." >&2
  exit 1
fi

cd /srv/topdeck-compare

echo "[update] pulling latest changes..."
git pull --rebase

echo "[update] installing dependencies..."
npm ci

echo "[update] restarting resolver..."
systemctl restart topdeck-resolver
systemctl status --no-pager -l topdeck-resolver
echo "[update] done."
