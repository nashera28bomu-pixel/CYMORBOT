/**
 * KUCCPS Subject Group Catalogue (Group I - Group V)
 *
 * STATUS: NOT YET POPULATED.
 *
 * The cluster/subject-requirements source PDF processed for this project
 * references these groups by name — "ANY GROUP II", "2nd GROUP III",
 * "ANY GROUP IV", etc. — but does not itself enumerate which named
 * subjects belong to each group anywhere in its extracted text.
 * Inventing that membership list would violate this project's core rule
 * (never invent unstated source data) and would be especially risky for
 * a paid product where a wrong group membership could wrongly qualify
 * or disqualify a real student.
 *
 * So the catalogue below intentionally ships empty. Every part of the
 * requirement engine that depends on it (requirementEvaluator.js,
 * clusterScoreCalculator.js) treats an empty/missing group as
 * "unresolved" — never as "any subject satisfies it" and never as
 * "automatically failed" in a way that's indistinguishable from a real
 * failure. Unresolved group requirements are recorded distinctly so an
 * admin can tell the difference between "the student doesn't qualify"
 * and "we don't have enough data to know yet."
 *
 * TO ACTIVATE GROUP-BASED REQUIREMENTS:
 * Populate GROUP_I..GROUP_V below with the official KUCCPS subject list
 * for each group (usually published as an appendix/legend alongside the
 * cluster document), using the exact subject names already used
 * elsewhere in this codebase (see the resolved subject names produced
 * by src/parsers/clusterRequirementParser.js, e.g. "MATHEMATICS",
 * "GEOGRAPHY", "HISTORY AND GOVERNMENT"). No other file needs to change
 * — requirementEvaluator.js and clusterScoreCalculator.js read directly
 * from this module, so filling it in immediately unlocks every
 * programme whose requirement referenced a group.
 */

const GROUP_I = [];   // e.g. Sciences — populate from the official KUCCPS legend
const GROUP_II = [];  // e.g. Humanities
const GROUP_III = []; // e.g. Applied/Technical subjects
const GROUP_IV = [];  // e.g. Languages
const GROUP_V = [];   // e.g. Additional/elective subjects

const GROUPS = {
  'GROUP I': GROUP_I,
  'GROUP II': GROUP_II,
  'GROUP III': GROUP_III,
  'GROUP IV': GROUP_IV,
  'GROUP V': GROUP_V
};

function isGroupPopulated(groupName) {
  const key = String(groupName || '').trim().toUpperCase();
  return Array.isArray(GROUPS[key]) && GROUPS[key].length > 0;
}

function subjectsInGroup(groupName) {
  const key = String(groupName || '').trim().toUpperCase();
  return GROUPS[key] || [];
}

module.exports = { GROUPS, isGroupPopulated, subjectsInGroup };
