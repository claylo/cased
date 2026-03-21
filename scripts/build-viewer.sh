#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== bundling viewer.js (client IIFE) ==="
npx rolldown src/viewer/viewer.js --format iife --file dist/viewer.js

echo "=== bundling build-report.js (node script) ==="
npx rolldown src/viewer/build-report.mjs --format cjs --file dist/build-report.js --platform node

echo "=== copying assets to skill directory ==="
mkdir -p src/cased/scripts src/cased/templates/fonts

cp dist/build-report.js src/cased/scripts/build-report.js
cp dist/viewer.js       src/cased/templates/viewer.js
cp src/viewer/template.html src/cased/templates/template.html
cp src/viewer/style.css     src/cased/templates/style.css
cp vendor/fonts/*.woff2     src/cased/templates/fonts/

echo "=== done ==="
ls -lh dist/viewer.js dist/build-report.js
