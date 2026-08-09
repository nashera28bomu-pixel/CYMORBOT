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
 * included (so cutoff comparison can still work) but flagged
 * `requirementMatched: false` for the admin import-preview screen.
 */
function buildDataset(cutoffsRaw, clustersRaw) {
  const { index } = buildRequirementIndex(clustersRaw);
  const validationWarnings = [];
  const validationErrors = [];

  const seenCodes = new Set();
  const programmes = [];

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
        subjectSlots: requirement.subjectSlots,
        subjectMinimums: requirement.subjectMinimums,
        unresolvedGroupReferences: requirement.unresolvedGroupReferences
      } : null,
      requirementMatched: !!requirement,
      sourceReferences: {
        cutoffsSourcePage: rec.sourcePage
      }
    });
  }

  return {
    importedProgrammeCount: programmes.length,
    recordsWithCutoffData: programmes.filter(p => p.latestCutoff).length,
    recordsRequiringReview: validationWarnings.length,
    validationWarnings,
    validationErrors,
    programmes
  };
}

module.exports = { buildDataset, buildRequirementIndex };
