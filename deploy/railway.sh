#!/usr/bin/env bash
# Build amm-lite and deploy the static bundle to Railway.
#
# First deployed 2026-07-23: project "amm-lite" in the Provable Games
# workspace -> https://amm-lite-production.up.railway.app
# The app is a fully static bundle (hash routing, chain config compiled in;
# Sepolia addresses in src/app/services/address.ts) fronted by `serve`.
#
# Requires the Railway CLI, signed in (railway login).
set -euo pipefail

PROJECT_ID=645a2b6b-d3e8-4a35-b3c0-d7c83540da7c
SERVICE_ID=6e58e6f8-e5ee-4b71-8e16-d4216149894b
ENVIRONMENT_ID=0cf79704-79d0-4de9-b7f6-14328d88e02a

cd "$(dirname "$0")/.."
npx ng build

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/public"
cp -r dist/amm-lite/browser/* "$STAGE/public/"
cat > "$STAGE/package.json" <<'EOF'
{
  "name": "amm-lite",
  "private": true,
  "scripts": {
    "start": "serve -s public -l tcp://0.0.0.0:${PORT:-3000}"
  },
  "dependencies": {
    "serve": "^14.2.4"
  }
}
EOF

cd "$STAGE"
railway link --project "$PROJECT_ID" --environment "$ENVIRONMENT_ID" >/dev/null
railway up --service "$SERVICE_ID"
