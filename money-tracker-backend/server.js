// server.js - VERSION FINALE OPTIMISÉE
// -----------------------------------------------------------------------------
// Point d’entrée de l’API Money Tracker.
// - Charge la config (dotenv)
// - Initialise Express + CORS
// - Monte les routes métier (auth, comptes, transactions, projets, etc.)
// - Expose quelques routes utilitaires (healthcheck, reset de données)
// - Démarre le serveur et teste la connexion PostgreSQL
// -----------------------------------------------------------------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { loadAccountIds } = require('./config/accounts');

// Imports Config & Middleware
const logger = require('./config/logger'); // ✅ Import du Logger
const errorHandler = require('./middleware/errorHandler'); // ✅ Import du Error Handler
const pool = require('./config/database');
const authenticateToken = require('./middleware/auth').authenticateToken || require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5002;

// -----------------------------------------------------------------------------
// Sécurité : Exiger la présence de JWT_SECRET au démarrage
// -----------------------------------------------------------------------------
if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET is not set. Aborting startup.');
  console.error('FATAL: JWT_SECRET is not set. Set it in environment and restart.');
  process.exit(1);
}
// -----------------------------------------------------------------------------
// MIDDLEWARE GLOBAL
// -----------------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '50mb' })); // Augmenté pour supporter les gros JSON

// ✅ Request Logger (Log chaque requête entrante)
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
app.use('/api/backup', require('./routes/backup'));
app.use('/api/receivables', require('./routes/receivables'));
app.use('/api/notes', require('./routes/notes'));


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
      backup: '/api/backup',
    },
  });
});

// -----------------------------------------------------------------------------
// POST /api/reset-data (DEV UNIQUEMENT)
// -----------------------------------------------------------------------------
app.post('/api/reset-data', authenticateToken, async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Reset interdit en production' });
  }

  try {
    logger.warn('🧹 Réinitialisation des données demandée (PIN préservé)...');

    await pool.query('BEGIN');
    await pool.query('TRUNCATE TABLE receivables, transactions, accounts RESTART IDENTITY CASCADE');
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    await pool.query('COMMIT');

    logger.info('✅ Comptes, transactions et avoirs vidés avec succès.');
    res.json({ message: 'Données réinitialisées (PIN préservé).' });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    logger.error('❌ Erreur lors du reset :', { error: err.message });
    next(err); // Passe au errorHandler global
  }
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
  
  // Test de connexion à la base
  pool.query('SELECT NOW()', async (err, _result) => {
    if (err) {
      logger.error('❌ Erreur critique de connexion à PostgreSQL:', { error: err.message });
    } else {
      logger.info('✅ Connecté à PostgreSQL');
      try {
        const ids = await loadAccountIds(); // charge AVOIR / COFFRE au boot
        logger.info(`✅ IDs chargés: AVOIR=${ids.AVOIR_ACCOUNT_ID}, COFFRE=${ids.COFFRE_ACCOUNT_ID}`);
      } catch (e) {
        logger.warn('⚠️ Impossible de charger les IDs de comptes spéciaux au démarrage');
      }
    }
  });
});
