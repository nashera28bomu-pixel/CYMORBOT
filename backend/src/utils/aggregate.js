const { gradeToPoints, pointsToMeanGrade } = require('./gradePoints');

const LANGUAGE_SUBJECTS = ['ENGLISH', 'KISWAHILI', 'KENYA SIGN LANGUAGE'];
const MATH_SUBJECT = 'MATHEMATICS';

/**
 * Deterministically select the KCSE 7-subject aggregate.
 *
 * Rules (per KUCCPS convention):
 * 1. Mathematics is mandatory.
 * 2. The best-performing language among English, Kiswahili, Kenya Sign
 *    Language is mandatory.
 * 3. The five best-performing subjects from everything remaining are
 *    selected to fill out the 7.
 *
 * @param {Array<{subject:string, grade:string}>} subjects - all subjects the
 *   student sat, with raw KCSE grades.
 * @returns {{selectedSubjects: Array, totalPoints:number, meanPoints:number,
 *   meanGrade:string}}
 */
function computeSevenSubjectAggregate(subjects) {
  if (!Array.isArray(subjects) || subjects.length < 7) {
    throw new Error('At least 7 subjects (including Mathematics and a language) are required.');
  }

  const withPoints = subjects.map(s => ({
    subject: String(s.subject).trim().toUpperCase(),
    grade: String(s.grade).trim().toUpperCase(),
    points: gradeToPoints(s.grade)
  }));

  const mathEntries = withPoints.filter(s => s.subject === MATH_SUBJECT);
  if (mathEntries.length === 0) {
    throw new Error('Mathematics is mandatory and was not found among the subjects supplied.');
  }
  const math = mathEntries.sort((a, b) => b.points - a.points)[0];

  const languageEntries = withPoints.filter(s => LANGUAGE_SUBJECTS.includes(s.subject));
  if (languageEntries.length === 0) {
    throw new Error('At least one language (English, Kiswahili, or KSL) is mandatory.');
  }
  const bestLanguage = languageEntries.sort((a, b) => b.points - a.points)[0];

  // Remaining pool excludes the exact math entry and the exact chosen language entry
  const usedSubjectNames = new Set([math.subject, bestLanguage.subject]);
  const remaining = withPoints.filter(s => !usedSubjectNames.has(s.subject));

  const bestFive = remaining
    .sort((a, b) => b.points - a.points)
    .slice(0, 5);

  if (bestFive.length < 5) {
    throw new Error('Not enough distinct subjects supplied to complete the 7-subject aggregate.');
  }

  const selectedSubjects = [math, bestLanguage, ...bestFive];
  const totalPoints = selectedSubjects.reduce((sum, s) => sum + s.points, 0);
  const meanPoints = totalPoints / 7;
  const meanGrade = pointsToMeanGrade(meanPoints);

  return { selectedSubjects, totalPoints, meanPoints, meanGrade };
}

module.exports = { computeSevenSubjectAggregate, calculate7SubjectAggregate: computeSevenSubjectAggregate, LANGUAGE_SUBJECTS, MATH_SUBJECT };
