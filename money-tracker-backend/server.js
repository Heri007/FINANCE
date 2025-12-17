// server.js - VERSION FINALE OPTIMISÉE
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { loadAccountIds } = require('./config/accounts');

// Imports Config & Middleware
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const pool = require('./config/database');
const authenticateToken = require('./middleware/auth').authenticateToken || require('./middleware/auth');
const transactionLinkingRoutes = require('./routes/transactionLinking');
const backupRoutes = require('./routes/backup');
const notesRoutes = require('./routes/notes');

const app = express();
const PORT = process.env.PORT || 5002;

// -----------------------------------------------------------------------------
// MIDDLEWARE GLOBAL
// -----------------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));

// ✅ Request Logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// -----------------------------------------------------------------------------
// ROUTES MÉTIER
// -----------------------------------------------------------------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/operator', require('./routes/operator'));
app.use('/api/content', require('./routes/content'));
app.use('/api/receivables', require('./routes/receivables'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/transaction-linking', transactionLinkingRoutes);
app.use('/api/project-migration', require('./routes/projectMigration'));

// ✅ Routes sans préfixe /api (pour compatibilité frontend)
app.use('/backup', backupRoutes);

// -----------------------------------------------------------------------------
// ROUTES UTILITAIRES
// -----------------------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({
    message: 'Money Tracker API fonctionnelle',
    status: 'online',
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
    },
  });
});

// -----------------------------------------------------------------------------
// GESTIONNAIRE D'ERREURS GLOBAL (DOIT ÊTRE À LA FIN)
// -----------------------------------------------------------------------------
app.use(errorHandler);

// -----------------------------------------------------------------------------
// DÉMARRAGE DU SERVEUR + TEST DB
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`✅ Serveur démarré sur http://localhost:${PORT}`);
  
  pool.query('SELECT NOW()', async (err, result) => {
    if (err) {
      logger.error('❌ Erreur critique de connexion à PostgreSQL:', { error: err.message });
    } else {
      logger.info('✅ Connecté à PostgreSQL');
      try {
        const ids = await loadAccountIds();
        logger.info(`✅ IDs chargés: AVOIR=${ids.AVOIR_ACCOUNT_ID}, COFFRE=${ids.COFFRE_ACCOUNT_ID}`);
      } catch (e) {
        logger.warn('⚠️ Impossible de charger les IDs de comptes spéciaux au démarrage');
      }
    }
  });
});
