const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'NO_TOKEN', message: 'Admin authentication required.' } });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    req.admin = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid. Please log in again.' } });
  }
}

module.exports = { requireAdmin };
