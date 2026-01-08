// server.js - VERSION OPTIMISÉE avec Performance & Sécurité
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression'); // NOUVEAU
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Services de performance NOUVEAUX
const cacheService = require('./services/cacheService');
const transactionService = require('./services/transactionService');

// Config & Middleware existants
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/database');
const { authenticateToken } = require('./middleware/auth');
const loadAccountIds = require('./config/accounts');

// Sécurité existante
const corsOptions = require('./middleware/corsConfig');
const securityHeaders = require('./middleware/securityHeaders');
const { csrfProtection } = require('./middleware/csrfProtection');
const { generalLimiter, authLimiter, sensitiveLimiter } = require('./middleware/rateLimiters');

// Middleware de performance NOUVEAUX
const { paginationMiddleware } = require('./middleware/paginationMiddleware');
const { cacheMiddleware, invalidateCacheMiddleware } = require('./middleware/cacheMiddleware');

// Routes existantes
const transactionLinkingRoutes = require('./routes/transactionLinking');
const backupRoutes = require('./routes/backup');
const notesRoutes = require('./routes/notes');
const visionRouter = require('./routes/vision');
const projectPartnersRoutes = require('./routes/projectPartners');
const profitDistributionsRoutes = require('./routes/profitDistributions');

const app = express();
const PORT = process.env.PORT || 5002;

// =================================================================
// PHASE 0: INITIALISATION CACHE SERVICE (NOUVEAU)
// =================================================================
(async () => {
  try {
    await cacheService.connect();
    logger.info('✅ Redis Cache Service connecté');
  } catch (error) {
    logger.warn('⚠️ Redis non disponible, cache désactivé:', error.message);
  }
})();

// =================================================================
// PHASE 1: SÉCURITÉ & COMPRESSION (AMÉLIORÉ)
// =================================================================
logger.info('Initialisation Money Tracker Backend OPTIMISÉ...');

// 1.1 Compression des réponses (NOUVEAU)
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Niveau de compression (0-9)
}));
logger.info('✅ Compression activée');

// 1.2 Helmet (EXISTANT)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", '*']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(securityHeaders);
logger.info('✅ Headers de sécurité configurés');

// 1.3 CORS (EXISTANT)
app.use(cors(corsOptions));
logger.info(`✅ CORS configuré pour ${process.env.FRONTEND_URL || 'localhost:5173'}`);

// =================================================================
// PHASE 2: PARSING (EXISTANT)
// =================================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
logger.info('✅ Parsers configurés');

// =================================================================
// PHASE 3: DOSSIERS UPLOADS (EXISTANT)
// =================================================================
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

// =================================================================
// PHASE 4: RATE LIMITING (EXISTANT)
// =================================================================
app.use('/api/', generalLimiter);
logger.info('✅ Rate limiting: 100 req/15min');

// =================================================================
// PHASE 5: REQUEST LOGGER (EXISTANT AMÉLIORÉ)
// =================================================================
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Logger avec plus de détails pour le monitoring
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    if (res.statusCode >= 400 || duration > 3000) {
      logger.warn(logData);
    } else {
      logger.debug(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// =================================================================
// PHASE 6: ENDPOINT CSRF TOKEN (EXISTANT)
// =================================================================
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  logger.debug(`Token CSRF généré pour IP ${req.ip}`);
  res.json({
    csrfToken: req.csrfToken(),
    message: 'Token CSRF généré avec succès'
  });
});

