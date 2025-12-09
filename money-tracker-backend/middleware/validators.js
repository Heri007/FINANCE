// middleware/validators.js
const { body, validationResult } = require('express-validator');

exports.validateTransaction = [
  body('account_id').isInt().withMessage('ID compte invalide'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Montant invalide'),
  body('type').isIn(['income', 'expense']).withMessage('Type invalide'),
  body('date').isISO8601().withMessage('Date invalide'),  // ✅ Changé
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Express-validator errors:', errors.array());  // ✅ Debug
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];


exports.validateProject = [
  body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Nom invalide'),
  body('start_date').isISO8601().withMessage('Date début invalide'),
  // ... autres validations
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
