const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/projectPartnerController');

// CRUD Associés
router.post('/projects/:projectId/partners', partnerController.addPartner);
router.get('/projects/:projectId/partners', partnerController.getPartners);
router.put('/partners/:partnerId', partnerController.updatePartner);
router.delete('/partners/:partnerId', partnerController.deletePartner);

module.exports = router;