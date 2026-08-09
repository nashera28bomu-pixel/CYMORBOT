const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: String,
  role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema);
