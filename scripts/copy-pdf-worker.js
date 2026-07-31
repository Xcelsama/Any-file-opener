// Copies pdf.js's worker script from node_modules into public/, so it gets
// included in the static export (and therefore inside the Android APK)
// instead of being loaded from a CDN at runtime.
//
// Runs automatically via the "postinstall" script in package.json, so it
// always matches whatever pdfjs-dist version is actually installed —
// nothing to keep in sync by hand.

const fs = require('fs');
const path = require('path');

const src = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'legacy',
  'build',
  'pdf.worker.min.js'
);
const destDir = path.join(__dirname, '..', 'public');
const dest = path.join(destDir, 'pdf.worker.min.js');

if (!fs.existsSync(src)) {
  console.warn(
    '[copy-pdf-worker] Could not find pdf.worker.min.js in node_modules/pdfjs-dist. ' +
    'PDF viewing will not work until this file is present at public/pdf.worker.min.js. ' +
    'Did `npm install` finish successfully?'
  );
  process.exit(0); // don't fail the install over this
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('[copy-pdf-worker] Copied pdf.worker.min.js -> public/pdf.worker.min.js');
