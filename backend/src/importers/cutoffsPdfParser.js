const pdfParse = require('pdf-parse');

/**
 * Parses the KUCCPS cutoffs PDF's extracted text into structured records.
 * This is intentionally isolated from the calculation engine so that when
 * KUCCPS changes the PDF layout, only this file needs to change.
 *
 * Row shape in the source document (per line, whitespace-normalized):
 *   <#> <PROG CODE> <INSTITUTION NAME ...> <PROGRAMME NAME ...> <7 cutoff values>
 * Category section headers appear as standalone lines in ALL CAPS starting
 * with "BACHELOR OF" with no numeric values.
 */
function cleanNumber(token) {
  if (!token) return null;
  if (token === '-' || token === '—') return null;
  const n = parseFloat(token.replace(/,/g, ''));
  return Number.isNaN(n) ? null : n;
}

async function parseCutoffsPdf(buffer) {
  const data = await pdfParse(buffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

  const records = [];
  const warnings = [];
  let currentCategory = null;

  const rowPattern = /^(\d+)\s+(\d{6,7})\s+(.+)$/;
  const numberTailPattern = /((?:-|\d+\.\d+|\d+)(?:\s+(?:-|\d+\.\d+|\d+)){6})\s*$/;

  for (const line of lines) {
    if (/^BACHELOR OF/i.test(line) && !rowPattern.test(line)) {
      currentCategory = line;
      continue;
    }
    const rowMatch = line.match(rowPattern);
    if (!rowMatch) continue;

    const [, , progCode, remainder] = rowMatch;
    const tailMatch = remainder.match(numberTailPattern);
    if (!tailMatch) {
      warnings.push(`Could not find 7 cutoff values on line: "${line}"`);
      continue;
    }
    const years = tailMatch[1].split(/\s+/);
    const nameAndInstitution = remainder.slice(0, tailMatch.index).trim();

    // Institution name is the leading run of capitalized words before the
    // programme name; since both are free text in the source, we split on
    // the first occurrence of "BACHELOR" to separate them (holds true for
    // this dataset where every programme name starts with "BACHELOR").
    const bachelorIdx = nameAndInstitution.indexOf('BACHELOR');
    if (bachelorIdx === -1) {
      warnings.push(`Could not split institution/programme on line: "${line}"`);
      continue;
    }
    const institutionName = nameAndInstitution.slice(0, bachelorIdx).trim();
    const programmeName = nameAndInstitution.slice(bachelorIdx).trim();

    const cutoffHistory = [];
    [2018, 2019, 2020, 2021, 2022, 2023, 2024].forEach((year, i) => {
      const score = cleanNumber(years[i]);
      if (score !== null) cutoffHistory.push({ year, score });
    });
    const latestCutoff = cutoffHistory.length
      ? [...cutoffHistory].sort((a, b) => b.year - a.year)[0]
      : null;

    records.push({
      programmeCode: progCode,
      institutionName,
      programmeName,
      category: currentCategory,
      cutoffHistory,
      latestCutoff
    });
  }

  return { records, warnings };
}

module.exports = { parseCutoffsPdf };
