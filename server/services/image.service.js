/* JPG/PNG → single PDF, lossless image embedding via pdf-lib. */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function toPdf(filePaths) {
  if (!filePaths.length) throw new Error('Add at least one image.');
  const out = await PDFDocument.create();
  for (const p of filePaths) {
    const ext = path.extname(p).toLowerCase();
    const buf = await fs.promises.readFile(p);
    const img = ext === '.png' ? await out.embedPng(buf) : await out.embedJpg(buf);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return Buffer.from(await out.save());
}

module.exports = { toPdf };
