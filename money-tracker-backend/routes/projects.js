// routes/projects.js - VERSION FINALE CORRIGÉE
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const projectsController = require('../controllers/projectController'); 
const { validate } = require('../middleware/validate');

router.use(authMiddleware);

// ============================================================================
// ✅ ROUTES SANS PARAMÈTRES EN PREMIER (très important !)
// ============================================================================

// Routes pour les lignes non payées/reçues (AVANT /:id)
router.get('/expense-lines/unpaid', projectsController.getUnpaidExpenses);
router.get('/revenue-lines/pending', projectsController.getPendingRevenues);

// ============================================================================
// ✅ ROUTES POUR MARQUER LIGNES COMME PAYÉES/REÇUES
// ============================================================================

// ✅ CORRECTION : Enlever "/projects/" car déjà dans le mount path
router.patch(
  '/:projectId/expense-lines/:lineId/mark-paid',
  projectsController.markExpenseLinePaid
);

router.patch(
  '/:projectId/revenue-lines/:lineId/mark-received',
  projectsController.markRevenueLineReceived
);

router.patch(
  '/:projectId/expense-lines/:lineId/cancel-payment',
  projectsController.cancelExpenseLinePayment
);

router.patch(
  '/:projectId/revenue-lines/:lineId/cancel-receipt',
  projectsController.cancelRevenueLineReceipt
);

// ============================================================================
// ROUTES PROJETS PRINCIPALES
// ============================================================================

// Liste de tous les projets
router.get('/', projectsController.getProjects);

// ✅ POST/PUT avec validation
router.post('/', validate('project'), projectsController.createProject);

// ============================================================================
// ✅ ROUTES AVEC PARAMÈTRES APRÈS (/:id doit être en dernier)
// ============================================================================

// Routes statut
router.patch('/:id/status', projectsController.updateProjectStatus);
router.patch('/:id/toggle-status', projectsController.toggleProjectActive);
router.post('/:id/update-status', projectsController.updateProjectStatus);
router.post('/:id/archive', projectsController.archiveProject);
router.post('/:id/complete', projectsController.completeProject);
router.post('/:id/reactivate', projectsController.reactivateProject);

// Routes lignes spécifiques à un projet
router.get('/:id/expense-lines', projectsController.getProjectExpenseLines);
router.get('/:id/revenue-lines', projectsController.getProjectRevenueLines);
router.post('/:projectId/expense-lines', projectsController.createExpenseLine);

// CRUD projet par ID
router.get('/:id', projectsController.getProjectById);
router.put('/:id', validate('project'), projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);

module.exports = router;
