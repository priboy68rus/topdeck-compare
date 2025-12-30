#!/usr/bin/env bash
set -e
cd /srv/topdeck-compare
git pull --rebase
npm ci --only=production
sudo systemctl restart topdeck-resolver
