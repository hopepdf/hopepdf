#!/usr/bin/env bash
# H🌸PE PDF — local launcher
# Picks Python 3, then Node, then PHP — whichever is available.

set -e
cd "$(dirname "$0")"
PORT="${PORT:-8000}"

echo ""
echo "🌸  H🌸PE PDF — starting on http://localhost:${PORT}"
echo "    (Press Ctrl+C to stop)"
echo ""

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  exec python -m SimpleHTTPServer "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server -p "${PORT}" -c-1
elif command -v php >/dev/null 2>&1; then
  exec php -S "localhost:${PORT}"
else
  echo "Neither python, npx, nor php is available."
  echo "Install one of them, or open index.html directly in your browser."
  exit 1
fi
