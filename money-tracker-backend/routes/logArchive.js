// routes/logArchive.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const logArchiveService = require('../services/logArchiveService');

// Protection globale
router.use(authMiddleware);

// POST /api/log-archive/daily - Archiver les logs de la veille
router.post('/daily', async (req, res) => {
  try {
    const deleteAfterArchive = req.body.deleteAfterArchive !== false; // Par défaut: true
    
    const result = await logArchiveService.archiveYesterdayLogs(deleteAfterArchive);
    
    res.json({
      success: true,
      message: 'Archivage quotidien effectué',
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur /log-archive/daily:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/log-archive/monthly - Archiver le mois précédent
router.post('/monthly', async (req, res) => {
  try {
    const deleteAfterArchive = req.body.deleteAfterArchive !== false;
    
    const result = await logArchiveService.archiveLastMonthLogs(deleteAfterArchive);
    
    res.json({
      success: true,
      message: 'Archivage mensuel effectué',
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur /log-archive/monthly:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/log-archive/custom - Archiver une période spécifique
router.post('/custom', async (req, res) => {
  try {
    const { startDate, endDate, deleteAfterArchive = false, type = 'audit' } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate et endDate requis' 
      });
    }

    const archiveFunc = type === 'audit' 
      ? logArchiveService.archiveAuditLogs 
      : logArchiveService.archiveLinkingLogs;

    const result = await archiveFunc(new Date(startDate), new Date(endDate), deleteAfterArchive);
    
    res.json({
      success: true,
      message: `Archivage ${type} effectué`,
      ...result
    });

  } catch (error) {
    console.error('❌ Erreur /log-archive/custom:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/log-archive/list - Lister les archives
router.get('/list', async (req, res) => {
  try {
    const type = req.query.type || 'audit'; // 'audit' ou 'linking'
    
    const archives = await logArchiveService.listArchives(type);
    
    res.json({
      success: true,
      count: archives.length,
      data: archives
    });

  } catch (error) {
    console.error('❌ Erreur /log-archive/list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/log-archive/read/:month/:filename - Lire une archive
router.get('/read/:month/:filename', async (req, res) => {
  try {
    const { month, filename } = req.params;
    
    const archive = await logArchiveService.readArchive(month, filename);
    
    res.json({
      success: true,
      data: archive
    });

  } catch (error) {
    console.error('❌ Erreur /log-archive/read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
