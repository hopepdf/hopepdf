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
const Canvas = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');
const docxLib = require('docx');

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

async function toWord(filePath) {
  const { Document, Packer, Paragraph, ImageRun } = docxLib;
  const buf = await readBuf(filePath);
  const pdf = await loadPdfJs(buf);
  const TARGET_W_PX = 720; // ≈ A4 width minus 0.25" margins
  const children = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { png, width, height } = await renderPageToPng(page, 2);
    const targetH = Math.round((height / width) * TARGET_W_PX);
    children.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new ImageRun({ data: png, transformation: { width: TARGET_W_PX, height: targetH } })]
    }));
  }
  if (!children.length) throw new Error('PDF has no pages.');
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 360, right: 360, bottom: 360, left: 360 } } },
      children
    }]
  });
  const blob = await Packer.toBlob(doc);
  return Buffer.from(await blob.arrayBuffer());
}

module.exports = { merge, split, compress, toJpg, toWord };
