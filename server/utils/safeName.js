// Strip extension, replace spaces, prevent path traversal.
const path = require('path');

function safeName(name, suffix = '', ext = 'pdf') {
  const base = path.basename(name || 'file').replace(/\.[a-z0-9]+$/i, '');
  const cleaned = base.replace(/[^a-zA-Z0-9-_ ]+/g, '_').replace(/\s+/g, '_').slice(0, 80);
  return `${cleaned}${suffix ? '_' + suffix : ''}.${ext}`;
}

module.exports = { safeName };
