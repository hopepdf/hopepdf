# H🌸PE PDF — production image
#
# Why Docker?
#   Render's native Node environment can't reliably install apt packages
#   or pip modules at build time across plans. Docker guarantees:
#     • python3 + pip3 are present
#     • pdf2docx is on the path (PRIMARY PDF→Word engine)
#     • LibreOffice is present (FALLBACK engine)
#
# Build-time verification at the bottom fails the image build if
# pdf2docx isn't callable — no silent fallback to image-DOCX in prod.

FROM node:18-bullseye

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# ---------- system + python deps ----------
# bullseye = Debian 11 → apt + pip3 work without --break-system-packages.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      libreoffice-core \
      libreoffice-writer \
 && pip3 install --no-cache-dir pdf2docx \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# ---------- node deps ----------
# Copy manifest first so Docker cache reuses npm install when only
# source files change (faster rebuilds).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ---------- source ----------
COPY . .

# ---------- build-time verification ----------
# If any of these fail, the image build aborts. No silent failures.
RUN echo "=== Verifying converters ===" \
 && python3 --version \
 && pip3 --version \
 && python3 -m pdf2docx --help > /dev/null \
 && echo "✓ pdf2docx CLI works" \
 && which soffice \
 && soffice --version \
 && echo "✓ LibreOffice present" \
 && echo "=== All converters ready ==="

EXPOSE 5000

# Render reads PORT from env; the app respects it.
CMD ["npm", "start"]
