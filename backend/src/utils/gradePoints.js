/**
 * KCSE 12-point grading scale utility.
 * Single source of truth for grade <-> points conversion.
 */

const GRADE_TO_POINTS = {
  'A': 12, 'A-': 11, 'B+': 10, 'B': 9, 'B-': 8,
  'C+': 7, 'C': 6, 'C-': 5, 'D+': 4, 'D': 3, 'D-': 2, 'E': 1
};

const POINTS_TO_GRADE = Object.entries(GRADE_TO_POINTS)
  .reduce((acc, [g, p]) => { acc[p] = g; return acc; }, {});

const ORDERED_GRADES = ['E', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A'];

function gradeToPoints(grade) {
  if (grade === null || grade === undefined) return null;
  const normalized = String(grade).trim().toUpperCase();
  if (!(normalized in GRADE_TO_POINTS)) {
    throw new Error(`Invalid KCSE grade: "${grade}"`);
  }
  return GRADE_TO_POINTS[normalized];
}

/**
 * Convert a mean points value (0-12, may be fractional) back to the
 * nearest KCSE mean grade, using standard round-to-nearest banding (each
 * grade band is centered on its integer point value; ties round up).
 *
 * Example: 81/84 = 11.571... rounds to 12 -> "A" (NOT "A-", which was a
 * bug in an earlier version of this function that used Math.floor and
 * therefore always rounded DOWN a full grade band on any fractional
 * mean, e.g. incorrectly turning an 11.57 mean into A- instead of A).
 */
function pointsToMeanGrade(meanPoints) {
  if (meanPoints === null || meanPoints === undefined || Number.isNaN(meanPoints)) return null;
  const rounded = Math.round(meanPoints);
  const clamped = Math.max(1, Math.min(12, rounded));
  return POINTS_TO_GRADE[clamped];
}

// Spec-friendly alias — same authoritative function, no duplicated logic.
const calculateOverallMeanGrade = pointsToMeanGrade;

function isValidGrade(grade) {
  if (!grade) return false;
  return ORDERED_GRADES.includes(String(grade).trim().toUpperCase());
}

module.exports = { GRADE_TO_POINTS, POINTS_TO_GRADE, ORDERED_GRADES, gradeToPoints, pointsToMeanGrade, calculateOverallMeanGrade, isValidGrade };
