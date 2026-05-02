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
  // Use the actual CLI form we'll invoke — this guarantees that the
  // exact command used at request time is installed, not just the
  // module import path. Logs once so missing pdf2docx is obvious.
  return new Promise((resolve) => {
    exec('python3 -m pdf2docx --help', (err, stdout) => {
      cachedPython = !err;
      if (cachedPython) console.log('[converters] pdf2docx ✓');
      else              console.warn('[converters] pdf2docx ✗ — install with: pip3 install --break-system-packages pdf2docx');
      resolve(cachedPython);
    });
  });
}

/**
 * Boot-time verification — call once from server.js so the operator
 * immediately sees in the logs whether each engine is wired up.
 * Never throws — just logs.
 */
async function verifyConverters() {
  const [soffice, py] = await Promise.all([isAvailable(), isPythonFallbackAvailable()]);
  console.log('[converters] LibreOffice (soffice):', soffice ? '✓ available' : '✗ missing');
  console.log('[converters] pdf2docx (python3):',  py      ? '✓ available' : '✗ missing');
  if (!soffice && !py) {
    console.error('[converters] ⚠️  No PDF→DOCX engine available — /pdf/to-word will return 503 NO_CONVERTER on every request.');
  }
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
// Uses the pdf2docx CLI form ("python3 -m pdf2docx convert in out").
function rawPython(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outputDir, { recursive: true });
    const base = path.basename(inputPath).replace(/\.[a-z0-9]+$/i, '');
    const out  = path.join(outputDir, `${base}.docx`);
    const cmd  = `python3 -m pdf2docx convert "${inputPath.replace(/"/g, '\\"')}" "${out.replace(/"/g, '\\"')}"`;
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
 * PDF → DOCX with strict engine priority.
 *   1) Python pdf2docx (PRIMARY) — selectable text + real tables.
 *   2) LibreOffice (FALLBACK)    — only if pdf2docx errors out.
 *   3) NO_CONVERTER              — neither engine present.
 *
 * Output is sanity-checked: if it's larger than 50 MB AND > 5× the
 * input size, that's a smell of an image-based DOCX leaking through —
 * we log a warning so it's easy to spot in production logs.
 */
async function convertPdfToDocx(inputPath, outputDir) {
  let outPath = null;

  // 1) PRIMARY — pdf2docx
  if (await isPythonFallbackAvailable()) {
    try {
      console.log('[pdf→docx] Using engine: pdf2docx');
      outPath = await runSerial(() => rawPython(inputPath, outputDir));
    } catch (err) {
      console.warn('[pdf→docx] pdf2docx failed, falling back to LibreOffice:', err.message);
      outPath = null;
    }
  }

  // 2) FALLBACK — LibreOffice (only when pdf2docx wasn't usable)
  if (!outPath) {
    if (await isAvailable()) {
      console.log('[pdf→docx] Using fallback: LibreOffice');
      outPath = await runSerial(() => rawSoffice(inputPath, outputDir, 'docx'));
    } else {
      const err = new Error('No PDF→DOCX engine available. Install pdf2docx (pip install pdf2docx) or LibreOffice (apt-get install libreoffice-core libreoffice-writer).');
      err.code = 'NO_CONVERTER';
      throw err;
    }
  }

  // 3) Output sanity check — flag suspiciously large DOCX (image-heavy)
  try {
    const [outStat, inStat] = await Promise.all([
      fs.promises.stat(outPath),
      fs.promises.stat(inputPath)
    ]);
    const outMb = outStat.size / 1024 / 1024;
    const ratio = inStat.size > 0 ? outStat.size / inStat.size : 0;
    if (outMb > 50 && ratio > 5) {
      console.warn(`[pdf→docx] WARN — DOCX is ${outMb.toFixed(1)}MB (${ratio.toFixed(1)}× input). May be image-heavy; check engine output.`);
    } else {
      console.log(`[pdf→docx] OK — ${outMb.toFixed(2)}MB (${ratio.toFixed(2)}× input)`);
    }
  } catch (_) { /* stat failure is non-fatal */ }

  return outPath;
}

module.exports = {
  isAvailable,
  isPythonFallbackAvailable,
  verifyConverters,
  convert,
  convertPdfToDocx
};
