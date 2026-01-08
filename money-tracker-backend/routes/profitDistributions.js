const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/profitDistributionController');

// Générer les distributions
router.post('/projects/:projectId/distributions/generate', 
  distributionController.generateDistributions);

// Liste des distributions
router.get('/projects/:projectId/distributions', 
  distributionController.getDistributions);

// Détail d'une distribution avec paiements
router.get('/distributions/:distributionId', 
  distributionController.getDistributionDetail);

// Payer un associé
router.post('/distributions/:distributionId/pay-partner/:partnerId', 
  distributionController.payPartner);

module.exports = router;