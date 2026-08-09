function normalizeProgrammeName(name) {
  if (!name) return '';
  return String(name)
    .replace(/\(.*?\)/g, '') // drop parenthetical qualifiers for loose matching
    .replace(/[^A-Za-z& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeSubject(name) {
  return String(name || '').trim().toUpperCase();
}

module.exports = { normalizeProgrammeName, normalizeSubject };
