/**
 * Parses the raw text captured from DEGREE_CLUSTER_DOCUMENT into a
 * structured requirement object.
 *
 * ROOT-CAUSE FIX (see project history): the original version of this
 * parser assumed the FIRST raw text block captured after a sub-cluster
 * tag was always a "Subject 1 / Subject 2 / Subject 3 / Subject 4"
 * weighted-cluster header. That assumption only held for one of the 46
 * sub-cluster blocks in the actual source PDF (1A — Bachelor of Laws).
 * For the other 45, the captured text is actually a MINIMUM SUBJECT
 * GRADE requirement list (e.g. "MAT ALTERNATIVE A - C+ | PHY - C+ | GEO
 * - C (PLAIN)"), which the old parser incorrectly tried to read as a
 * 4-subject weighting definition, failed, and mislabeled as unresolved
 * "group references" — which is why virtually every programme silently
 * fell back to a fabricated, learner-only cluster score.
 *
 * This version classifies each raw text block by its CONTENT instead of
 * its position:
 *   - Blocks containing literal "Subject 1/2/3/4" labels are parsed as
 *     the weighted-cluster 4-subject definition (`clusterSubjectSlots`)
 *     — used for the r/S weighted-score formula.
 *   - Everything else is parsed as one or more pipe-separated minimum
 *     subject-grade requirements (`subjectMinimums`) — used for the
 *     pass/fail minimum-requirement check, which is a DIFFERENT check
 *     from the weighted cluster score (see requirementEvaluator.js and
 *     clusterScoreCalculator.js).
 *
 * HONESTY NOTE (still true, now scoped correctly): the source document
 * enumerates minimum subject-grade requirements thoroughly, but only
 * one sub-cluster block in the extracted text contains an explicit
 * 4-subject weighted-cluster definition. KUCCPS's per-cluster weighting
 * formula (which 4 subjects feed `r` for clusters 2-20) is normally
 * published as a separate "cluster weighting subjects" reference table
 * and is NOT present in this PDF's extracted text. This parser does not
 * invent that mapping — clusterSubjectSlots is left unresolved for any
 * programme where the source data doesn't define it, and
 * clusterScoreCalculator.js refuses to compute a score in that case
 * rather than substituting anything. See README for how to supply the
 * missing reference once available.
 *
 * Group references ("ANY GROUP II", "2nd GROUP III", etc.) are captured
 * structurally (group name + ordinal) rather than dropped, so that once
 * subjectGroups.js is populated with the official KUCCPS Group I-V
 * legend, they resolve automatically with no parser changes needed.
 */

const KNOWN_SUBJECT_ALIASES = {
  'ENG': ['ENGLISH'],
  'KIS': ['KISWAHILI'],
  'KSL': ['KENYA SIGN LANGUAGE'],
  'MAT ALTERNATIVE A': ['MATHEMATICS'],
  'MAT ALTERNATIVE B': ['MATHEMATICS'],
  'MATHEMATICS ALTERNATIVE A': ['MATHEMATICS'],
  'MATHEMATICS ALTERNATIVE B': ['MATHEMATICS'],
  'PHY': ['PHYSICS'],
  'CHE': ['CHEMISTRY'],
  'BIO': ['BIOLOGY'],
  'BSC': ['BIOLOGICAL SCIENCES'],
  'GSC': ['GENERAL SCIENCE'],
  'GEO': ['GEOGRAPHY'],
  'HAG': ['HISTORY AND GOVERNMENT'],
  'CRE': ['CHRISTIAN RELIGIOUS EDUCATION'],
  'IRE': ['ISLAMIC RELIGIOUS EDUCATION'],
  'HRE': ['HINDU RELIGIOUS EDUCATION'],
  'FRE': ['FRENCH'],
  'FRENCH': ['FRENCH'],
  'GER': ['GERMAN'],
  'GERMAN': ['GERMAN'],
  'MUS': ['MUSIC'],
  'MUSIC': ['MUSIC'],
  'ARD': ['ART AND DESIGN'],
  'COMP': ['COMPUTER STUDIES'],
  'AGR': ['AGRICULTURE'],
  'AGRIC': ['AGRICULTURE'],
  'BST': ['BUSINESS STUDIES'],
  'HSC': ['HOME SCIENCE'],
  'SSE': ['SOCIAL EDUCATION AND ETHICS'],
  'CMP': ['COMPUTER STUDIES'],
  'PSC': ['PHYSICAL SCIENCES']
};

const GRADE_ALTERNATION = '(?:A-|B\\+|B-|C\\+|C-|D\\+|D-|A|B|C|D|E)';

