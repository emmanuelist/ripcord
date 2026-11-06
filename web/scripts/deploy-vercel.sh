#!/usr/bin/env bash
# Deploys web/ to Vercel production as a prebuilt static site (Build Output API v3).
#
# Why prebuilt: the toolchain pins Node 26 (D-005) and Vercel's builders stop at 24.x (2026-11-06), so the site is
# built here with the pinned Node and only the static files are uploaded. Source maps are left out while the repo is
# private (D-009). Run from web/: ./scripts/deploy-vercel.sh
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
rm -rf .vercel/output
mkdir -p .vercel/output/static
cp -R dist/. .vercel/output/static/
rm -f .vercel/output/static/assets/*.map
for f in .vercel/output/static/assets/*.js; do sed -i '' 's|//# sourceMappingURL=.*||' "$f"; done
cat > .vercel/output/config.json <<'JSON'
{
  "version": 3,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
JSON
vercel deploy --prebuilt --prod --yes
