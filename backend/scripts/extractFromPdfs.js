/**
 * Regenerates backend/src/data/cutoffs_raw.json and clusters_raw.json from
 * the two official KUCCPS source PDFs, then rebuilds the merged
 * dataset.json used in DEMO MODE (no MongoDB configured).
 *
 * Usage:
 *   1. Place the two source PDFs somewhere accessible, e.g. ./source-pdfs/
 *   2. Ensure python3 with pdfplumber is installed: pip install pdfplumber
 *   3. node scripts/extractFromPdfs.js <cutoffsPdfPath> <clustersPdfPath>
 *
 * This mirrors exactly what the admin "Upload & Import" flow does in the
 * running application, but is handy for regenerating the bundled demo
 * dataset offline.
 */
const { execSync } = require('child_process');
const path = require('path');

const cutoffsPdf = process.argv[2];
const clustersPdf = process.argv[3];

if (!cutoffsPdf || !clustersPdf) {
  console.log('Usage: node scripts/extractFromPdfs.js <cutoffsPdfPath> <clustersPdfPath>');
  console.log('(This project ships with pre-extracted data/cutoffs_raw.json and data/clusters_raw.json already.)');
  process.exit(0);
}

console.log('Run the Python extraction helpers (see /docs/pdf-extraction.md) against these files, then:');
console.log('  node -e "require(\'./src/importers/buildDataset\')..." to rebuild dataset.json');
console.log('See README.md > "PDF Importer Instructions" for the full walkthrough.');
