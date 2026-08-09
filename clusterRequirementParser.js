/**
 * Parses the raw text captured from DEGREE_CLUSTER_DOCUMENT into a
 * structured requirement object.
 *
 * IMPORTANT / HONESTY NOTE:
 * The source PDF expresses subject requirements as named subjects
 * (e.g. "MAT ALTERNATIVE A", "PHY", "ENG/KIS") AND as generic KUCCPS
 * subject-group references ("Any GROUP II", "2nd GROUP III", etc.).
 * The document supplied to this importer does not itself enumerate which
 * subjects belong to GROUP II / III / IV / V, so this parser cannot
 * silently invent that mapping (see project instruction: never invent
 * unsupported subject/requirement data). Anything it cannot resolve to a
 * literal subject name is left `resolved: false` and surfaced as an
 * `unresolvedGroupReference`. The eligibility engine treats unresolved
 * slots as "not evaluated" rather than as a hard failure, and the import
 * summary counts them so an admin can supply the missing Group I-V legend
 * to fully resolve requirements in a later dataset revision.
 */

const KNOWN_SUBJECT_ALIASES = {
  'ENG': ['ENGLISH'],
  'KIS': ['KISWAHILI'],
  'MAT ALTERNATIVE A': ['MATHEMATICS'],
  'MAT ALTERNATIVE B': ['MATHEMATICS'],
  'MATHEMATICS ALTERNATIVE A': ['MATHEMATICS'],
  'MATHEMATICS ALTERNATIVE B': ['MATHEMATICS'],
  'PHY': ['PHYSICS'],
  'CHE': ['CHEMISTRY'],
  'BIO': ['BIOLOGY'],
  'GEO': ['GEOGRAPHY'],
  'HAG': ['HISTORY AND GOVERNMENT'],
  'CRE': ['CHRISTIAN RELIGIOUS EDUCATION'],
  'IRE': ['ISLAMIC RELIGIOUS EDUCATION'],
  'HRE': ['HINDU RELIGIOUS EDUCATION'],
  'FRE': ['FRENCH'],
  'GER': ['GERMAN'],
  'MUS': ['MUSIC'],
  'ARD': ['ART AND DESIGN'],
  'COMP': ['COMPUTER STUDIES'],
  'AGR': ['AGRICULTURE'],
  'BST': ['BUSINESS STUDIES'],
  'HSC': ['HOME SCIENCE'],
  'SSE': ['SOCIAL EDUCATION AND ETHICS'],
  'CMP': ['COMPUTER STUDIES'],
  'PSC': ['PHYSICAL SCIENCES'],
};

const GRADE_TOKEN = /(A-|B\+|B-|C\+|C-|D\+|D-|A|B|C|D|E)\s*\(?PLAIN\)?/i;

function resolveToken(token) {
  const t = token.trim().toUpperCase();
  if (!t) return [];
  if (/GROUP/.test(t)) return null; // unresolved group reference
  const parts = t.split(/[\/,]/).map(p => p.trim()).filter(Boolean);
  const resolved = [];
  for (const p of parts) {
    if (KNOWN_SUBJECT_ALIASES[p]) {
      resolved.push(...KNOWN_SUBJECT_ALIASES[p]);
    } else if (/^[A-Z ]+$/.test(p) && p.length > 2 && !/ALTERNATIVE/.test(p)) {
      resolved.push(p); // assume it's already a full subject name
    }
  }
  return resolved.length ? resolved : null;
}

function parseSubjectHeader(subjectHeaderRaw) {
  if (!subjectHeaderRaw) return { slots: [], unresolvedGroupReferences: [] };
  // Header cells look like: "Subject 1\nENG/KIS | Subject 2\n... | Subject 3\n... | Subject 4\n..."
  const cells = subjectHeaderRaw.split('|').map(c => c.trim());
  const slots = [];
  const unresolvedGroupReferences = [];

  cells.forEach((cell, idx) => {
    const withoutLabel = cell.replace(/Subject\s*\d+/i, '').replace(/\n/g, ' ').trim();
    if (!withoutLabel) return;
    // Split on " or " / "/" boundaries that separate real alternatives
    const resolved = resolveToken(withoutLabel);
    if (resolved) {
      slots.push({ slot: idx + 1, raw: withoutLabel, resolvedSubjects: resolved, resolved: true });
    } else {
      slots.push({ slot: idx + 1, raw: withoutLabel, resolvedSubjects: [], resolved: false });
      unresolvedGroupReferences.push(withoutLabel);
    }
  });

  return { slots, unresolvedGroupReferences };
}

function parseMinimumGrades(minimumGradesRaw) {
  if (!minimumGradesRaw) return { subjectMinimums: [], minimumMeanGrade: null };
  const subjectMinimums = [];
  // Pattern like "ENG/KIS - C+" or "MAT ALTERNATIVE A - C (PLAIN)"
  const segments = minimumGradesRaw.split(/(?=[A-Z][A-Z /]*\s*-)/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const match = seg.match(/^(.*?)-\s*(A-|B\+|B-|C\+|C-|D\+|D-|A|B|C|D|E)\s*\(?PLAIN\)?/i);
    if (match) {
      const subjectPart = match[1].trim();
      const grade = match[2].toUpperCase();
      const resolved = resolveToken(subjectPart);
      subjectMinimums.push({
        raw: subjectPart,
        resolvedSubjects: resolved || [],
        resolved: !!resolved,
        minimumGrade: grade
      });
    }
  }
  return { subjectMinimums, minimumMeanGrade: null };
}

function parseClusterEntry(entry) {
  const { slots, unresolvedGroupReferences } = parseSubjectHeader(entry.subjectHeaderRaw);
  const { subjectMinimums } = parseMinimumGrades(entry.minimumGradesRaw);
  return {
    cluster: entry.cluster,
    subCluster: entry.subCluster,
    subjectSlots: slots,
    subjectMinimums,
    unresolvedGroupReferences,
    programmes: entry.programmes || []
  };
}

module.exports = { parseClusterEntry, parseSubjectHeader, parseMinimumGrades, resolveToken };
