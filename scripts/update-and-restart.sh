#!/usr/bin/env bash
set -euo pipefail

# Ensure common paths are available when run under systemd/webhook.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

cd /srv/topdeck-compare

echo "[update] pulling latest changes..."
git pull --rebase

echo "[update] installing dependencies..."
npm ci

echo "[update] restarting resolver..."
systemctl restart topdeck-resolver
systemctl status --no-pager -l topdeck-resolver
echo "[update] done."
