const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');

/**
 * Handler pour rate limit dépassé
 */
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
 * Créer un rate limiter simple sans Redis
 */
const createRateLimiter = (config) => {
  return rateLimit({
    ...config,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler
  });
};

// Rate limiter général (100 requêtes par 15 minutes)
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 10000,
  message: {
    success: false,
    error: 'Trop de requêtes, veuillez réessayer plus tard.'
  },
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Rate limiter pour l'authentification (5 tentatives par 15 minutes)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  skipSuccessfulRequests: true
});

// Rate limiter pour les imports (3 par heure)
const importLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 3 : 100,
  message: {
    success: false,
    error: 'Limite d\'imports atteinte. Réessayez dans 1 heure.'
  }
});

// Rate limiter pour les modifications (30 par minute)
const mutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 1000,
  message: {
    success: false,
    error: 'Trop de modifications. Ralentissez un peu.'
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  importLimiter,
  mutationLimiter
};
