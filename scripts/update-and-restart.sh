#!/usr/bin/env bash
set -e
cd /srv/topdeck-compare
git pull --rebase
npm ci
systemctl restart topdeck-resolver
