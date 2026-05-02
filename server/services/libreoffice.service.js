/* LibreOffice headless converter — single shared wrapper.
 *
 * Production deploy:
 *   apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer
 *   (Render: handled in render.yaml's buildCommand)
 *
 * Optional Python fallback for higher-fidelity PDF → DOCX:
 *   pip install pdf2docx
 *   The fallback is used automatically when soffice is missing AND
 *   `python3 -c "import pdf2docx"` succeeds. Falls back gracefully.
 *
 * Why LibreOffice (primary)?
 *   • PDF → DOCX preserves selectable text, embedded images, tables.
 *   • Word → PDF preserves styles + images.
 *   • Both directions, single binary, same flag set.
 *
 * Concurrency:
 *   Spawning multiple soffice processes simultaneously can OOM small
 *   instances and corrupts the user-profile lock. We serialise every
 *   convert() through an in-process FIFO queue. One job at a time.
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 120 * 1000;
let cachedSoffice = null;
let cachedPython  = null;

/* ────────────────────── availability probes ───────────────────── */

function isAvailable() {
  if (cachedSoffice !== null) return Promise.resolve(cachedSoffice);
  return new Promise((resolve) => {
    exec('which soffice', (err) => {
      cachedSoffice = !err;
      resolve(cachedSoffice);
    });
  });
}

function isPythonFallbackAvailable() {
  if (cachedPython !== null) return Promise.resolve(cachedPython);
  return new Promise((resolve) => {
    exec('python3 -c "import pdf2docx" 2>/dev/null', (err) => {
      cachedPython = !err;
      resolve(cachedPython);
    });
  });
}

/* ────────────────────── serial queue ──────────────────────────── */
// Plain promise chain — each task runs only after the previous resolves.
// Keeps memory + CPU sane on small Render instances.
let queueTail = Promise.resolve();
function runSerial(task) {
  const next = queueTail.then(() => task()).catch((e) => { throw e; });
  // Don't let a failed task break the queue for subsequent tasks.
  queueTail = next.catch(() => {});
  return next;
}

/* ────────────────────── core soffice convert ──────────────────── */

function rawSoffice(inputPath, outputDir, targetFormat) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputPath)) return reject(new Error('Input file missing.'));
    fs.mkdirSync(outputDir, { recursive: true });

    const cmd = [
      'soffice',
      '--headless',
      '--nologo',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to', targetFormat,
      `"${inputPath.replace(/"/g, '\\"')}"`,
      '--outdir', `"${outputDir.replace(/"/g, '\\"')}"`
    ].join(' ');

    exec(cmd, { timeout: TIMEOUT_MS }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`LibreOffice failed: ${err.message || stderr || 'unknown'}`));
      const base = path.basename(inputPath).replace(/\.[a-z0-9]+$/i, '');
      const out = path.join(outputDir, `${base}.${targetFormat}`);
      if (!fs.existsSync(out)) return reject(new Error('LibreOffice produced no output.'));
      resolve(out);
    });
  });
}

/* ────────────────────── optional Python fallback ──────────────── */
// Higher fidelity than LibreOffice for PDF → DOCX in some edge cases.
// Used only if LibreOffice isn't installed.
function rawPython(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });
    const base = path.basename(inputPath).replace(/\.[a-z0-9]+$/i, '');
    const out  = path.join(outputDir, `${base}.docx`);
    const py = `
import sys
from pdf2docx import Converter
cv = Converter(sys.argv[1])
cv.convert(sys.argv[2], start=0, end=None)
cv.close()
`;
    const cmd = `python3 -c '${py.replace(/'/g, "'\\''")}' "${inputPath.replace(/"/g, '\\"')}" "${out.replace(/"/g, '\\"')}"`;
    exec(cmd, { timeout: TIMEOUT_MS * 2 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`pdf2docx failed: ${err.message || stderr || 'unknown'}`));
      if (!fs.existsSync(out)) return reject(new Error('pdf2docx produced no output.'));
      resolve(out);
    });
  });
}

/* ────────────────────── public API ────────────────────────────── */

/**
 * Generic conversion (any format LibreOffice supports).
 * Serialised through the in-process queue.
 */
function convert(inputPath, outputDir, targetFormat) {
  return runSerial(() => rawSoffice(inputPath, outputDir, targetFormat));
}

/**
 * PDF → DOCX with automatic engine selection:
 *   1) LibreOffice if available (preferred — wide format support)
 *   2) Python pdf2docx if soffice missing but python+pdf2docx present
 *   3) Throws a clear error otherwise
 *
 * Matches the spec's named export.
 */
async function convertPdfToDocx(inputPath, outputDir) {
  if (await isAvailable()) {
    return runSerial(() => rawSoffice(inputPath, outputDir, 'docx'));
  }
  if (await isPythonFallbackAvailable()) {
    return runSerial(() => rawPython(inputPath, outputDir));
  }
  const err = new Error('No PDF→DOCX engine available. Install LibreOffice (apt-get install libreoffice-core libreoffice-writer) or pip install pdf2docx.');
  err.code = 'NO_CONVERTER';
  throw err;
}

module.exports = {
  isAvailable,
  isPythonFallbackAvailable,
  convert,
  convertPdfToDocx
};
