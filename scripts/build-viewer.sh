#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== bundling viewer.js (client IIFE) ==="
npx rolldown src/viewer/viewer.js --format iife --file build/viewer.js

echo "=== bundling build-report.js (node script) ==="
npx rolldown src/viewer/build-report.mjs --format cjs --file build/build-report.js --platform node

echo "=== copying assets to build/ (for local testing) ==="
mkdir -p build/fonts
cp src/viewer/template.html         build/template.html
cp src/viewer/agents-md-template.md build/agents-md-template.md
cp src/viewer/style.css             build/style.css
cp vendor/fonts/*.woff2             build/fonts/

echo "=== copying assets to skill directory ==="
mkdir -p skills/cased/scripts skills/cased/templates/fonts

cp build/build-report.js skills/cased/scripts/build-report.js
cp build/viewer.js       skills/cased/templates/viewer.js
cp src/viewer/template.html         skills/cased/templates/template.html
cp src/viewer/agents-md-template.md skills/cased/templates/agents-md-template.md
cp src/viewer/style.css             skills/cased/templates/style.css
cp vendor/fonts/*.woff2             skills/cased/templates/fonts/

echo "=== done ==="
ls -lh build/viewer.js build/build-report.js
