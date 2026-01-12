// routes/audit.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const auditService = require('../services/auditService');

// Protection globale : toutes ces routes nécessitent authentification
router.use(authMiddleware);

// GET /api/audit - Récupérer les logs avec filtres
router.get('/', async (req, res) => {
  try {
    const filters = {
      tableName: req.query.table,
      recordId: req.query.recordId ? parseInt(req.query.recordId) : null,
      operation: req.query.operation,
      performedBy: req.query.user,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit) : 100
    };

    const result = await auditService.getAuditLogs(filters);
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audit/:table/:recordId - Historique d'un enregistrement
router.get('/:table/:recordId', async (req, res) => {
  try {
    const { table, recordId } = req.params;
    const result = await auditService.getRecordHistory(table, parseInt(recordId));
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/:table/:recordId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audit/stats - Statistiques
router.get('/stats/summary', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 30;
    const result = await auditService.getAuditStats(days);
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audit/user/:userId - Activité utilisateur
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const result = await auditService.getUserActivity(userId, limit);
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audit/search - Recherche
router.get('/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    const result = await auditService.searchAuditLogs(term);
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audit/compare - Comparer deux versions
router.post('/compare', async (req, res) => {
  try {
    const { auditId1, auditId2 } = req.body;
    const result = await auditService.compareVersions(
      parseInt(auditId1),
      parseInt(auditId2)
    );
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/compare:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audit/restore/:auditId - Restaurer une version
router.post('/restore/:auditId', async (req, res) => {
  try {
    const { auditId } = req.params;
    const userId = req.user?.id || 'api-user';
    
    const result = await auditService.restoreToPreviousVersion(
      parseInt(auditId),
      userId
    );
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/restore:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/audit/cleanup - Nettoyer les vieux logs
router.delete('/cleanup', async (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 90;
    const result = await auditService.cleanupOldLogs(days);
    res.json(result);

  } catch (error) {
    console.error('Erreur route /audit/cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
