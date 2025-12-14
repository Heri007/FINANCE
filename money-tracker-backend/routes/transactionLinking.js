// routes/transactionLinking.js
// -----------------------------------------------------------------------------
// Routes API pour la gestion des liaisons transaction-ligne
// -----------------------------------------------------------------------------

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth'); // ✅ AJOUT SÉCURITÉ

console.log('📋 Chargement du module transactionLinking.js');

// Import du service
const {
  linkTransactionToLine,
  unlinkTransaction,
  getUnlinkedTransactions,
  getProjectLines,
  getSuggestedMatches,
  getProjectLinkingStats,
  getLinkingHistory,
  autoLinkProjectTransactions
} = require('../services/transactionLinkingService');

// ✅ PROTECTION GLOBALE : Toutes ces routes nécessitent d'être connecté
router.use(authMiddleware);

console.log('🔗 Routes Transaction Linking chargées'); // Log de debug au démarrage

// -----------------------------------------------------------------------------
// POST /api/transaction-linking/link
// -----------------------------------------------------------------------------
router.post('/link', async (req, res) => {
  try {
    const { transactionId, lineId, userId } = req.body;

    if (!transactionId || !lineId) {
      return res.status(400).json({
        success: false,
        error: 'transactionId et lineId requis'
      });
    }

    const result = await linkTransactionToLine(
      parseInt(transactionId),
      parseInt(lineId), // Les IDs des lignes (expense/revenue) restent des entiers
      userId || req.user?.id || 'api_user' // On essaie de prendre l'ID du token si dispo
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur route /link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /api/transaction-linking/unlink
// -----------------------------------------------------------------------------
router.post('/unlink', async (req, res) => {
  try {
    const { transactionId, userId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'transactionId requis' });
    }

    const result = await unlinkTransaction(
      parseInt(transactionId),
      userId || req.user?.id || 'api_user'
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Erreur route /unlink:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/transaction-linking/unlinked
// -----------------------------------------------------------------------------
router.get('/unlinked', async (req, res) => {
  try {
    const { projectId } = req.query;

    const transactions = await getUnlinkedTransactions(
      projectId ? parseInt(projectId) : null
    );

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (error) {
    console.error('Erreur route /unlinked:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/transaction-linking/project-lines/:projectId
// -----------------------------------------------------------------------------
router.get('/project-lines/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const lines = await getProjectLines(parseInt(projectId));
    res.json({ success: true, data: lines });
  } catch (error) {
    console.error('Erreur route /project-lines:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/transaction-linking/suggestions/:transactionId
// -----------------------------------------------------------------------------
router.get('/suggestions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const suggestions = await getSuggestedMatches(parseInt(transactionId));
    res.json({ success: true, count: suggestions.length, data: suggestions });
  } catch (error) {
    console.error('Erreur route /suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/transaction-linking/stats/:projectId
// -----------------------------------------------------------------------------
router.get('/stats/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const stats = await getProjectLinkingStats(parseInt(projectId));
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Erreur route /stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/transaction-linking/history/:projectId
// -----------------------------------------------------------------------------
router.get('/history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit } = req.query;
    const history = await getLinkingHistory(
      parseInt(projectId),
      limit ? parseInt(limit) : 50
    );
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error('Erreur route /history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /api/transaction-linking/auto-link/:projectId
// -----------------------------------------------------------------------------
router.post('/auto-link/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;

    const result = await autoLinkProjectTransactions(
      parseInt(projectId),
      userId || req.user?.id || 'api_user'
    );
    res.json(result);

  } catch (error) {
    console.error('Erreur route /auto-link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;