// =================================================================
// PHASE 7: HEALTH CHECK & METRICS (NOUVEAU)
// =================================================================
app.get('/api/health', async (req, res) => {
  try {
    // Vérifier DB
    const dbResult = await pool.query('SELECT NOW()');
    const dbStatus = dbResult ? 'healthy' : 'unhealthy';
    
    // Vérifier Cache
    const cacheStatus = cacheService.isConnected ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      cache: cacheStatus,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// =================================================================
// PHASE 8: ROUTES MÉTIER AVEC OPTIMISATIONS (AMÉLIORÉ)
// =================================================================

// 8.1 Routes AUTH (EXISTANT)
app.use('/api/auth', authLimiter, require('./routes/auth'));
logger.info('✅ Routes /api/auth (Rate limit: 5/15min)');

// 8.2 Routes SENSIBLES - VERSION SANS MIDDLEWARES PROBLÉMATIQUES
logger.info('🔍 Chargement routes sensibles...');

try {
  const accountsRouter = require('./routes/accounts');
  logger.info('✅ Module accounts importé');
  app.use('/api/accounts', accountsRouter);  // Sans middleware
  logger.info('✅ Route /api/accounts montée');
} catch (err) {
  logger.error('❌ Erreur complète /api/accounts:', err.stack);
}

try {
  const transactionsRouter = require('./routes/transactions');
  logger.info('✅ Module transactions importé');
  app.use('/api/transactions', transactionsRouter);  // Sans middleware
  logger.info('✅ Route /api/transactions montée');
} catch (err) {
  logger.error('❌ Erreur complète /api/transactions:', err.stack);
}

try {
  const projectsRouter = require('./routes/projects');
  logger.info('✅ Module projects importé');
  app.use('/api/projects', projectsRouter);  // Sans middleware
  logger.info('✅ Route /api/projects montée');
} catch (err) {
  logger.error('❌ Erreur complète /api/projects:', err.stack);
}

// Les autres routes
app.use('/api/receivables', csrfProtection, require('./routes/receivables'));
app.use('/api/employees', csrfProtection, require('./routes/employees'));
app.use('/api/project-migration', csrfProtection, require('./routes/projectMigration'));

logger.info('✅ Routes sensibles testées');



// 8.3 Routes LECTURE - SANS middlewares externes (conflit avec authMiddleware interne)
logger.info('✅ Configuration routes lecture...');

// Routes operator et content ont leur propre gestion d'auth
app.use('/api/operator', require('./routes/operator'));
app.use('/api/content', require('./routes/content'));
app.use('/api/notes', notesRoutes);
app.use('/api/transaction-linking', transactionLinkingRoutes);
app.use('/api/vision', visionRouter);
app.use('/api/', projectPartnersRoutes);
app.use('/api/', profitDistributionsRoutes);

logger.info('✅ Routes lecture configurées');

// 8.4 Routes BACKUP (EXISTANT)
app.use('/backup', csrfProtection, backupRoutes);
logger.info('✅ Routes /backup protégées');

// =================================================================
// PHASE 9: ROUTES OPTIMISÉES SPÉCIFIQUES (NOUVEAU)
// =================================================================

// Cache management endpoints
app.post('/api/admin/cache/clear', authenticateToken, async (req, res) => {
  try {
    await cacheService.clearAll();
    logger.info('Cache cleared by admin');
    res.json({ success: true, message: 'Cache vidé avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/admin/cache/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      connected: cacheService.isConnected,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =================================================================
// PHASE 10: ROUTE RACINE (EXISTANT AMÉLIORÉ)
// =================================================================
app.get('/', (req, res) => {
  res.json({
    message: 'Money Tracker API OPTIMISÉE',
    status: 'online',
    version: '2.0.0',
    features: {
      security: {
        cors: 'enabled',
        csrf: 'enabled',
        rateLimit: 'enabled',
        helmet: 'enabled'
      },
      performance: {
        cache: cacheService.isConnected ? 'enabled' : 'disabled',
        compression: 'enabled',
        pagination: 'enabled',
        transactions: 'enabled'
      }
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
      health: '/api/health',
      csrfToken: '/api/csrf-token'
    }
  });
});

// =================================================================
// PHASE 11: GESTIONNAIRE D'ERREURS (EXISTANT)
// =================================================================
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  errorHandler(err, req, res, next);
});

// =================================================================
// PHASE 12: DÉMARRAGE SERVEUR (EXISTANT AMÉLIORÉ)
// =================================================================
const server = app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info('🚀 Money Tracker Backend OPTIMISÉ démarré');
  logger.info(`📡 Port: ${PORT}`);
  logger.info(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔐 CORS: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  logger.info(`🛡️  Sécurité: CORS + CSRF + Rate Limit + Helmet`);
  logger.info(`⚡ Performance: Cache + Compression + Pagination`);
  logger.info('='.repeat(60));
  
  // Test connexion DB
  pool.query('SELECT NOW()', async (err, result) => {
    if (err) {
      logger.error('❌ Erreur PostgreSQL:', { error: err.message });
    } else {
      logger.info('✅ Connecté à PostgreSQL');
      
      try {
        const ids = await loadAccountIds();
        logger.info(`✅ IDs: RECEIVABLES=${ids.RECEIVABLES_ACCOUNT_ID}, COFFRE=${ids.COFFRE_ACCOUNT_ID}`);
      } catch (e) {
        logger.warn('⚠️  Impossible de charger les IDs de comptes spéciaux');
      }
    }
  });
});

// Gestion propre de l'arrêt
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} reçu, fermeture gracieuse...`);
  
  server.close(async () => {
    logger.info('✅ Serveur HTTP fermé');
    
    // Fermer les connexions
    await cacheService.disconnect();
    logger.info('✅ Cache déconnecté');
    
    await pool.end();
    logger.info('✅ Pool PostgreSQL fermé');
    
    process.exit(0);
  });
  
  // Force exit après 10 secondes
  setTimeout(() => {
    logger.error('❌ Timeout, arrêt forcé');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
