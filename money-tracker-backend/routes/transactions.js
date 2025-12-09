// routes/transactions.js - FINAL
const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const importController = require('../controllers/importController');
const authenticateToken = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Joi = require('joi');

// Schéma de validation pour une SEULE transaction
const transactionSchema = Joi.object({
  account_id: Joi.number().integer().required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),               // ✅ Optionnel
  transaction_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),   // ✅ Optionnel
  amount: Joi.number().required(),
  type: Joi.string().valid('income', 'expense', 'transfer').required(),
  description: Joi.string().allow('', null).optional(),
  category: Joi.string().allow('', null).optional(),
  is_planned: Joi.boolean().default(false),
  is_posted: Joi.boolean().default(true),
  project_id: Joi.number().integer().allow(null).optional(),
  remarks: Joi.string().allow('', null).optional()  // ✅ Ajouté
})
.or('date', 'transaction_date');  // ✅ Au moins un des deux requis

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
