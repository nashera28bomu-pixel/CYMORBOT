const { gradeToPoints } = require('./gradePoints');

/**
 * S = 48 * sqrt((r/48) * (t/84))
 *
 * r = sum of points of the four required cluster subjects
 * t = total KCSE aggregate points for the best seven subjects
 *
 * NOTE: applied exactly as specified. For r=42, t=70 this yields
 * ≈40.988, not the ≈42.54 mentioned as an illustrative figure in the
 * original build brief — that figure does not arithmetically follow
 * from the formula given alongside it. See backend/tests/clusterScore.test.js
 * and README.md for details; this implementation intentionally follows
 * the formula rather than the inconsistent example.
 *
 * @param {number} r
 * @param {number} t
 * @returns {number} S, un-rounded (retain precision for internal comparisons)
 */
function computeWeightedClusterScore(r, t) {
  if (r < 0 || r > 48) throw new Error('r must be between 0 and 48');
  if (t < 0 || t > 84) throw new Error('t must be between 0 and 84');
  const score = 48 * Math.sqrt((r / 48) * (t / 84));
  return score;
}

/**
 * Given the student's full graded subject list and an ordered list of the
 * four cluster subject "slots" (each slot may itself be one subject, or an
 * array of acceptable alternative subjects e.g. ["MATHEMATICS"] or
 * ["ENGLISH","KISWAHILI"]), pick the student's best-scoring subject for
 * each slot and sum their points to get r.
 *
 * If a slot cannot be satisfied by anything the student sat, that slot
 * contributes 0 points (the caller should already have failed the
 * eligibility check in that case).
 */
function computeR(studentSubjects, clusterSubjectSlots) {
  const pointsBySubject = {};
  for (const s of studentSubjects) {
    const key = String(s.subject).trim().toUpperCase();
    const pts = gradeToPoints(s.grade);
    if (!(key in pointsBySubject) || pts > pointsBySubject[key]) {
      pointsBySubject[key] = pts;
    }
  }

  let r = 0;
  for (const slot of clusterSubjectSlots) {
    const alternatives = Array.isArray(slot) ? slot : [slot];
    let best = 0;
    for (const alt of alternatives) {
      const key = String(alt).trim().toUpperCase();
      if (key in pointsBySubject && pointsBySubject[key] > best) {
        best = pointsBySubject[key];
      }
    }
    r += best;
  }
  return Math.min(r, 48);
}

function roundForDisplay(score, decimals = 3) {
  const factor = Math.pow(10, decimals);
  return Math.round(score * factor) / factor;
}

module.exports = { computeWeightedClusterScore, computeR, roundForDisplay };