/**
 * Expands shorthand like "MAT ALTERNATIVE A/B" into
 * "MAT ALTERNATIVE A/MAT ALTERNATIVE B" so downstream slash-splitting
 * resolves every alternative correctly instead of leaving a dangling
 * lone letter.
 */
function expandAlternativeShorthand(text) {
  return text.replace(
    /\b((?:MAT(?:HEMATICS)?)\s+ALTERNATIVE)\s+([A-Z])((?:\s*\/\s*[A-Z])+)\b/gi,
    (match, prefix, firstLetter, rest) => {
      const letters = [firstLetter, ...rest.split('/').map(s => s.trim()).filter(Boolean)];
      return letters.map(l => `${prefix} ${l}`).join('/');
    }
  );
}

/** Normalizes dashes, collapses whitespace, tightens "C +" -> "C+" etc. */
function normalizeText(text) {
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b([ABCD])\s+([+-])/g, '$1$2') // "C +" -> "C+"
    .trim();
}

function isGroupReference(token) {
  return /GROUP\s*[IVX]+/i.test(token);
}

/**
 * Parses a group-reference token like "ANY GROUP IV", "2nd GROUP III",
 * "GROUP II" into a structured { groupName, ordinal } descriptor.
 */
function parseGroupReference(token) {
  const t = token.trim().toUpperCase();
  const match = t.match(/(?:(\d+)(?:ST|ND|RD|TH)\s+)?(?:ANY\s+)?GROUP\s*([IVX]+)/);
  if (!match) return null;
  const ordinal = match[1] ? parseInt(match[1], 10) : 1;
  const groupName = `GROUP ${match[2]}`;
  return { groupName, ordinal };
}

/**
 * Resolves a single subject expression (already free of its grade
 * suffix) into either literal subject names or a group reference.
 * Returns one of:
 *   { type: 'subjects', subjects: [...] }
 *   { type: 'group', groupName, ordinal }
 *   null  (genuinely unparseable — surfaced as a warning upstream)
 */
function resolveExpression(rawExpression) {
  const expanded = expandAlternativeShorthand(rawExpression.trim().toUpperCase());
  const alternatives = expanded.split('/').map(p => p.trim()).filter(Boolean);
  if (alternatives.length === 0) return null;

  // A whole expression is a single group reference (e.g. "ANY GROUP IV").
  if (alternatives.length === 1 && isGroupReference(alternatives[0])) {
    const parsed = parseGroupReference(alternatives[0]);
    return parsed ? { type: 'group', ...parsed } : null;
  }

  const subjects = [];
  for (const alt of alternatives) {
    if (isGroupReference(alt)) {
      // Mixed expressions like "GEO/2nd GROUP II" — either alternative
      // satisfying it would be enough, but we can't currently evaluate
      // the group half, so treat the whole expression as unresolved
      // rather than silently dropping that option.
      return { type: 'group', ...(parseGroupReference(alt) || { groupName: alt, ordinal: 1 }) };
    }
    if (KNOWN_SUBJECT_ALIASES[alt]) {
      subjects.push(...KNOWN_SUBJECT_ALIASES[alt]);
    } else if (/^[A-Z][A-Z ]*$/.test(alt) && alt.length > 1) {
      subjects.push(alt); // assume already a full subject name
    }
  }
  return subjects.length ? { type: 'subjects', subjects: [...new Set(subjects)] } : null;
}

/**
 * Splits a block of text into pipe-separated minimum-requirement
 * segments and parses each into a structured requirement descriptor.
 */
