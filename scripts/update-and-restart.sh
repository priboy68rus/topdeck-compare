#!/usr/bin/env bash
set -euo pipefail

cd /srv/topdeck-compare

echo "[update] pulling latest changes..."
git pull --rebase

echo "[update] installing dependencies..."
npm ci

echo "[update] restarting resolver..."
sudo systemctl restart topdeck-resolver
echo "[update] done."
