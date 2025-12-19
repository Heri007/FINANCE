// routes/projects.js - VERSION CORRIGÉE
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const projectsController = require('../controllers/projectController'); 
const { validate } = require('../middleware/validate');

router.use(authMiddleware);

// ============================================================================
// ROUTES PROJETS PRINCIPALES
// ============================================================================

router.get('/', projectsController.getProjects);
router.get('/:id', projectsController.getProjectById);
router.delete('/:id', projectsController.deleteProject);

// ✅ POST/PUT avec validation
router.post('/', validate('project'), projectsController.createProject);
router.put('/:id', validate('project'), projectsController.updateProject);

// ============================================================================
// ROUTES STATUT (sans validation complète)
// ============================================================================

// ✅ PATCH simple pour changer uniquement le statut
router.patch('/:id/status', projectsController.updateProjectStatus);
 

// Routes statut existantes
router.post('/:id/update-status', projectsController.updateProjectStatus);
router.patch('/:id/toggle-status', projectsController.toggleProjectActive);
router.post('/:id/archive', projectsController.archiveProject);
router.post('/:id/complete', projectsController.completeProject);
router.post('/:id/reactivate', projectsController.reactivateProject);

module.exports = router;
