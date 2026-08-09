const { computeSevenSubjectAggregate } = require('../src/utils/aggregate');

const baseSubjects = [
  { subject: 'Mathematics', grade: 'B' },   // 9
  { subject: 'English', grade: 'C+' },      // 7
  { subject: 'Kiswahili', grade: 'A-' },    // 11 (best language)
  { subject: 'Biology', grade: 'A' },       // 12
  { subject: 'Chemistry', grade: 'A-' },    // 11
  { subject: 'Physics', grade: 'B+' },      // 10
  { subject: 'History', grade: 'B-' },      // 8
  { subject: 'Geography', grade: 'C' },     // 6 (should be dropped, only 5 best-of-rest needed)
];

describe('computeSevenSubjectAggregate', () => {
  test('always selects Mathematics', () => {
    const { selectedSubjects } = computeSevenSubjectAggregate(baseSubjects);
    expect(selectedSubjects.some(s => s.subject === 'MATHEMATICS')).toBe(true);
  });

  test('selects the best-performing language, not just any language', () => {
    const { selectedSubjects } = computeSevenSubjectAggregate(baseSubjects);
    const kiswahili = selectedSubjects.find(s => s.subject === 'KISWAHILI');
    const english = selectedSubjects.find(s => s.subject === 'ENGLISH');
    expect(kiswahili).toBeDefined();
    expect(english).toBeUndefined(); // English (C+, 7pts) is weaker than Kiswahili (A-, 11pts)
  });

  test('selects the five best remaining subjects', () => {
    const { selectedSubjects } = computeSevenSubjectAggregate(baseSubjects);
    const names = selectedSubjects.map(s => s.subject);
    expect(names).toEqual(expect.arrayContaining(['BIOLOGY', 'CHEMISTRY', 'PHYSICS', 'HISTORY']));
    expect(names).not.toContain('GEOGRAPHY'); // weakest of the non-mandatory subjects
  });

  test('computes correct total and mean', () => {
    const { totalPoints, meanPoints } = computeSevenSubjectAggregate(baseSubjects);
    // MATH 9 + KIS 11 + BIO 12 + CHE 11 + PHY 10 + HIS 8 + ENG 7 = 68
    expect(totalPoints).toBe(68);
    expect(meanPoints).toBeCloseTo(68 / 7, 5);
  });

  test('throws when Mathematics is missing', () => {
    const noMath = baseSubjects.filter(s => s.subject !== 'Mathematics');
    expect(() => computeSevenSubjectAggregate(noMath)).toThrow(/Mathematics/);
  });

  test('throws when fewer than 7 subjects supplied', () => {
    expect(() => computeSevenSubjectAggregate(baseSubjects.slice(0, 5))).toThrow();
  });
});
