const { normalizeProgrammeName } = require('../utils/normalize');
const { parseClusterEntry } = require('../parsers/clusterRequirementParser');

/**
 * Builds a lookup: normalized programme name -> parsed requirement.
 * The cluster document lists programme names in two free-flowing columns
 * per requirement bucket; some names differ slightly in punctuation from
 * the cutoffs document, so lookup is done on a normalized name.
 */
function buildRequirementIndex(clustersRaw) {
  const index = new Map();
  const parsedClusters = clustersRaw.clusters.map(parseClusterEntry);

  for (const cluster of parsedClusters) {
    for (const progName of cluster.programmes) {
      const key = normalizeProgrammeName(progName);
      if (!key) continue;
      // First match wins; later duplicate mappings are recorded as warnings.
      if (!index.has(key)) {
        index.set(key, cluster);
      }
    }
  }
  return { index, parsedClusters };
}

/**
 * Combines the cutoffs dataset with the requirements index into the final
 * Programme record shape used by the eligibility engine and persisted to
 * MongoDB. Programmes whose requirements could not be matched are still
 * included (so the admin can see them and the cutoff data is preserved)
 * but flagged `requirementMatched: false` — the eligibility engine
 * treats those as unable-to-confirm-qualification, never as
 * auto-qualified.
 */
function buildDataset(cutoffsRaw, clustersRaw) {
  const { index } = buildRequirementIndex(clustersRaw);
  const validationWarnings = [];
  const validationErrors = [];

  const seenCodes = new Set();
  const programmes = [];

  let matchedCount = 0;
  let clusterScoreResolvableCount = 0;
  let unresolvedMinimumSegmentCount = 0;

  for (const rec of cutoffsRaw.records) {
    if (!rec.programmeCode || !rec.institutionName || !rec.programmeName) {
      validationErrors.push(`Missing required field on record: ${JSON.stringify(rec)}`);
      continue;
    }
    if (seenCodes.has(rec.programmeCode)) {
      validationWarnings.push(`Programme code ${rec.programmeCode} appears multiple times.`);
    }
    seenCodes.add(rec.programmeCode);

    const key = normalizeProgrammeName(rec.programmeName);
    const requirement = index.get(key) || null;

    if (!requirement) {
      validationWarnings.push(`No cluster/subject requirement match found for programme code ${rec.programmeCode} (${rec.programmeName}).`);
    } else {
      matchedCount += 1;
      if (requirement.clusterSubjectSlotsResolved) clusterScoreResolvableCount += 1;
      if (requirement.unresolvedMinimumSegments && requirement.unresolvedMinimumSegments.length) {
        unresolvedMinimumSegmentCount += requirement.unresolvedMinimumSegments.length;
        validationWarnings.push(`Programme ${rec.programmeCode}: ${requirement.unresolvedMinimumSegments.length} minimum-requirement segment(s) could not be fully resolved (${requirement.unresolvedMinimumSegments.join('; ')}).`);
      }
    }
    if (!rec.latestCutoff) {
      validationWarnings.push(`No recent cutoff found for programme ${rec.programmeCode}.`);
    }

    programmes.push({
      programmeCode: rec.programmeCode,
      programmeName: rec.programmeName,
      institutionName: rec.institutionName,
      category: rec.category,
      cutoffHistory: rec.cutoffHistory,
      latestCutoff: rec.latestCutoff,
      requirement: requirement ? {
        cluster: requirement.cluster,
        subCluster: requirement.subCluster,
        clusterSubjectSlots: requirement.clusterSubjectSlots,
        clusterSubjectSlotsResolved: requirement.clusterSubjectSlotsResolved,
        subjectMinimums: requirement.subjectMinimums,
        unresolvedGroupReferences: requirement.unresolvedGroupReferences,
        unresolvedMinimumSegments: requirement.unresolvedMinimumSegments
      } : null,
      requirementMatched: !!requirement,
      sourceReferences: {
        cutoffsSourcePage: rec.sourcePage
      }
    });
  }

  if (matchedCount > 0 && clusterScoreResolvableCount === 0) {
    validationWarnings.push(
      'DATA GAP: none of the matched programme requirements resolve a full 4-subject weighted-cluster definition. ' +
      'This means the weighted cluster score (and therefore full qualification) cannot currently be computed for any programme. ' +
      'The source requirements document defines minimum subject grades thoroughly, but does not itself enumerate the ' +
      'official KUCCPS per-cluster 4-subject weighting formula. Supply that reference (or the Group I-V legend, via ' +
      'src/data/subjectGroups.js) to unlock scoring — see README.'
    );
  }

  return {
    importedProgrammeCount: programmes.length,
    recordsWithCutoffData: programmes.filter(p => p.latestCutoff).length,
    recordsWithMatchedRequirement: matchedCount,
    recordsWithResolvableClusterScore: clusterScoreResolvableCount,
    recordsRequiringReview: validationWarnings.length,
    validationWarnings,
    validationErrors,
    programmes
  };
}

module.exports = { buildDataset, buildRequirementIndex };
