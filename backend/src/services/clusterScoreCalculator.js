const { computeWeightedClusterScore } = require('../utils/clusterScore');
const { gradeToPoints } = require('../utils/gradePoints');
const { isGroupPopulated, subjectsInGroup } = require('../data/subjectGroups');

const TARGET_CLUSTER_SLOTS = 4;

/**
 * Computes a PROGRAMME-SPECIFIC weighted cluster score.
 *
 * THIS IS THE CORE FIX for the "every programme shows the same score"
 * bug: the previous implementation fell back to the learner's own best
 * 4 subjects whenever a programme's real 4 cluster subjects weren't
 * resolved from the source data — which is constant per learner, so
 * every unresolved programme got an identical, fabricated score.
 *
 * r-SOURCE POLICY (set explicitly by the product owner):
 * The source document does not enumerate an official KUCCPS per-cluster
 * 4-subject weighting formula (see clusterRequirementParser.js header
 * note), but it DOES thoroughly enumerate each programme's minimum
 * subject-grade requirements — resolved per-programme, directly from
 * the source data. So `r` is derived from the subjects that actually
 * satisfied this programme's minimum requirements (real subjects the
 * learner sat, with real grades — never invented), passed in as
 * `resolvedRequirementSubjects` by the caller (eligibilityEngine.js),
 * which obtains them from requirementEvaluator.js AFTER confirming the
 * learner passed those requirements. If a programme specifies fewer
 * than 4 explicit requirement subjects, the remaining slots are filled
 * with the learner's own best-performing remaining subjects (excluding
 * ones already used) — the same "mandatory subjects + best of the
 * rest" pattern already used for the 7-subject aggregate, so it's
 * consistent methodology rather than an arbitrary rule. This is
 * disclosed on every result via `scoreSource`.
 *
 * If the source data later gains an authoritative 4-subject weighting
 * definition for a cluster (`programme.requirement.clusterSubjectSlots`,
 * fully resolved), that takes priority automatically — no other code
 * needs to change.
 *
 * @param {object} programme
 * @param {string[]} resolvedRequirementSubjects - subjects (in
 *   requirement order) that satisfied this programme's minimum
 *   requirements, as returned by requirementEvaluator.js.
 * @param {Array<{subject:string, grade:string}>} learnerSubjects
 * @param {{totalPoints:number}} aggregate - the learner's 7-subject aggregate (t)
 * @returns {{resolved:boolean, r?:number, t?:number, score?:number,
 *   subjectsUsed?:string[], scoreSource?:string, reason?:string}}
 */
function computeClusterScoreForProgramme(programme, resolvedRequirementSubjects, learnerSubjects, aggregate) {
  const pointsBySubject = {};
  for (const s of learnerSubjects) {
    const key = String(s.subject).trim().toUpperCase();
    const pts = gradeToPoints(s.grade);
    if (!(key in pointsBySubject) || pts > pointsBySubject[key]) pointsBySubject[key] = pts;
  }

  // Preferred path: an authoritative, fully-resolved 4-subject weighted
  // cluster definition from the source data (rare today, but this stays
  // future-proof — see file header).
  const officialSlots = programme && programme.requirement && programme.requirement.clusterSubjectSlots;
  if (Array.isArray(officialSlots) && officialSlots.length === TARGET_CLUSTER_SLOTS) {
    const resolvedAlternatives = [];
    for (const slot of officialSlots) {
      if (slot.resolved && slot.resolvedSubjects && slot.resolvedSubjects.length) {
        resolvedAlternatives.push(slot.resolvedSubjects);
      } else if (slot.groupReference && isGroupPopulated(slot.groupReference.groupName)) {
        resolvedAlternatives.push(subjectsInGroup(slot.groupReference.groupName));
      } else {
        resolvedAlternatives.length = 0;
        break;
      }
    }
    if (resolvedAlternatives.length === TARGET_CLUSTER_SLOTS) {
      const subjectsUsed = [];
      let ok = true;
      for (const alternatives of resolvedAlternatives) {
        const taken = alternatives.filter(s => s in pointsBySubject);
        if (!taken.length) { ok = false; break; }
        subjectsUsed.push(taken.reduce((a, b) => (pointsBySubject[b] > pointsBySubject[a] ? b : a)));
      }
      if (ok) {
        const r = subjectsUsed.reduce((sum, s) => sum + pointsBySubject[s], 0);
        const t = aggregate.totalPoints;
        return { resolved: true, r, t, score: computeWeightedClusterScore(r, t), subjectsUsed, scoreSource: 'official-cluster-definition' };
      }
    }
  }

  // Standard path: derive the 4 cluster subjects from this programme's
  // resolved minimum subject requirements, filling any remaining slots
  // with the learner's own best-performing other subjects.
  if (!Array.isArray(resolvedRequirementSubjects) || resolvedRequirementSubjects.length === 0) {
    return { resolved: false, reason: 'NO_REQUIREMENT_SUBJECTS_TO_SCORE_FROM' };
  }

  // De-dupe while preserving order — a subject satisfying two separate
  // requirement segments should only occupy one slot.
  const explicitSubjects = [];
  for (const subj of resolvedRequirementSubjects) {
    if (!explicitSubjects.includes(subj)) explicitSubjects.push(subj);
  }

  let clusterSubjects = explicitSubjects.slice(0, TARGET_CLUSTER_SLOTS);
  const scoreSource = explicitSubjects.length >= TARGET_CLUSTER_SLOTS
    ? 'minimum-requirement-subjects'
    : 'minimum-requirement-subjects+best-of-remaining';

  if (clusterSubjects.length < TARGET_CLUSTER_SLOTS) {
    const remaining = Object.keys(pointsBySubject)
      .filter(s => !clusterSubjects.includes(s))
      .sort((a, b) => pointsBySubject[b] - pointsBySubject[a]);
    const need = TARGET_CLUSTER_SLOTS - clusterSubjects.length;
    clusterSubjects = clusterSubjects.concat(remaining.slice(0, need));
  }

  if (clusterSubjects.length === 0) {
    return { resolved: false, reason: 'NO_SUBJECTS_AVAILABLE' };
  }

  const r = clusterSubjects.reduce((sum, s) => sum + (pointsBySubject[s] || 0), 0);
  const t = aggregate.totalPoints;
  const score = computeWeightedClusterScore(r, t);

  return { resolved: true, r, t, score, subjectsUsed: clusterSubjects, scoreSource };
}

module.exports = { computeClusterScoreForProgramme };
