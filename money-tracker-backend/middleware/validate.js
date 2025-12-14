// middleware/validate.js
const Joi = require('joi');

// ✅ Forcer la suppression du cache module
delete require.cache[require.resolve('joi')];

console.log('🔵🔵🔵 VALIDATE.JS CHARGÉ - VERSION COMPLÈTE AVEC UUID STRING 🔵🔵🔵');

const schemas = {
  // ✅ 1. COMPTES
  account: Joi.object({
    name: Joi.string()
      .trim()
      .min(2).max(100)
      .pattern(/^[a-zA-Z0-9\s\-_àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+$/)
      .required()
      .messages({
        'string.min': 'Nom trop court (≥2 caractères)',
        'string.max': 'Nom trop long (≤100 caractères)',
        'string.pattern.base': 'Nom invalide (lettres, chiffres, espaces, -, _)'
      }),
    balance: Joi.number()
      .min(-999999999)
      .max(999999999)
      .precision(2)
      .optional()
      .messages({
        'number.min': 'Solde trop bas',
        'number.max': 'Solde trop élevé (≤999M)'
      }),
    type: Joi.string()
      .valid('cash', 'bank', 'mobile', 'credit', 'digital')
      .required()
      .messages({
        'any.only': 'Type invalide (cash|bank|mobile|credit|digital)'
      })
  }),

// ✅ 2. TRANSACTIONS (VERSION DÉBLOQUÉE)
  transaction: Joi.object({
    account_id: Joi.number().required(),
    type: Joi.string().valid('income', 'expense', 'transfer').required(),
    amount: Joi.number().required(),
    category: Joi.string().required(),
    description: Joi.string().allow('', null).optional(),
    
    // Dates
    date: Joi.string().optional(),
    transaction_date: Joi.string().optional(),
    
    is_planned: Joi.boolean().optional(),
    is_posted: Joi.boolean().optional(),
    related_account_id: Joi.any().optional(),
    
    project_id: Joi.number().allow(null).optional(),
    
    // 🚨 CORRECTION ICI : On autorise TOUT pour éviter le blocage "must be a number"
    project_line_id: Joi.any().optional(), 
    
    remarks: Joi.string().allow('', null).optional(),
    receivable_id: Joi.any().optional()
  })
  .or('date', 'transaction_date')
  .unknown(true), // IMPORTANT : Accepte les champs supplémentaires

  // ✅ 3. PROJETS
  project: Joi.object({
    name: Joi.string().trim().min(3).max(255).required(),
    
    type: Joi.string().valid(
      'ponctuel', 'recurrent', 
      'PRODUCTFLIP', 'LIVESTOCK', 'FISHING', 'REALESTATE', 'VEHICLE', 'EXPORT', 'OTHER'
    ).required(),
    
    description: Joi.string().allow('', null).optional(),
    
    status: Joi.string().valid(
      'draft', 'active', 'completed', 'archived', 'paused', 'cancelled'
    ).default('draft'),
    
    startDate: Joi.alternatives().try(
      Joi.date().iso(), 
      Joi.string().allow('', null)
    ).optional(),
    
    endDate: Joi.alternatives().try(
      Joi.date().iso(), 
      Joi.string().allow('', null)
    ).optional(),
    
    frequency: Joi.string().allow(null, '').optional(),
    occurrencesCount: Joi.number().integer().min(1).optional().default(1),
    
    // Accepter Array OU String JSON
    expenses: Joi.alternatives().try(Joi.array(), Joi.string().allow('')).optional().default('[]'),
    revenues: Joi.alternatives().try(Joi.array(), Joi.string().allow('')).optional().default('[]'),
    
    // Nombres financiers
    totalCost: Joi.number().allow(null).optional().default(0),
    totalRevenues: Joi.number().allow(null).optional().default(0),
    netProfit: Joi.number().allow(null).optional().default(0),
    roi: Joi.number().allow(null).optional().default(0),
    remainingBudget: Joi.number().allow(null).optional().default(0),
    totalAvailable: Joi.number().allow(null).optional().default(0),
    
    // Objets JSON
    allocation: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null).optional(),
    revenueAllocation: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null).optional(),
    revenue_allocation: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null).optional()
  }),

  // ✅ 4. AUTH (PIN)
  pin: Joi.object({
    pin: Joi.string().pattern(/^\d{6}$/).required()
      .messages({
        'string.pattern.base': 'Le PIN doit contenir exactement 6 chiffres'
      })
  }),

  // ✅ 5. SETTINGS
  settings: Joi.object({
    isMasked: Joi.boolean().optional(),
    autoLockMinutes: Joi.number().integer().min(1).max(60).optional(),
    currency: Joi.string().valid('Ar', 'USD', 'EUR').optional()
  }),

  // ✅ 6. RECEIVABLES
  receivableCreate: Joi.object({
    person: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().max(500).allow('', null).optional(),
    amount: Joi.number().min(0.01).precision(2).required(),
    source_account_id: Joi.number().integer().positive().required()
  }),

  receivableUpdate: Joi.object({
    status: Joi.string().valid('open', 'closed', 'partial').optional(),
    amount: Joi.number().min(0.01).precision(2).optional(),
    description: Joi.string().max(500).allow('', null).optional()
  }),
  // ✅ AJOUTER CECI dans middleware/validate.js
  receivableRestore: Joi.object({
    account_id: Joi.number().integer().required(),
    person: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().allow('', null).optional(),
    amount: Joi.number().required(),
    status: Joi.string().valid('open', 'closed', 'partial').optional(),
    source_account_id: Joi.number().integer().optional().allow(null),
    created_at: Joi.any().optional(),
    updated_at: Joi.any().optional()
  }).unknown(true), // .unknown(true) est important pour accepter les champs de backup

  // ✅ 7. SOPs
  sop: Joi.object({
    title: Joi.string().trim().min(3).max(255).required(),
    description: Joi.string().max(1000).allow(null, '').optional(),
    owner: Joi.string().max(100).allow(null, '').optional(),
    steps: Joi.array().default([]).optional(),
    avg_time: Joi.number().integer().min(1).max(365).allow(null).optional(),
    status: Joi.string().valid('draft', 'active', 'archived', 'planned').default('draft').optional(),
    category: Joi.string().max(100).allow(null, '').optional(),
    checklist: Joi.array().default([]).optional()
  }),

  // ✅ 8. TASKS
  task: Joi.object({
    title: Joi.string().trim().min(3).max(255).required(),
    description: Joi.string().max(1000).allow(null, '').optional(),
    priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium').optional(),
    due_date: Joi.date().iso().required(),
    assigned_to: Joi.string().max(100).allow(null, '').optional(),
    status: Joi.string().valid('todo', 'in-progress', 'done', 'blocked').default('todo').optional(),
    sop_id: Joi.number().integer().positive().allow(null).optional(),
    category: Joi.string().max(100).allow(null, '').optional()
  })
};

// Middleware de validation
const validate = (schemaOrKey) => {
  return (req, res, next) => {
    const schema = typeof schemaOrKey === 'string' ? schemas[schemaOrKey] : schemaOrKey;

    if (!schema || typeof schema.validate !== 'function') {
      console.error('❌ Schema invalide:', schemaOrKey);
      return res.status(500).json({ 
        message: 'Erreur de configuration de validation',
        error: 'Schema invalide' 
      });
    }

    // Debug
    console.log('🔍 Validation body:', JSON.stringify(req.body, null, 2));

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,      // Retourner TOUTES les erreurs
      stripUnknown: true,     // Retirer les champs inconnus
      convert: true           // Convertir les types automatiquement
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));
      
      console.error('❌ Validation échouée:', JSON.stringify(errors, null, 2));
      
      return res.status(400).json({
        message: 'Validation échouée',
        errors
      });
    }

    console.log('✅ Validation réussie');
    // Remplacer req.body par la valeur validée
    req.body = value;
    next();
  };
};

module.exports = { validate, schemas };