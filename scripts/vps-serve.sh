#!/usr/bin/env bash
# Run Vite on 127.0.0.1 so Cloudflare Tunnel can reach the app without Docker.
# Safe alongside the Reflex stack (different ports; no compose changes).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
mkdir -p "$ROOT/logs"
DEV_LOG="$ROOT/logs/vite-dev.log"
PRV_LOG="$ROOT/logs/vite-preview.log"

free_port() {
  local p="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "127.0.0.1:${p}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${p}" 2>/dev/null | xargs -r kill 2>/dev/null || true
  fi
}

start() {
  if ! command -v npx >/dev/null 2>&1; then
    echo "npx not found. Install Node (e.g. nvm) first." >&2
    exit 1
  fi
  if [ ! -d "$ROOT/node_modules" ] || [ ! -f "$ROOT/dist/index.html" ]; then
    echo "Run: npm ci && npm run build" >&2
    exit 1
  fi
  free_port 5173
  free_port 4173
  sleep 1
  nohup npx vite --host 127.0.0.1 --port 5173 >>"$DEV_LOG" 2>&1 &
  nohup npx vite preview --host 127.0.0.1 --port 4173 >>"$PRV_LOG" 2>&1 &
  sleep 1
  status
}

stop() {
  free_port 5173
  free_port 4173
  echo "Stopped listeners on 127.0.0.1:5173 and :4173 (if any)."
}

status() {
  ss -tlnp 2>/dev/null | grep -E '127.0.0.1:5173|127.0.0.1:4173' || echo "No listeners on 127.0.0.1:5173 or :4173"
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|status}" >&2; exit 1 ;;
esac
