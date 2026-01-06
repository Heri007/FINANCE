// server.js - VERSION SÉCURISÉE (Compatible avec votre structure)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');               // ✅ NOUVEAU
const cookieParser = require('cookie-parser');  // ✅ NOUVEAU
const path = require('path');
const fs = require('fs');
const { loadAccountIds } = require('./config/accounts');

// Imports Config & Middleware
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/database');
const authenticateToken = require('./middleware/auth').authenticateToken || require('./middleware/auth');

// ✅ NOUVEAUX IMPORTS SÉCURITÉ
const corsOptions = require('./middleware/corsConfig');
const securityHeaders = require('./middleware/securityHeaders');
const { csrfProtection } = require('./middleware/csrfProtection');
const { 
  generalLimiter, 
  authLimiter, 
  sensitiveLimiter 
} = require('./middleware/rateLimiters');

// Imports Routes
const transactionLinkingRoutes = require('./routes/transactionLinking');
const backupRoutes = require('./routes/backup');
const notesRoutes = require('./routes/notes');
const visionRouter = require('./routes/vision');
const projectPartnersRoutes = require('./routes/projectPartners');
const profitDistributionsRoutes = require('./routes/profitDistributions');

const app = express();
const PORT = process.env.PORT || 5002;

// =============================================================================
// PHASE 1: SÉCURITÉ (HEADERS & CORS) - AVANT TOUT
// =============================================================================

logger.info('🚀 Initialisation Money Tracker Backend...');

// ✅ 1.1 Helmet pour headers de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(securityHeaders);
logger.info('✓ Headers de sécurité configurés');

// ✅ 1.2 CORS sécurisé avec whitelist
app.use(cors(corsOptions));
logger.info(`✓ CORS configuré pour: ${process.env.FRONTEND_URL || 'localhost:5173'}`);

// =============================================================================
// PHASE 2: PARSING & COOKIES
// =============================================================================

app.use(express.json({ limit: '10mb' }));  // ⚠️ Réduit de 50mb à 10mb pour sécurité
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());  // ✅ NOUVEAU - Pour CSRF
logger.info('✓ Parsers configurés');

// =============================================================================
// PHASE 3: CRÉATION DOSSIERS UPLOADS (INCHANGÉ)
// =============================================================================

const uploadsDir = path.join(__dirname, 'uploads');
const employeesDir = path.join(uploadsDir, 'employees');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('✅ Dossier uploads créé');
}

if (!fs.existsSync(employeesDir)) {
  fs.mkdirSync(employeesDir, { recursive: true });
  logger.info('✅ Dossier uploads/employees créé');
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =============================================================================
// PHASE 4: RATE LIMITING
// =============================================================================

app.use('/api/', generalLimiter);  // ✅ 100 req/15min sur toutes les routes API
logger.info('✓ Rate limiting activé (100 req/15min)');

// =============================================================================
// PHASE 5: REQUEST LOGGER (AMÉLIORÉ)
// =============================================================================

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Logger les erreurs et requêtes lentes
    if (res.statusCode >= 400 || duration > 3000) {
      logger.warn({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    } else {
      logger.debug(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// =============================================================================
// PHASE 6: ENDPOINT CSRF TOKEN (PUBLIC - AVANT LES ROUTES)
// =============================================================================

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  logger.debug('Token CSRF généré pour IP: ' + req.ip);
  res.json({ 
    csrfToken: req.csrfToken(),
    message: 'Token CSRF généré avec succès'
  });
});

// =============================================================================
// PHASE 7: ROUTES MÉTIER (AVEC PROTECTION SÉLECTIVE)
// =============================================================================

// ✅ Route AUTH avec rate limiting strict
app.use('/api/auth', authLimiter, require('./routes/auth'));
logger.info('✓ Routes /api/auth (Rate limit: 5/15min)');

// ✅ Routes SENSIBLES avec CSRF + rate limiting modéré
app.use('/api/accounts', csrfProtection, sensitiveLimiter, require('./routes/accounts'));
app.use('/api/transactions', csrfProtection, require('./routes/transactions'));
app.use('/api/projects', csrfProtection, require('./routes/projects'));
app.use('/api/receivables', csrfProtection, require('./routes/receivables'));
app.use('/api/employees', csrfProtection, require('./routes/employees'));
app.use('/api/project-migration', csrfProtection, require('./routes/projectMigration'));
logger.info('✓ Routes sensibles protégées par CSRF');

// ✅ Routes LECTURE SEULE (pas de CSRF nécessaire)
app.use('/api/operator', require('./routes/operator'));
app.use('/api/content', require('./routes/content'));
app.use('/api/notes', notesRoutes);
app.use('/api/transaction-linking', transactionLinkingRoutes);
app.use('/api/vision', visionRouter);
app.use('/api', projectPartnersRoutes);
app.use('/api', profitDistributionsRoutes);

// ✅ Routes BACKUP (protection spéciale recommandée)
app.use('/backup', csrfProtection, backupRoutes);
logger.info('✓ Routes backup protégées');

// Static uploads (déjà défini plus haut, mais on le garde)
app.use('/uploads', express.static('uploads'));

// =============================================================================
// PHASE 8: ROUTE RACINE (INCHANGÉE)
// =============================================================================

app.get('/', (req, res) => {
  res.json({
    message: 'Money Tracker API fonctionnelle',
    status: 'online',
    security: {
      cors: 'enabled',
      csrf: 'enabled',
      rateLimit: 'enabled',
      helmet: 'enabled'
    },
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      accounts: '/api/accounts',
      transactions: '/api/transactions',
      projects: '/api/projects',
      operator: '/api/operator',
      content: '/api/content',
      backup: '/backup',
      receivables: '/api/receivables',
      csrfToken: '/api/csrf-token'  // ✅ Nouveau
    },
  });
});

// =============================================================================
// PHASE 9: GESTIONNAIRE D'ERREURS GLOBAL (AMÉLIORÉ)
// =============================================================================

app.use((err, req, res, next) => {
  // Logger toutes les erreurs
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Utiliser votre errorHandler existant
  errorHandler(err, req, res, next);
});

// =============================================================================
// PHASE 10: DÉMARRAGE SERVEUR + TEST DB (INCHANGÉ)
// =============================================================================

const server = app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 Money Tracker Backend démarré`);
  logger.info(`📍 Port: ${PORT}`);
  logger.info(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 CORS: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  logger.info(`🛡️  Sécurité: CORS + CSRF + Rate Limit + Helmet`);
  logger.info('='.repeat(60));
  
  pool.query('SELECT NOW()', async (err, result) => {
    if (err) {
      logger.error('❌ Erreur PostgreSQL:', { error: err.message });
    } else {
      logger.info('✅ Connecté à PostgreSQL');
      try {
        const ids = await loadAccountIds();
        logger.info(`✅ IDs: RECEIVABLES=${ids.RECEIVABLES_ACCOUNT_ID}, COFFRE=${ids.COFFRE_ACCOUNT_ID}`);
      } catch (e) {
        logger.warn('⚠️ Impossible de charger les IDs de comptes spéciaux');
      }
    }
  });
});

// ✅ Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  logger.info('⚠️ SIGTERM reçu, fermeture gracieuse...');
  server.close(() => {
    logger.info('✓ Serveur fermé proprement');
    pool.end();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('⚠️ SIGINT (Ctrl+C), fermeture...');
  server.close(() => {
    logger.info('✓ Serveur fermé proprement');
    pool.end();
    process.exit(0);
  });
});

module.exports = app;
