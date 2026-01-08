// money-tracker-backend/middleware/corsConfig.js

const logger = require('../config/logger');

/**
 * Whitelist des origines autorisées
 */
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_STAGING,
].filter(Boolean);

/**
 * Configuration CORS sécurisée
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser requêtes sans origin en développement (Postman, etc.)
    if (!origin && process.env.NODE_ENV !== 'production') {
      logger.debug(`CORS: Requête sans origin autorisée (dev mode)`);
      return callback(null, true);
    }

    // Vérifier whitelist
    if (allowedOrigins.includes(origin)) {
      logger.debug(`✓ CORS: Origine autorisée - ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`⚠️ CORS: Origine REJETÉE - ${origin || 'unknown'}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  
  credentials: true,
  maxAge: 86400, // 24h cache pour preflight
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

module.exports = corsOptions;
