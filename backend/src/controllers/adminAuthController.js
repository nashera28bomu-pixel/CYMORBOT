const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const { isDbConnected } = require('../services/datasetRepository');

async function login(req, res, next) {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: { code: 'DB_UNAVAILABLE', message: 'Admin login requires a database connection (set MONGODB_URI).' } });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_CREDENTIALS', message: 'Email and password are required.' } });
    }
    const user = await AdminUser.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_LOGIN', message: 'Invalid email or password.' } });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_LOGIN', message: 'Invalid email or password.' } });
    }
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, role: user.role },
      process.env.JWT_SECRET || 'dev-secret-change-me',
      { expiresIn: '12h' }
    );
    res.json({ success: true, data: { token, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
