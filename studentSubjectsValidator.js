const { isValidGrade } = require('../utils/gradePoints');

function validateStudentSubjects(subjects) {
  if (!Array.isArray(subjects) || subjects.length < 7) {
    return { valid: false, message: 'Please provide at least 7 subjects with grades, including Mathematics and a language.' };
  }
  const seen = new Set();
  for (const s of subjects) {
    if (!s || !s.subject || !s.grade) {
      return { valid: false, message: 'Each subject entry needs both a subject name and a grade.' };
    }
    const key = String(s.subject).trim().toUpperCase();
    if (seen.has(key)) {
      return { valid: false, message: `Duplicate subject entered: ${s.subject}. Please remove duplicates.` };
    }
    seen.add(key);
    if (!isValidGrade(s.grade)) {
      return { valid: false, message: `"${s.grade}" is not a valid KCSE grade for ${s.subject}.` };
    }
  }
  const hasMath = subjects.some(s => String(s.subject).trim().toUpperCase() === 'MATHEMATICS');
  if (!hasMath) {
    return { valid: false, message: 'Mathematics is a mandatory subject and was not found in your entry.' };
  }
  const languages = ['ENGLISH', 'KISWAHILI', 'KENYA SIGN LANGUAGE'];
  const hasLanguage = subjects.some(s => languages.includes(String(s.subject).trim().toUpperCase()));
  if (!hasLanguage) {
    return { valid: false, message: 'At least one language (English, Kiswahili, or KSL) is mandatory.' };
  }
  return { valid: true };
}

module.exports = { validateStudentSubjects };
