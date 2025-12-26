// routes/projects.js - VERSION FINALE ULTRA-CORRIGÉE
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const projectsController = require('../controllers/projectController'); 
const { validate } = require('../middleware/validate');

router.use(authMiddleware);

// ============================================================================
// ✅ ROUTES GLOBALES (sans paramètres) EN PREMIER
// ============================================================================

// Lignes non payées/reçues (toutes projets)
router.get('/expense-lines/unpaid', projectsController.getUnpaidExpenses);
router.get('/revenue-lines/pending', projectsController.getPendingRevenues);

// ============================================================================
// ✅ ROUTES CRUD PROJETS
// ============================================================================

// Liste tous les projets
router.get('/', projectsController.getProjects);

// Créer un projet
router.post('/', validate('project'), projectsController.createProject);

// ============================================================================
// ✅ ROUTES AVEC PARAMÈTRES (/:id ou /:projectId)
// ============================================================================

// ---------- ROUTES STATUT ----------
router.patch('/:id/status', projectsController.updateProjectStatus);
router.patch('/:id/toggle-status', projectsController.toggleProjectActive);
router.post('/:id/archive', projectsController.archiveProject);
router.post('/:id/complete', projectsController.completeProject);
router.post('/:id/reactivate', projectsController.reactivateProject);

// ---------- ROUTES LIGNES SPÉCIFIQUES ----------

// Marquer lignes comme payées/reçues
router.patch('/:id/expense-lines/:lineId/mark-paid', projectsController.markExpenseLinePaid);
router.patch('/:id/revenue-lines/:lineId/mark-received', projectsController.markRevenueLineReceived);

// Annuler paiement/encaissement
router.patch('/:id/expense-lines/:lineId/cancel-payment', projectsController.cancelExpenseLinePayment);
router.patch('/:id/revenue-lines/:lineId/cancel-receipt', projectsController.cancelRevenueLineReceipt);

// Créer des lignes
router.post('/:id/expense-lines', projectsController.createExpenseLine);
router.post('/:id/revenue-lines', projectsController.createRevenueLine);

// Lister les lignes d'un projet
router.get('/:id/expense-lines', projectsController.getProjectExpenseLines);
router.get('/:id/revenue-lines', projectsController.getProjectRevenueLines);

// ---------- ROUTES CRUD PAR ID (TOUJOURS EN DERNIER) ----------
router.get('/:id', projectsController.getProjectById);
router.put('/:id', validate('project'), projectsController.updateProject);
router.delete('/:id', projectsController.deleteProject);

module.exports = router;
