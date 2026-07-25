#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

version="$(node -p "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8')).version")"
archive="dist/paper4llm-${version}.zip"
mkdir -p dist
rm -f "$archive"

# Keep the archive rooted at manifest.json; the Web Store rejects nested extensions.
zip -q -r "$archive" \
  manifest.json \
  popup.html \
  popup.css \
  popup.js \
  _locales \
  src \
  assets/icons \
  -x '*.DS_Store'

echo "$archive"
