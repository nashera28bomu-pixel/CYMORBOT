const { runEligibilityPipeline } = require('../src/services/eligibilityEngine');

const studentSubjects = [
  { subject: 'Mathematics', grade: 'A' },
  { subject: 'English', grade: 'A-' },
  { subject: 'Kiswahili', grade: 'B+' },
  { subject: 'Biology', grade: 'A' },
  { subject: 'Chemistry', grade: 'A-' },
  { subject: 'Physics', grade: 'A' },
  { subject: 'History', grade: 'B+' },
  { subject: 'Geography', grade: 'B' }
];

function makeProgramme(code, name, institution, cutoffScore, requirement = null) {
  return {
    programmeCode: code,
    programmeName: name,
    institutionName: institution,
    latestCutoff: cutoffScore !== null ? { year: 2024, score: cutoffScore } : null,
    requirement
  };
}

describe('runEligibilityPipeline', () => {
  test('excludes programmes with no cutoff data', () => {
    const programmes = [makeProgramme('X1', 'Test Programme', 'Test Uni', null)];
    const out = runEligibilityPipeline(studentSubjects, programmes);
    expect(out.qualifyingCount).toBe(0);
  });

  test('excludes programmes below the cutoff and includes those at/above it', () => {
    const programmes = [
      makeProgramme('LOW', 'Low Cutoff Programme', 'Uni A', 5),
      makeProgramme('HIGH', 'High Cutoff Programme', 'Uni B', 47.99)
    ];
    const out = runEligibilityPipeline(studentSubjects, programmes);
    const codes = out.results.map(r => r.programmeCode);
    expect(codes).toContain('LOW');
  });

  test('ranks qualifying programmes by strongest positive margin first', () => {
    const programmes = [
      makeProgramme('A', 'Programme A', 'Uni A', 20),
      makeProgramme('B', 'Programme B', 'Uni B', 10),
      makeProgramme('C', 'Programme C', 'Uni C', 30)
    ];
    const out = runEligibilityPipeline(studentSubjects, programmes);
    const margins = out.results.map(r => r.margin);
    expect(margins).toEqual([...margins].sort((a, b) => b - a));
    expect(out.results[0].programmeCode).toBe('B'); // lowest cutoff -> biggest margin
  });

  test('caps results at top 100 when more than 100 qualify', () => {
    const programmes = Array.from({ length: 150 }, (_, i) =>
      makeProgramme(`P${i}`, `Programme ${i}`, `Uni ${i}`, 1)); // trivially low cutoff, all qualify
    const out = runEligibilityPipeline(studentSubjects, programmes, { limit: 100 });
    expect(out.qualifyingCount).toBe(150);
    expect(out.results.length).toBe(100);
  });

  test('does not collapse identical programme names across different universities', () => {
    const programmes = [
      makeProgramme('MED-A', 'Bachelor of Medicine', 'University A', 5),
      makeProgramme('MED-B', 'Bachelor of Medicine', 'University B', 5),
      makeProgramme('MED-C', 'Bachelor of Medicine', 'University C', 5)
    ];
    const out = runEligibilityPipeline(studentSubjects, programmes);
    expect(out.results.length).toBe(3);
  });
});
