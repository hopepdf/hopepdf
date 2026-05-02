/* PDF processing services (server-side).
 *
 *   merge       — combine PDFs with pdf-lib
 *   split       — every page → its own PDF
 *   compress    — re-render pages to JPEG, embed back (lossy, real shrink)
 *   toJpg       — every page → JPEG (zip in controller)
 *   toWord      — pdf-parse text-layer probe → pdf2docx (PRIMARY) →
 *                 LibreOffice (FALLBACK). NEVER renders pages as images
 *                 for the DOCX. Real text + real tables guaranteed.
 *
 *   Uses pdfjs-dist legacy build + node-canvas only for raster
 *   operations (compress, toJpg). The Word path uses neither.
 */
const fs = require('fs');
const path = require('path');
const Canvas = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { PDFDocument } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const libreoffice = require('./libreoffice.service');
const ocr = require('./ocr.service');
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

/* PDF → DOCX with engine cascade.
 *
 *   text-layer present  →  pdf2docx (PRIMARY) → LibreOffice (FALLBACK)
 *   text-layer missing  →  Tesseract OCR (renders pages, extracts text,
 *                          assembles a real DOCX with selectable text)
 *
 * Either path returns the absolute path of a real text-DOCX. We never
 * embed full-page rasters in the toWord output.
 */
async function toWord(filePath) {
  // 1) Probe for a text layer.
  const buf = await fs.promises.readFile(filePath);
  let textLen = 0;
  try { const r = await pdfParse(buf); textLen = (r.text || '').trim().length; } catch (_) { textLen = 0; }

  const outDir = path.join(path.dirname(filePath), `out-${Date.now()}`);

  // 2a) Has text → real engine
  if (textLen >= 30) {
    return await libreoffice.convertPdfToDocx(filePath, outDir);
  }

  // 2b) No text → OCR (scanned PDF)
  if (!(await ocr.isAvailable())) {
    const err = new Error('This PDF is scanned and OCR (tesseract) is not installed on the server.');
    err.code = 'NO_TEXT_LAYER';
    throw err;
  }
  return await ocrPdfToDocx(filePath, outDir);
}

/* Renders every page → PNG → tesseract → assembles a docx with the
 * recovered text. Output is real selectable text, NOT a page image.
 */
async function ocrPdfToDocx(filePath, outDir) {
  console.log('[pdf→docx] Using engine: OCR (Tesseract) — scanned PDF detected');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docxLib;

  const buf = await readBuf(filePath);
  const pdf = await loadPdfJs(buf);
  const children = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const { png } = await renderPageToPng(page, 2);
    let text = '';
    try { text = await ocr.imageBufferToText(png, 'eng'); }
    catch (e) { console.warn(`[pdf→docx] OCR page ${i} failed: ${e.message}`); }

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_4,
      children: [new TextRun({ text: `Page ${i}`, bold: true })]
    }));

    if (text) {
      // Treat blank lines as paragraph breaks — gives readable structure.
      text.split(/\r?\n\s*\r?\n+/).forEach((block) => {
        const t = block.replace(/\s+\n/g, '\n').trim();
        if (t) children.push(new Paragraph({ children: [new TextRun(t)] }));
      });
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: '(no text recognised on this page)', italics: true })] }));
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  const docxBuf = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  const base    = path.basename(filePath).replace(/\.[a-z0-9]+$/i, '');
  const outPath = path.join(outDir, `${base}.docx`);
  fs.writeFileSync(outPath, docxBuf);
  console.log(`[pdf→docx] OCR done — ${(docxBuf.length / 1024).toFixed(1)} KB`);
  return outPath;
}

module.exports = { merge, split, compress, toJpg, toWord };

/* OCR is now wired into toWord above (system tesseract via
 * services/ocr.service.js). No additional setup needed. */
