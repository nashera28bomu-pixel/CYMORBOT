const { computeSevenSubjectAggregate } = require('../utils/aggregate');
const { computeWeightedClusterScore, computeR, roundForDisplay } = require('../utils/clusterScore');
const { gradeToPoints } = require('../utils/gradePoints');

/**
 * Checks whether the student satisfies a programme's minimum subject
 * requirements (as far as they were resolvable from the source document).
 * Unresolved requirement slots are skipped (never silently invented) and
 * recorded so the result can be explained transparently.
 */
function checkMinimumRequirements(studentSubjects, requirement) {
  const pointsBySubject = {};
  for (const s of studentSubjects) {
    const key = String(s.subject).trim().toUpperCase();
    pointsBySubject[key] = Math.max(pointsBySubject[key] || 0, gradeToPoints(s.grade));
  }

  const failures = [];
  const skipped = [];

  for (const min of (requirement.subjectMinimums || [])) {
    if (!min.resolved || min.resolvedSubjects.length === 0) {
      skipped.push(min.raw);
      continue;
    }
    const bestPoints = Math.max(
      0,
      ...min.resolvedSubjects.map(s => pointsBySubject[s] || 0)
    );
    const requiredPoints = gradeToPoints(min.minimumGrade);
    if (bestPoints < requiredPoints) {
      failures.push({ subject: min.raw, required: min.minimumGrade, achievedPoints: bestPoints });
    }
  }

  return { passed: failures.length === 0, failures, skippedRequirements: skipped };
}

/**
 * Runs the full pipeline for a single programme against a student's
 * profile (which already has the 7-subject aggregate computed).
 */
function evaluateProgramme(studentSubjects, aggregate, programme) {
  const requirement = programme.requirement || { subjectSlots: [], subjectMinimums: [] };

  const reqCheck = checkMinimumRequirements(studentSubjects, requirement);
  if (!reqCheck.passed) {
    return { qualifies: false, reason: 'MINIMUM_REQUIREMENTS_NOT_MET', details: reqCheck };
  }

  const resolvedSlots = requirement.subjectSlots
    .filter(s => s.resolved)
    .map(s => s.resolvedSubjects);

  // Fall back to the student's best 4 subjects if the programme's cluster
  // subjects could not be resolved from the source document, and clearly
  // flag the result as approximate.
  let r;
  let approximate = false;
  if (resolvedSlots.length === 4) {
    r = computeR(studentSubjects, resolvedSlots);
  } else {
    approximate = true;
    const sorted = [...studentSubjects]
      .map(s => ({ subject: s.subject, points: gradeToPoints(s.grade) }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 4);
    r = sorted.reduce((sum, s) => sum + s.points, 0);
  }

  const t = aggregate.totalPoints;
  const learnerScore = computeWeightedClusterScore(r, t);

  const latestCutoff = programme.latestCutoff ? programme.latestCutoff.score : null;
  if (latestCutoff === null) {
    return {
      qualifies: false,
      reason: 'NO_CUTOFF_DATA',
      details: { learnerScore: roundForDisplay(learnerScore), approximate }
    };
  }

  const margin = learnerScore - latestCutoff;
  const qualifies = learnerScore >= latestCutoff;

  return {
    qualifies,
    reason: qualifies ? 'QUALIFIED' : 'BELOW_CUTOFF',
    details: {
      r,
      t,
      learnerScore,
      latestCutoff,
      latestCutoffYear: programme.latestCutoff.year,
      margin,
      approximate,
      skippedRequirements: reqCheck.skippedRequirements
    }
  };
}

/**
 * Full pipeline: given student subjects and the active dataset's
 * programme list, return only the qualifying programmes, ranked by
 * strongest positive margin, capped at `limit`.
 */
function runEligibilityPipeline(studentSubjects, programmes, { limit = 100 } = {}) {
  const aggregate = computeSevenSubjectAggregate(studentSubjects);

  const results = [];
  for (const programme of programmes) {
    const evalResult = evaluateProgramme(studentSubjects, aggregate, programme);
    if (evalResult.qualifies) {
      results.push({
        programmeCode: programme.programmeCode,
        programmeName: programme.programmeName,
        institutionName: programme.institutionName,
        latestCutoff: evalResult.details.latestCutoff,
        latestCutoffYear: evalResult.details.latestCutoffYear,
        learnerScore: roundForDisplay(evalResult.details.learnerScore),
        margin: roundForDisplay(evalResult.details.margin),
        approximate: evalResult.details.approximate
      });
    }
  }

  results.sort((a, b) => b.margin - a.margin);
  const top = results.slice(0, limit).map((r, idx) => ({ rank: idx + 1, ...r }));

  return {
    aggregate: {
      selectedSubjects: aggregate.selectedSubjects,
      totalPoints: aggregate.totalPoints,
      meanPoints: roundForDisplay(aggregate.meanPoints, 3),
      meanGrade: aggregate.meanGrade
    },
    qualifyingCount: results.length,
    results: top
  };
}

module.exports = { checkMinimumRequirements, evaluateProgramme, runEligibilityPipeline };
