#!/usr/bin/env bash
# H🌸PE PDF — Render build script.
#
# Why a script (not just inline render.yaml commands)?
#   • Render's build pipeline silently swallows errors when commands are
#     chained with && and one of them returns a non-zero in a sub-shell.
#     `set -e` here makes the build *fail loudly* the moment something
#     doesn't install — no more "PDF→Word silently uses image fallback".
#   • Easier to extend and version-control.
#
# What this installs:
#   • python3 + pip3                        — for pdf2docx
#   • libreoffice-core + libreoffice-writer — fallback engine
#   • pdf2docx (pip)                        — PRIMARY PDF→Word engine
#
# After install, every binary is *verified* before the script exits.

set -euo pipefail

echo "================================================================"
echo "H🌸PE PDF — install.sh starting at $(date -u)"
echo "================================================================"

echo "--- existing tooling ---"
node --version || echo "node not present (Render will provide)"
which apt-get >/dev/null || { echo "❌ apt-get not available — switch to a Docker base image."; exit 1; }

echo "--- apt: python + libreoffice ---"
apt-get update
apt-get install -y --no-install-recommends \
  python3 python3-pip \
  libreoffice-core libreoffice-writer

echo "--- pip: pdf2docx (PRIMARY engine) ---"
# --break-system-packages is required since Debian 12 (PEP 668).
pip3 install --no-cache-dir --break-system-packages pdf2docx

echo "================================================================"
echo "Verification — every binary must be present + executable"
echo "================================================================"

echo "--- python3 ---"
python3 --version

echo "--- pip3 ---"
pip3 --version

echo "--- pdf2docx (CLI) ---"
python3 -m pdf2docx --help >/dev/null || { echo "❌ pdf2docx not callable as 'python3 -m pdf2docx'"; exit 1; }
python3 -m pdf2docx --help | head -3

echo "--- soffice ---"
which soffice
soffice --version

echo "✅ All converters installed and verified."
echo "================================================================"
