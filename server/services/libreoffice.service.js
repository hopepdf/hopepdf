/* LibreOffice headless converter — single shared wrapper.
 *
 * Production deploy needs:
 *   apt-get install -y --no-install-recommends libreoffice-core libreoffice-writer
 *   (Render: add to your build script or a Docker base image)
 *
 * Why LibreOffice?
 *   • PDF → DOCX preserves selectable text, embedded images and tables.
 *   • Word → PDF preserves styles + images.
 *   • Both directions in a single binary; same flags set.
 *
 * The "fast flags" come from LibreOffice's docs:
 *   --headless           run with no GUI
 *   --nologo             skip splash
 *   --nolockcheck        skip user-profile lock
 *   --nodefault          don't load default doc
 *   --nofirststartwizard skip first-start questions
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 120 * 1000;
let cachedAvailable = null;

function isAvailable() {
  if (cachedAvailable !== null) return Promise.resolve(cachedAvailable);
  return new Promise((resolve) => {
    exec('which soffice', (err) => {
      cachedAvailable = !err;
      resolve(cachedAvailable);
    });
  });
}

/**
 * Convert input → outputDir/<basename>.<format> with LibreOffice.
 * @returns {Promise<string>} path to the produced file
 */
function convert(inputPath, outputDir, targetFormat) {
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
      if (!fs.existsSync(out)) {
        return reject(new Error('LibreOffice produced no output (check soffice install).'));
      }
      resolve(out);
    });
  });
}

module.exports = { isAvailable, convert };
