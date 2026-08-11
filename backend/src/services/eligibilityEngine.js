const { computeSevenSubjectAggregate } = require('../utils/aggregate');
const { roundForDisplay } = require('../utils/clusterScore');
const { evaluateProgrammeRequirements } = require('./requirementEvaluator');
const { computeClusterScoreForProgramme } = require('./clusterScoreCalculator');

/**
 * Runs the full pipeline for a single programme, in the exact order the
 * project's qualification rules require:
 *   1. Check minimum subject requirements (requirementEvaluator.js).
 *      If they fail or can't be confirmed -> NOT qualified. Stop here;
 *      never compute a cluster score for a programme that hasn't passed
 *      its minimum requirements.
 *   2. Compute the programme-specific weighted cluster score
 *      (clusterScoreCalculator.js). If the programme's cluster subjects
 *      can't be resolved from the dataset -> NOT qualified (no fallback
 *      score is ever substituted).
 *   3. Compare the learner's score against the programme's latest
 *      cutoff. Only score >= cutoff counts as qualified.
 */
function evaluateProgramme(studentSubjects, aggregate, programme) {
  const reqResult = evaluateProgrammeRequirements(programme, studentSubjects);
  if (!reqResult.qualified) {
    return {
      qualifies: false,
      reason: reqResult.requirementsFailed.length ? 'MINIMUM_REQUIREMENTS_NOT_MET' : 'REQUIREMENTS_UNRESOLVED',
      details: reqResult
    };
  }

  const clusterResult = computeClusterScoreForProgramme(programme, reqResult.resolvedSubjects, studentSubjects, aggregate);
  if (!clusterResult.resolved) {
    return {
      qualifies: false,
      reason: 'CLUSTER_SCORE_UNRESOLVED',
      details: { ...clusterResult, requirementCheck: reqResult }
    };
  }

  const latestCutoff = programme.latestCutoff ? programme.latestCutoff.score : null;
  if (latestCutoff === null || latestCutoff === undefined) {
    return {
      qualifies: false,
      reason: 'NO_CUTOFF_DATA',
      details: { learnerScore: roundForDisplay(clusterResult.score), requirementCheck: reqResult }
    };
  }

  const margin = clusterResult.score - latestCutoff;
  const qualifies = clusterResult.score >= latestCutoff;

  return {
    qualifies,
    reason: qualifies ? 'QUALIFIED' : 'BELOW_CUTOFF',
    details: {
      r: clusterResult.r,
      t: clusterResult.t,
      learnerScore: clusterResult.score,
      subjectsUsed: clusterResult.subjectsUsed,
      scoreSource: clusterResult.scoreSource,
      latestCutoff,
      latestCutoffYear: programme.latestCutoff.year,
      margin,
      requirementCheck: reqResult
    }
  };
}

/**
 * Full pipeline: given student subjects and the active dataset's
 * programme list, return only genuinely qualified programmes.
 *
 * Sort order (per project requirement): highest latest cutoff first —
 * the report should lead with the most competitive qualified
 * programmes, not the biggest margin. Ties broken by learner score,
 * then margin, then name, for a fully deterministic order.
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
        margin: roundForDisplay(evalResult.details.margin)
      });
    }
  }

  results.sort((a, b) => {
    if (b.latestCutoff !== a.latestCutoff) return b.latestCutoff - a.latestCutoff;
    if (b.learnerScore !== a.learnerScore) return b.learnerScore - a.learnerScore;
    if (b.margin !== a.margin) return b.margin - a.margin;
    const nameCmp = a.programmeName.localeCompare(b.programmeName);
    if (nameCmp !== 0) return nameCmp;
    return a.institutionName.localeCompare(b.institutionName);
  });

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

module.exports = { evaluateProgramme, runEligibilityPipeline };
