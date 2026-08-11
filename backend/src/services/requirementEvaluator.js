const { gradeToPoints } = require('../utils/gradePoints');
const { isGroupPopulated, subjectsInGroup } = require('../data/subjectGroups');

/**
 * Evaluates a programme's minimum subject-grade requirements against a
 * learner's actual subjects. This is deliberately separate from the
 * weighted cluster score calculation (clusterScoreCalculator.js) — a
 * programme can satisfy its minimum requirements and still fail on
 * cutoff, and the two checks use different pieces of the source data.
 *
 * Requirement segment shapes handled (see clusterRequirementParser.js):
 *   { type:'subjects', resolvedSubjects:[...], minimumGrade }
 *     -> OR across resolvedSubjects: best of the learner's matching
 *        subjects must meet minimumGrade.
 *   { type:'group', groupReference:{groupName, ordinal}, minimumGrade }
 *     -> requires a learner subject belonging to the named KUCCPS
 *        subject group. Only resolvable once subjectGroups.js has been
 *        populated with the official group legend; until then this is
 *        reported as UNRESOLVED, never silently satisfied.
 *   { type:'unparseable' }
 *     -> the source text for this segment couldn't be parsed at all;
 *        reported as UNRESOLVED for the same reason.
 *
 * Returns a structured result — never throws for data-quality issues,
 * so the caller can keep processing the rest of the dataset.
 */
function evaluateProgrammeRequirements(programme, learnerSubjects) {
  const requirement = programme && programme.requirement;
  const requirementsMet = [];
  const requirementsFailed = [];
  const requirementsUnresolved = [];
  const resolvedSubjectsUsed = [];

  if (!requirement || !Array.isArray(requirement.subjectMinimums) || requirement.subjectMinimums.length === 0) {
    // No requirement data at all for this programme (e.g. its cluster
    // block couldn't be matched during import). Per the project's rule
    // that unknown requirements must never silently pass, this is
    // reported as unresolved rather than treated as "no requirements".
    return {
      qualified: false,
      requirementsMet,
      requirementsFailed,
      requirementsUnresolved: [{ raw: 'No requirement data available for this programme.', reason: 'NO_REQUIREMENT_DATA' }],
      resolvedSubjects: resolvedSubjectsUsed,
      explanation: ['This programme has no matched minimum-requirement data in the active dataset, so qualification cannot be confirmed.']
    };
  }

  const pointsBySubject = {};
  for (const s of learnerSubjects) {
    const key = String(s.subject).trim().toUpperCase();
    const pts = gradeToPoints(s.grade);
    if (!(key in pointsBySubject) || pts > pointsBySubject[key]) pointsBySubject[key] = pts;
  }

  for (const req of requirement.subjectMinimums) {
    if (req.type === 'subjects' && req.resolved) {
      const requiredPoints = req.minimumGrade ? gradeToPoints(req.minimumGrade) : 1;
      let bestSubject = null;
      let bestPoints = -1;
      for (const subj of req.resolvedSubjects) {
        const pts = pointsBySubject[subj];
        if (pts !== undefined && pts > bestPoints) { bestPoints = pts; bestSubject = subj; }
      }
      if (bestSubject !== null && bestPoints >= requiredPoints) {
        requirementsMet.push({ raw: req.raw, satisfiedBy: bestSubject, achievedGrade: bestPoints, requiredGrade: req.minimumGrade });
        resolvedSubjectsUsed.push(bestSubject);
      } else {
        requirementsFailed.push({
          raw: req.raw,
          options: req.resolvedSubjects,
          requiredGrade: req.minimumGrade,
          reason: bestSubject === null ? 'SUBJECT_NOT_TAKEN' : 'GRADE_BELOW_MINIMUM'
        });
      }
      continue;
    }

    if (req.type === 'group' && req.groupReference) {
      const { groupName } = req.groupReference;
      if (!isGroupPopulated(groupName)) {
        requirementsUnresolved.push({ raw: req.raw, groupName, reason: 'SUBJECT_GROUP_NOT_CONFIGURED' });
        continue;
      }
      const groupSubjects = subjectsInGroup(groupName);
      const requiredPoints = req.minimumGrade ? gradeToPoints(req.minimumGrade) : 1;
      let bestSubject = null;
      let bestPoints = -1;
      for (const subj of groupSubjects) {
        const pts = pointsBySubject[subj];
        if (pts !== undefined && pts > bestPoints) { bestPoints = pts; bestSubject = subj; }
      }
      if (bestSubject !== null && bestPoints >= requiredPoints) {
        requirementsMet.push({ raw: req.raw, satisfiedBy: bestSubject, achievedGrade: bestPoints, requiredGrade: req.minimumGrade });
        resolvedSubjectsUsed.push(bestSubject);
      } else {
        requirementsFailed.push({ raw: req.raw, groupName, requiredGrade: req.minimumGrade, reason: 'NO_MATCHING_GROUP_SUBJECT' });
      }
      continue;
    }

    // type === 'unparseable', or a group segment with no parseable group name
    requirementsUnresolved.push({ raw: req.raw, reason: 'UNPARSEABLE_REQUIREMENT' });
  }

  // Per the project's rule ("never silently treat an unknown requirement
  // as satisfied"), any unresolved segment blocks confirmed qualification
  // even if every resolvable segment passed — we simply cannot prove the
  // full requirement set is met.
  const qualified = requirementsFailed.length === 0 && requirementsUnresolved.length === 0;

  const explanation = [];
  if (requirementsFailed.length) {
    explanation.push(`Does not meet ${requirementsFailed.length} minimum subject requirement(s).`);
  }
  if (requirementsUnresolved.length) {
    explanation.push(`${requirementsUnresolved.length} requirement(s) reference data not yet available in this dataset (e.g. a KUCCPS subject group not yet configured), so qualification cannot be confirmed.`);
  }
  if (qualified) {
    explanation.push('All minimum subject requirements are met.');
  }

  return { qualified, requirementsMet, requirementsFailed, requirementsUnresolved, resolvedSubjects: resolvedSubjectsUsed, explanation };
}

module.exports = { evaluateProgrammeRequirements };
