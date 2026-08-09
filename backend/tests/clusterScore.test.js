const { computeWeightedClusterScore, computeR } = require('../src/utils/clusterScore');

describe('computeWeightedClusterScore', () => {
  // NOTE: the original build brief's worked example states r=42, t=70
  // should yield "approximately 42.54". Applying the brief's own formula
  // (S = 48 * sqrt((r/48) * (t/84))) to those exact inputs actually
  // yields ≈40.988, not 42.54 — the brief's illustrative number is
  // arithmetically inconsistent with the formula it specifies just above
  // it. Per the project's own principle of never silently guessing or
  // inventing figures, this test asserts the value the stated formula
  // actually produces rather than forcing agreement with the brief's
  // inconsistent example. See README §"Honest limitations" for a note.
  test('applies the exact stated formula for r=42, t=70', () => {
    const s = computeWeightedClusterScore(42, 70);
    expect(s).toBeCloseTo(40.988, 2);
  });

  test('maximum score is 48 when r=48 and t=84', () => {
    expect(computeWeightedClusterScore(48, 84)).toBeCloseTo(48, 5);
  });

  test('score is 0 when r=0', () => {
    expect(computeWeightedClusterScore(0, 84)).toBe(0);
  });
});

describe('computeR', () => {
  test('sums best subject points across resolved slots with alternatives', () => {
    const student = [
      { subject: 'Mathematics', grade: 'A' },    // 12
      { subject: 'English', grade: 'B+' },       // 10
      { subject: 'Kiswahili', grade: 'B-' },      // 8
      { subject: 'Physics', grade: 'A-' }         // 11
    ];
    const slots = [['MATHEMATICS'], ['ENGLISH', 'KISWAHILI'], ['PHYSICS'], ['PHYSICS']];
    // math 12 + best(eng,kis)=10 + physics 11 + physics 11 = 44
    expect(computeR(student, slots)).toBe(44);
  });

  test('caps r at 48', () => {
    const student = [{ subject: 'Mathematics', grade: 'A' }];
    const slots = [['MATHEMATICS'], ['MATHEMATICS'], ['MATHEMATICS'], ['MATHEMATICS'], ['MATHEMATICS']];
    expect(computeR(student, slots)).toBeLessThanOrEqual(48);
  });
});
