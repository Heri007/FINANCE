// routes/projectMigration.js
const express = require('express');
const router = express.Router();
const ProjectMigrationService = require('../services/projectMigrationService');
const authMiddleware = require('../middleware/auth');

// 🔒 Protéger toutes les routes
router.use(authMiddleware);

// POST /api/project-migration/run
router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Migration API appelée par:', req.user?.id || 'unknown');
    
    // Optionnel: vérifier les droits administrateur
    const result = await ProjectMigrationService.migrateAllProjects();
    
    res.json({
      success: true,
      message: 'Migration terminée',
      data: result
    });
    
  } catch (error) {
    console.error('❌ Erreur migration API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/project-migration/status
router.get('/status', async (req, res) => {
  try {
    const status = await ProjectMigrationService.checkMigrationStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('❌ Erreur status API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;