// money-tracker-backend/middleware/rateLimiters.js

const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

const rateLimitHandler = (req, res) => {
  logger.warn({
    message: '⚠️ Rate limit dépassé',
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent')
  });
  
  res.status(429).json({
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: res.getHeader('Retry-After')
  });
};

/**
 * ✅ Rate limiter DÉSACTIVÉ en développement
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // ✅ 10000 en dev
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => process.env.NODE_ENV === 'development', // ✅ Skip en dev
});

/**
 * Auth limiter : Strict même en dev (sécurité)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // ✅ 50 en dev
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.error({
      message: '🚨 ALERTE: Tentatives de login excessives',
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent')
    });
    res.status(429).json({
      error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    });
  }
});

/**
 * Opérations sensibles : Plus permissif en dev
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // ✅ 1000 en dev
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveLimiter
};
