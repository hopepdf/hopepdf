/* Word → PDF.
 *
 *   Primary engine:  LibreOffice headless — preserves styles, tables,
 *                    images, columns, fonts.
 *   Fallback:        mammoth + pdfkit (plain text only) — kept for dev
 *                    environments without LibreOffice installed.
 *
 *   Returns:
 *     { path }   — absolute path to the produced PDF (LibreOffice path)
 *                  controllers stream this and clean it up after.
 *     { buffer } — full PDF buffer (fallback path)
 */
const fs = require('fs');
const path = require('path');
const PDFKit = require('pdfkit');
const mammoth = require('mammoth');
const libreoffice = require('./libreoffice.service');

async function toPdf(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('File missing.');
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.doc' && ext !== '.docx') throw new Error('Provide a .doc or .docx file.');

  // Primary: LibreOffice
  if (await libreoffice.isAvailable()) {
    const outDir = path.join(path.dirname(filePath), `out-${Date.now()}`);
    const out = await libreoffice.convert(filePath, outDir, 'pdf');
    return { path: out };
  }

  // Fallback: text-only typeset (works in dev without soffice).
  const { value: text } = await mammoth.extractRawText({ path: filePath });
  if (!text || !text.trim()) throw new Error('Document has no readable text.');
  const buffer = await new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(12).text(text, { align: 'left', lineGap: 4 });
    doc.end();
  });
  return { buffer };
}

module.exports = { toPdf };
