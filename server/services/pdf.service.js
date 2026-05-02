/* PDF processing services (server-side).
 *
 *   merge       — combine PDFs with pdf-lib
 *   split       — every page → its own PDF
 *   compress    — re-render pages to JPEG, embed back (lossy, real shrink)
 *   toJpg       — every page → JPEG (zip in controller)
 *   toWord      — every page → PNG → DOCX ImageRun (layout preserved)
 *
 *   Uses pdfjs-dist legacy build + node-canvas for raster operations.
 *   Both ship as well-known npm packages; works on Render out of the box.
 */
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const libreoffice = require('./libreoffice.service');

// pdfjs needs a few DOM globals on Node.
if (!global.DOMMatrix) global.DOMMatrix = Canvas.DOMMatrix;
if (!global.ImageData) global.ImageData = Canvas.ImageData;
if (!global.Path2D)    global.Path2D    = Canvas.Path2D;
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

async function readBuf(path) {
  return new Uint8Array(await fs.promises.readFile(path));
}

async function loadPdfJs(buf) {
  return pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
}

async function renderPageToPng(page, scale = 2) {
  const viewport = page.getViewport({ scale });
  const canvas = Canvas.createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { png: canvas.toBuffer('image/png'), width: viewport.width, height: viewport.height };
}

async function renderPageToJpeg(page, scale = 2, quality = 0.85) {
  const viewport = page.getViewport({ scale });
  const canvas = Canvas.createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { jpeg: canvas.toBuffer('image/jpeg', { quality }), width: viewport.width, height: viewport.height };
}

// ─── public ─────────────────────────────────────────────────────────

async function merge(filePaths) {
  if (!filePaths.length) throw new Error('No files to merge.');
  const out = await PDFDocument.create();
  for (const p of filePaths) {
    const buf = await readBuf(p);
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(page => out.addPage(page));
  }
  return Buffer.from(await out.save());
}

async function split(filePath) {
  const buf = await readBuf(filePath);
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = src.getPageCount();
  const out = [];
  for (let i = 0; i < total; i++) {
    const dest = await PDFDocument.create();
    const [page] = await dest.copyPages(src, [i]);
    dest.addPage(page);
    out.push({ index: i + 1, buf: Buffer.from(await dest.save()) });
  }
  return out;
}

async function compress(filePath, opts = {}) {
  const quality = Math.max(0.3, Math.min(0.9, Number(opts.quality) || 0.6));
  const scale   = Math.max(1.0, Math.min(2.0, Number(opts.scale)   || 1.4));
  const buf = await readBuf(filePath);
  const pdf = await loadPdfJs(buf);
  const out = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { jpeg, width, height } = await renderPageToJpeg(page, scale, quality);
    const img = await out.embedJpg(jpeg);
    const newPage = out.addPage([width, height]);
    newPage.drawImage(img, { x: 0, y: 0, width, height });
  }
  return Buffer.from(await out.save());
}

async function toJpg(filePath, opts = {}) {
  const scale = Math.max(1, Math.min(3, Number(opts.scale) || 2));
  const buf = await readBuf(filePath);
  const pdf = await loadPdfJs(buf);
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { jpeg } = await renderPageToJpeg(page, scale, 0.92);
    out.push({ index: i, buf: jpeg });
  }
  return out;
}

/* PDF → DOCX (real conversion engine).
 *
 * Strategy:
 *   1) Detect a text layer with pdf-parse.
 *      • Scanned PDFs (no text) → throw a clear "needs OCR" error.
 *        OCR fallback path (Tesseract) is documented at the bottom of this file.
 *   2) Shell out to LibreOffice. Result: selectable text, embedded
 *      images, tables and layout preserved — not a flat raster.
 *
 * Returns the absolute path to the generated .docx so the controller
 * can stream it from disk and clean up after.
 */
async function toWord(filePath) {
  // 1) Bail out early on scanned PDFs.
  const buf = await fs.promises.readFile(filePath);
  let textLen = 0;
  try { const r = await pdfParse(buf); textLen = (r.text || '').trim().length; } catch (_) { textLen = 0; }
  if (textLen < 30) {
    const err = new Error('This PDF appears to be scanned (no text layer). Run it through OCR first.');
    err.code = 'NO_TEXT_LAYER';
    throw err;
  }

  // 2) Real conversion. convertPdfToDocx auto-selects:
  //      LibreOffice (preferred) → Python pdf2docx (fallback) → error.
  //    Internally serialised to one job at a time across the process.
  const outDir = path.join(path.dirname(filePath), `out-${Date.now()}`);
  return await libreoffice.convertPdfToDocx(filePath, outDir);
}

module.exports = { merge, split, compress, toJpg, toWord };

/* ─── OCR fallback (optional, not enabled) ─────────────────────────
 * If you want scanned PDFs to convert too, render each page to a PNG
 * here (using the existing renderPageToPng helper) and feed each PNG
 * into Tesseract.js:
 *
 *   const Tesseract = require('tesseract.js');
 *   const { data: { text } } = await Tesseract.recognize(pngBuffer, 'eng');
 *
 * Then assemble the recovered text into a DOCX with the `docx`
 * package. The cost is build size (~30 MB language model) and
 * runtime (a few seconds per page), so it's left off the default
 * path. Wire it behind an `ocr=true` query flag if you need it.
 * ──────────────────────────────────────────────────────────────── */
