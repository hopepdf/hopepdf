/* Tesseract OCR wrapper.
 *
 * Used by pdf.service.toWord() when the input PDF has no text layer
 * (scanned page images). Renders each page to PNG via pdfjs+canvas
 * (caller's responsibility), then shells out to the system tesseract
 * binary for the actual character recognition.
 *
 * Why shell out (not tesseract.js)?
 *   • Smaller container — no 30 MB language-model JS bundle
 *   • Faster, multi-threaded
 *   • Same binary the rest of the world tunes against
 *
 * Install (already in Dockerfile):
 *   apt-get install -y tesseract-ocr tesseract-ocr-eng
 */
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TIMEOUT_MS = 60_000;
let cached = null;

function isAvailable() {
  if (cached !== null) return Promise.resolve(cached);
  return new Promise((resolve) => {
    exec('which tesseract', (err) => {
      cached = !err;
      resolve(cached);
    });
  });
}

/**
 * Run tesseract on a single PNG buffer and return the recovered text.
 * @param {Buffer}  pngBuffer
 * @param {string}  lang      Tesseract language code (default 'eng')
 * @returns {Promise<string>} extracted text (whitespace trimmed)
 */
function imageBufferToText(pngBuffer, lang = 'eng') {
  return new Promise((resolve, reject) => {
    const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-ocr-'));
    const inputPath = path.join(tmpDir, 'page.png');
    const outBase   = path.join(tmpDir, 'out');
    try { fs.writeFileSync(inputPath, pngBuffer); }
    catch (e) { return reject(new Error('OCR write failed: ' + e.message)); }

    const cmd = `tesseract "${inputPath}" "${outBase}" -l ${lang}`;
    exec(cmd, { timeout: TIMEOUT_MS }, (err, _stdout, stderr) => {
      let text = '';
      try { text = fs.readFileSync(`${outBase}.txt`, 'utf8'); } catch (_) {}
      fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      if (err) return reject(new Error(`tesseract failed: ${err.message || stderr}`));
      resolve((text || '').trim());
    });
  });
}

module.exports = { isAvailable, imageBufferToText };
