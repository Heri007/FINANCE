// routes/transactions.js - FINAL
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const importController = require('../controllers/importController');
const authenticateToken = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Joi = require('joi');

// Schéma de validation pour une SEULE transaction
// ✅ AJOUTÉ
// routes/transactions.js - CORRIGÉ
const transactionSchema = Joi.object({
  accountid: Joi.number().integer().required(),        // ✅ Sans underscore (PostgreSQL)
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transaction_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: Joi.number().required(),
  type: Joi.string().valid('income', 'expense', 'transfer').required(),
  description: Joi.string().allow('', null).optional(),
  category: Joi.string().allow('', null).optional(),
  isplanned: Joi.boolean().default(false),             // ✅ Sans underscore
  isposted: Joi.boolean().default(true),               // ✅ Sans underscore
  projectid: Joi.number().integer().allow(null).optional(),  // ✅ Sans underscore
  projectlineid: Joi.string().allow(null).optional(),  // ✅ Sans underscore
  remarks: Joi.string().allow('', null).optional()
})
.or('date', 'transaction_date');


// Schéma pour l'import (tableau de transactions)
const importSchema = Joi.object({
  transactions: Joi.array().items(transactionSchema).min(1).required()
});

// Routes CRUD classiques
router.get('/', authenticateToken, transactionController.getTransactions);
router.get('/last-dates', authenticateToken, transactionController.getLastDates);
router.post('/', authenticateToken, validate(transactionSchema), transactionController.createTransaction);
router.put('/:id', authenticateToken, validate(transactionSchema), transactionController.updateTransaction);
router.patch('/:id/unpost', authenticateToken, transactionController.unpostTransaction);
router.delete('/:id', authenticateToken, transactionController.deleteTransaction);

// Route d'import avec validation spécifique
router.post('/import', authenticateToken, validate(importSchema), importController.importTransactions);

module.exports = router;