function parseMinimumRequirementBlock(text) {
  const normalized = normalizeText(text);
  if (!normalized) return { requirements: [], unresolved: [] };

  const segments = normalized.split('|').map(s => s.trim()).filter(Boolean);
  const requirements = [];
  const unresolved = [];

  const withGradeRe = new RegExp(`^(.*?)-\\s*(${GRADE_ALTERNATION}\\s*(?:\\(?\\s*(?:PLAIN|MINUS)\\s*\\)?)?)\\s*$`, 'i');
  const withoutDashRe = new RegExp(`^(.*?)\\s+(${GRADE_ALTERNATION})\\s*$`, 'i');

  for (const segment of segments) {
    const withGrade = segment.match(withGradeRe);
    const withoutDash = !withGrade && segment.match(withoutDashRe);

    if (withGrade || withoutDash) {
      const m = withGrade || withoutDash;
      const subjectExpr = m[1].trim();
      const gradeRaw = m[2].trim().toUpperCase().replace(/\s*\(.*?\)\s*/, '');
      const resolution = resolveExpression(subjectExpr);

      if (resolution && resolution.type === 'subjects') {
        requirements.push({
          raw: segment, type: 'subjects', resolved: true,
          resolvedSubjects: resolution.subjects, groupReference: null, minimumGrade: gradeRaw
        });
      } else if (resolution && resolution.type === 'group') {
        requirements.push({
          raw: segment, type: 'group', resolved: false,
          resolvedSubjects: [], groupReference: resolution, minimumGrade: gradeRaw
        });
        unresolved.push(segment);
      } else {
        requirements.push({
          raw: segment, type: 'unparseable', resolved: false,
          resolvedSubjects: [], groupReference: null, minimumGrade: gradeRaw
        });
        unresolved.push(segment);
      }
      continue;
    }

    // A bare group reference with no explicit grade attached, e.g. the
    // standalone "GROUP III" / "2nd GROUP V" segments seen in the source.
    if (isGroupReference(segment)) {
      requirements.push({
        raw: segment, type: 'group', resolved: false,
        resolvedSubjects: [], groupReference: parseGroupReference(segment), minimumGrade: null
      });
      unresolved.push(segment);
      continue;
    }

    requirements.push({
      raw: segment, type: 'unparseable', resolved: false,
      resolvedSubjects: [], groupReference: null, minimumGrade: null
    });
    unresolved.push(segment);
  }

  return { requirements, unresolved };
}

/**
 * Parses a literal "Subject 1 / Subject 2 / Subject 3 / Subject 4"
 * weighted-cluster header (currently only present for cluster 1A in the
 * source data) into the 4-slot definition used for the r/S formula.
 */
function parseClusterSubjectHeader(text) {
  const cells = text.split('|').map(c => c.trim());
  const slots = [];
  const unresolvedGroupReferences = [];

  cells.forEach((cell, idx) => {
    const withoutLabel = normalizeText(cell.replace(/Subject\s*\d+/i, ''));
    if (!withoutLabel) return;
    const resolution = resolveExpression(withoutLabel);
    if (resolution && resolution.type === 'subjects') {
      slots.push({ slot: idx + 1, raw: withoutLabel, resolvedSubjects: resolution.subjects, resolved: true, groupReference: null });
    } else if (resolution && resolution.type === 'group') {
      slots.push({ slot: idx + 1, raw: withoutLabel, resolvedSubjects: [], resolved: false, groupReference: resolution });
      unresolvedGroupReferences.push(withoutLabel);
    } else {
      slots.push({ slot: idx + 1, raw: withoutLabel, resolvedSubjects: [], resolved: false, groupReference: null });
      unresolvedGroupReferences.push(withoutLabel);
    }
  });

  return { slots, unresolvedGroupReferences };
}

function looksLikeClusterSubjectHeader(text) {
  return /Subject\s*\d/i.test(text);
}

/**
 * Classifies and parses the raw text captured for one sub-cluster block.
 * Looks at BOTH raw fields (whichever the extraction happened to
 * populate) and routes each by content, not by which field it landed in.
 */
function parseClusterEntry(entry) {
  const rawBlobs = [entry.subjectHeaderRaw, entry.minimumGradesRaw].filter(Boolean);

  let clusterSubjectSlots = [];
  let clusterUnresolvedGroupReferences = [];
  const subjectMinimums = [];
  const unresolvedMinimumSegments = [];

  for (const blob of rawBlobs) {
    if (looksLikeClusterSubjectHeader(blob)) {
      const { slots, unresolvedGroupReferences } = parseClusterSubjectHeader(blob);
      clusterSubjectSlots = clusterSubjectSlots.concat(slots);
      clusterUnresolvedGroupReferences = clusterUnresolvedGroupReferences.concat(unresolvedGroupReferences);
    } else {
      const { requirements, unresolved } = parseMinimumRequirementBlock(blob);
      subjectMinimums.push(...requirements);
      unresolvedMinimumSegments.push(...unresolved);
    }
  }

  return {
    cluster: entry.cluster,
    subCluster: entry.subCluster,
    // The literal 4-subject weighted-cluster definition, when the source
    // data actually contains one (rare — see file header note).
    clusterSubjectSlots,
    clusterSubjectSlotsResolved: clusterSubjectSlots.length === 4 && clusterSubjectSlots.every(s => s.resolved),
    unresolvedGroupReferences: clusterUnresolvedGroupReferences,
    // The minimum subject-grade requirements used for the pass/fail
    // eligibility check (this is the data the source document is
    // actually rich in).
    subjectMinimums,
    unresolvedMinimumSegments,
    programmes: entry.programmes || []
  };
}

module.exports = {
  parseClusterEntry,
  parseMinimumRequirementBlock,
  parseClusterSubjectHeader,
  resolveExpression,
  parseGroupReference,
  isGroupReference
};
