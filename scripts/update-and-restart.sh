#!/usr/bin/env bash
set -euo pipefail

cd /srv/topdeck-compare

echo "[update] pulling latest changes..."
git pull --rebase

echo "[update] installing dependencies..."
npm ci

echo "[update] restarting resolver..."
sudo -n systemctl restart topdeck-resolver
sudo -n systemctl status --no-pager -l topdeck-resolver
echo "[update] done."
