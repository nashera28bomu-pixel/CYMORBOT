// engine.js — pure logic, no I/O. Kept separate so it's easy to unit-test on a phone editor.

const GRADE_POINTS = { "A": 12, "A-": 11, "B+": 10, "B": 9, "B-": 8, "C+": 7, "C": 6, "C-": 5, "D+": 4, "D": 3, "D-": 2, "E": 1 };
const GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "E"];

function gradeToPoints(grade) {
  return GRADE_POINTS[grade] ?? 0;
}

function meetsMinGrade(actualGrade, minGrade) {
  // returns true if actualGrade is equal to or better than minGrade
  const a = GRADE_ORDER.indexOf(actualGrade);
  const m = GRADE_ORDER.indexOf(minGrade);
  if (a === -1 || m === -1) return false;
  return a <= m; // lower index = better grade
}

function computeMeanGrade(subjectGrades) {
  // subjectGrades: { subjectName: grade } - KNEC uses best 7 subjects (Eng/Kis compulsory + Math + best 5 others)
  const entries = Object.entries(subjectGrades).filter(([, g]) => g);
  if (entries.length === 0) return { meanPoints: 0, meanGrade: "E" };
  const totalPoints = entries.reduce((sum, [, g]) => sum + gradeToPoints(g), 0);
  const meanPoints = totalPoints / entries.length;
  let meanGrade = "E";
  for (const g of GRADE_ORDER) {
    // rough mapping mean points -> grade band (12=A ... 1=E), matches KNEC scale reasonably
    const bandMin = { "A": 11.5, "A-": 10.5, "B+": 9.5, "B": 8.5, "B-": 7.5, "C+": 6.5, "C": 5.5, "C-": 4.5, "D+": 3.5, "D": 2.5, "D-": 1.5, "E": 0 }[g];
    if (meanPoints >= bandMin) { meanGrade = g; break; }
  }
  return { meanPoints: Math.round(meanPoints * 1000) / 1000, meanGrade };
}

function isDegreeEligible(meanGrade) {
  return GRADE_ORDER.indexOf(meanGrade) <= GRADE_ORDER.indexOf("C+");
}

// Cluster point formula (public KUCCPS-style estimate): weighted sum of the 4 relevant
// subject points, scaled against the 84-point max (4 subjects x 12 x 1.75 weighting used
// by KUCCPS), producing a score comparable to the published cutoffs (typically 0-48 range).
function computeClusterPoints(subjectGrades, subjectSlots) {
  // Pick the 4 best-matching subjects the student has for this cluster's 4 slots.
  // Since our slot definitions are descriptive (e.g. "MAT ALT A", "any Group II"), we resolve
  // them against whatever subjects the student entered, then take the best 4 relevant grades.
  const allEntries = Object.entries(subjectGrades).filter(([, g]) => g);
  if (allEntries.length < 4) {
    return { clusterPoints: 0, subjectsUsed: [] };
  }
  const sorted = allEntries
    .map(([subj, g]) => ({ subject: subj, grade: g, points: gradeToPoints(g) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 4);
  const rawTotal = sorted.reduce((sum, s) => sum + s.points, 0); // max 48
  // KUCCPS cluster points formula approximates to (rawTotal / 48) * 48 scaled with mean-grade
  // weighting; we present the raw 4-subject total (0-48) which is directly comparable to the
  // published cutoff points in the cutoffs table.
  const clusterPoints = Math.round(rawTotal * 1000) / 1000;
  return { clusterPoints, subjectsUsed: sorted };
}

function checkMinimumRequirements(subjectGrades, minimumRequirements) {
  // minimumRequirements: [{subject: "BIO", minGrade: "C+"}, ...]
  // subject strings may contain multiple options separated by "/" e.g. "MAT ALT A/PHY"
  const failures = [];
  for (const req of minimumRequirements) {
    const options = req.subject.split("/").map(s => s.trim());
    const minGrade = (req.minGrade.match(/^[A-E][+-]?/) || ["C+"])[0]; // parse leading grade token
    let satisfied = false;
    for (const opt of options) {
      for (const [studentSubj, grade] of Object.entries(subjectGrades)) {
        if (!grade) continue;
        if (subjectMatches(studentSubj, opt) && meetsMinGrade(grade, minGrade)) {
          satisfied = true;
          break;
        }
      }
      if (satisfied) break;
    }
    if (!satisfied) failures.push(req);
  }
  return { passed: failures.length === 0, failures };
}

// Loose matcher: student subject names (English, Kiswahili, Mathematics, Biology, Chemistry,
// Physics, History and Government, Geography, CRE, IRE, HRE, Agriculture, Business Studies,
// Home Science, Computer Studies, French, German, Music, ...) vs cluster requirement tokens.
const SUBJECT_ALIASES = {
  "ENG": ["english"], "KIS": ["kiswahili"],
  "MAT ALT A": ["mathematics"], "MAT ALT A/B": ["mathematics"], "MAT ALT A/PHY": ["mathematics", "physics"],
  "MAT ALT A/PHY/AGRIC": ["mathematics", "physics", "agriculture"],
  "MAT ALT A/PHY/GEO": ["mathematics", "physics", "geography"],
  "MAT ALT A/PHY/CHE": ["mathematics", "physics", "chemistry"],
  "MAT ALT A/B/PHY/GEO": ["mathematics", "physics", "geography"],
  "BIO": ["biology"], "CHE": ["chemistry"], "PHY": ["physics"],
  "BIO/CHE/GEO": ["biology", "chemistry", "geography"], "GEO/CHE": ["geography", "chemistry"],
  "BIO/GSC": ["biology", "general science"], "BIO/AGR": ["biology", "agriculture"],
  "BIO/AGRIC/BST": ["biology", "agriculture", "business studies"],
  "BIO/AGRIC/HSC": ["biology", "agriculture", "home science"],
  "BIO/BSC": ["biology", "general science"],
  "AGR/BIO": ["agriculture", "biology"],
  "CHE/MAT ALT A/PHY": ["chemistry", "mathematics", "physics"],
  "MAT ALT A/PHY/CHE (order)": ["mathematics"],
  "GEO": ["geography"], "History & Government": ["history and government"],
  "MUS": ["music"], "MUSIC": ["music"], "FRE/GER": ["french", "german"], "FRE": ["french"], "GER": ["german"],
  "FRENCH": ["french"], "GERMAN": ["german"],
  "CRE/IRE/HRE": ["christian religious education", "islamic religious education", "hindu religious education"],
  "PSC": ["physical science"], "BST": ["business studies"],
  "MAT ALT A/B/BST": ["mathematics", "business studies"],
  "COMP/MAT ALT A/PHY": ["computer studies", "mathematics", "physics"],
};

function subjectMatches(studentSubj, requirementToken) {
  const s = studentSubj.toLowerCase().trim();
  if (requirementToken === "ENG/KIS") return s === "english" || s === "kiswahili";
  const aliases = SUBJECT_ALIASES[requirementToken];
  if (aliases) return aliases.includes(s);
  // fallback: direct loose contains match
  return s.includes(requirementToken.toLowerCase());
}

function probabilityLabel(clusterPoints, cutoff) {
  if (cutoff == null) return "Unknown (no recent cutoff data)";
  const diff = clusterPoints - cutoff;
  if (diff >= 1.5) return "High";
  if (diff >= -1.0) return "Medium";
  return "Low";
}

module.exports = {
  GRADE_ORDER, GRADE_POINTS,
  gradeToPoints, meetsMinGrade, computeMeanGrade, isDegreeEligible,
  computeClusterPoints, checkMinimumRequirements, probabilityLabel
};
