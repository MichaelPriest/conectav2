const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
const targetDir = path.join(__dirname, '..', 'public', 'vendor');
const target = path.join(targetDir, 'pdf.worker.min.mjs');

if (!fs.existsSync(source)) {
  throw new Error('PDF.js worker is missing. Install the pinned pdfjs-dist dependency before building.');
}
fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('Prepared local PDF.js worker for CNH PDF conversion.');
