const { gradeToPoints, pointsToMeanGrade } = require('../src/utils/gradePoints');

describe('gradeToPoints', () => {
  test.each([
    ['A', 12], ['A-', 11], ['B+', 10], ['B', 9], ['B-', 8],
    ['C+', 7], ['C', 6], ['C-', 5], ['D+', 4], ['D', 3], ['D-', 2], ['E', 1]
  ])('%s -> %i', (grade, points) => {
    expect(gradeToPoints(grade)).toBe(points);
  });

  test('is case-insensitive', () => {
    expect(gradeToPoints('a-')).toBe(11);
  });

  test('throws on invalid grade', () => {
    expect(() => gradeToPoints('Z')).toThrow();
  });
});

describe('pointsToMeanGrade', () => {
  test('converts fractional mean back to nearest grade band', () => {
    expect(pointsToMeanGrade(10.0)).toBe('B+');
    expect(pointsToMeanGrade(10.9)).toBe('B+');
    expect(pointsToMeanGrade(11.0)).toBe('A-');
  });
});
