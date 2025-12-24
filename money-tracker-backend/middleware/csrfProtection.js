// money-tracker-backend/middleware/csrfProtection.js

const csrf = require('csurf');
const logger = require('../config/logger');

/**
 * Configuration CSRF
 */
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1h
  }
});

/**
 * Middleware avec logging des erreurs CSRF
 */
const csrfWithLogging = (req, res, next) => {
  csrfProtection(req, res, (err) => {
    if (err) {
      logger.error({
        message: '🚨 CSRF: Token invalide ou manquant',
        ip: req.ip,
        path: req.path,
        method: req.method,
        error: err.message
      });
      
      return res.status(403).json({
        error: 'Token CSRF invalide ou manquant',
        code: 'EBADCSRFTOKEN'
      });
    }
    next();
  });
};

module.exports = { csrfProtection: csrfWithLogging };
