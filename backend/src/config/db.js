const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[db] MONGODB_URI not set — running in DEMO MODE using bundled JSON dataset only (no admin/write features).');
    return null;
  }
  try {
    await mongoose.connect(uri);
    console.log('[db] Connected to MongoDB');
    return mongoose.connection;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    console.warn('[db] Falling back to DEMO MODE using bundled JSON dataset.');
    return null;
  }
}

module.exports = { connectDB };
