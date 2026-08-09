const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(helmet());

  const allowedOrigins = (process.env.FRONTEND_URL || '*')
    .split(',')
    .map(o => o.trim());
  app.use(cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
    credentials: true
  }));

  app.use(express.json({ limit: '2mb' }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
  app.use('/api', apiLimiter);

  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
