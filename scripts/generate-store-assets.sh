#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_FILE="$ROOT_DIR/store/assets/source/render.html"
OUTPUT_DIR="$ROOT_DIR/store/assets/generated"
SCOPE="${STORE_ASSET_SCOPE:-all}"

if [[ "$SCOPE" != "all" && "$SCOPE" != "promo" && "$SCOPE" != "screenshots" ]]; then
  echo "STORE_ASSET_SCOPE must be all, promo, or screenshots." >&2
  exit 1
fi

if [[ -n "${CHROME_BIN:-}" && -x "$CHROME_BIN" ]]; then
  BROWSER="$CHROME_BIN"
elif [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER="$(command -v google-chrome)"
elif command -v chromium >/dev/null 2>&1; then
  BROWSER="$(command -v chromium)"
else
  echo "Chrome or Chromium was not found. Set CHROME_BIN to its executable path." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/paper4llm-store-assets.XXXXXX")"
trap 'rm -rf "$PROFILE_DIR"' EXIT

render() {
  local output="$1"
  local width="$2"
  local height="$3"
  local query="$4"
  local render_profile="$PROFILE_DIR/${output%.png}"
  local output_path="$OUTPUT_DIR/$output"
  local browser_pid
  local attempt

  mkdir -p "$render_profile"
  rm -f "$output_path"

  "$BROWSER" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-first-run \
    --no-default-browser-check \
    --force-device-scale-factor=1 \
    --user-data-dir="$render_profile" \
    --window-size="$width,$height" \
    --virtual-time-budget=1000 \
    --screenshot="$output_path" \
    "file://$SOURCE_FILE?$query" >/dev/null 2>&1 &
  browser_pid=$!

  for attempt in {1..150}; do
    if [[ -s "$output_path" ]]; then
      sleep 0.4
      break
    fi
    sleep 0.1
  done

  kill "$browser_pid" >/dev/null 2>&1 || true
  wait "$browser_pid" >/dev/null 2>&1 || true

  if [[ ! -s "$output_path" ]]; then
    echo "Failed to render $output" >&2
    exit 1
  fi

  echo "$output"
}

if [[ "$SCOPE" == "all" || "$SCOPE" == "promo" ]]; then
  render "promo-small-en-440x280.png" 440 280 "kind=promo&lang=en"
  render "promo-small-zh-CN-440x280.png" 440 280 "kind=promo&lang=zh-CN"
fi

if [[ "$SCOPE" == "all" || "$SCOPE" == "screenshots" ]]; then
  for language in en zh-CN; do
    for shot in 1 2 3; do
      render "screenshot-${shot}-${language}-1280x800.png" 1280 800 "kind=screenshot&lang=$language&shot=$shot"
    done
  done
fi

echo "$OUTPUT_DIR"
