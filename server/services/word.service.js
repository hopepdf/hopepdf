/* Word → PDF.
 *
 *  Reads .doc/.docx via mammoth (raw text), typesets into a PDF with
 *  pdfkit. Layout is plain prose; for fully styled .docx → PDF you'd
 *  shell out to libreoffice headless. Kept Node-only for portability.
 */
const fs = require('fs');
const path = require('path');
const PDFKit = require('pdfkit');
const mammoth = require('mammoth');

async function toPdf(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('File missing.');
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.doc' && ext !== '.docx') throw new Error('Provide a .doc or .docx file.');

  const { value: text } = await mammoth.extractRawText({ path: filePath });
  if (!text || !text.trim()) throw new Error('Document has no readable text.');

  return await new Promise((resolve, reject) => {
    const doc = new PDFKit({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica').fontSize(12);
    doc.text(text, { align: 'left', lineGap: 4 });
    doc.end();
  });
}

module.exports = { toPdf };
