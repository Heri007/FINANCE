// middleware/validate.js - VERSION FINALE COMPLÈTE + SOPs + Tasks
const Joi = require('joi');

const schemas = {
  // ✅ 1. COMPTES
  account: Joi.object({
    name: Joi.string()
      .trim()
      .min(2).max(100)
      .pattern(/^[a-zA-Z0-9\s\-_]+$/)
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

  // ✅ 2. TRANSACTIONS (Support date ET transaction_date)
  transaction: Joi.object({
    account_id: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'number.base': 'account_id doit être un nombre',
        'number.integer': 'account_id doit être un entier',
        'number.positive': 'account_id doit être positif',
        'any.required': 'account_id obligatoire'
      }),
    
    type: Joi.string()
      .valid('income', 'expense')
      .required()
      .messages({
        'any.only': 'type doit être "income" ou "expense"',
        'any.required': 'type obligatoire'
      }),
    
    amount: Joi.number()
      .min(0.01)
      .max(999999999)
      .precision(2)
      .required()
      .messages({
        'number.min': 'Montant minimum 0.01 Ar',
        'number.max': 'Montant maximum 999M Ar',
        'number.precision': '2 décimales maximum',
        'any.required': 'Montant obligatoire'
      }),
    
    category: Joi.string()
      .trim()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': 'Catégorie minimum 1 caractère',
        'string.max': 'Catégorie maximum 100 caractères',
        'any.required': 'Catégorie obligatoire'
      }),
    
    description: Joi.string()
      .max(500)
      .allow('')
      .optional(),
    
    // ✅ Accepte soit date, soit transaction_date
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    transaction_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    
    is_planned: Joi.boolean().optional(),
    is_posted: Joi.boolean().optional(),
    project_id: Joi.number().integer().min(1).optional().allow(null),
    remarks: Joi.string().max(1000).allow('').optional()
  }).or('date', 'transaction_date'), // ✅ Au moins un des deux requis

  // ✅ 3. PROJETS
  project: Joi.object({
    name: Joi.string().trim().min(3).max(255).required(),
    type: Joi.string().valid('ponctuel', 'recurrent').required(),
    description: Joi.string().allow('').optional(),
    status: Joi.string().valid('draft', 'active', 'completed', 'archived').optional(),
    startDate: Joi.date().iso().allow(null).optional(),
    endDate: Joi.date().iso().allow(null).optional(),
    frequency: Joi.string().allow(null).optional(),
    occurrencesCount: Joi.number().integer().min(1).optional(),
    expenses: Joi.array().optional(),
    revenues: Joi.array().optional(),
    totalCost: Joi.number().optional(),
    totalRevenues: Joi.number().optional(),
    netProfit: Joi.number().optional(),
    roi: Joi.number().optional(),
    allocation: Joi.object().optional(),
    revenueAllocation: Joi.object().optional(),
    revenue_allocation: Joi.object().optional(),
  }),

  // ✅ 4. AUTH (PIN)
  pin: Joi.object({
    pin: Joi.string()
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'string.pattern.base': 'PIN doit être 6 chiffres exactement',
        'any.required': 'PIN obligatoire'
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
    person: Joi.string().trim().min(1).max(100).required()
      .messages({ 'string.min': 'Nom personne obligatoire' }),
    description: Joi.string().max(500).allow('').optional(),
    amount: Joi.number().min(0.01).precision(2).required()
      .messages({ 'number.min': 'Montant minimum 0.01 Ar' }),
    source_account_id: Joi.number().integer().positive().required()
  }),

  receivableUpdate: Joi.object({
    status: Joi.string().valid('open', 'closed', 'partial').optional(),
    amount: Joi.number().min(0.01).precision(2).optional(),
    description: Joi.string().max(500).allow('').optional()
  }),

  receivableRestore: Joi.object({
    account_id: Joi.number().integer().positive().required(),
    person: Joi.string().min(1).max(100).required(),
    description: Joi.string().allow('').optional(),
    amount: Joi.number().min(0.01).precision(2).required(),
    status: Joi.string().valid('open', 'closed').optional(),
    source_account_id: Joi.number().integer().optional().allow(null),
    created_at: Joi.date().iso().optional(),
    updated_at: Joi.date().iso().optional()
  }),

  // ✅ 7. SOPs (Standard Operating Procedures)
  sop: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(255)
      .required()
      .messages({
        'string.min': 'Titre trop court (≥3 caractères)',
        'string.max': 'Titre trop long (≤255 caractères)',
        'any.required': 'Titre obligatoire'
      }),
    
    description: Joi.string()
      .max(1000)
      .allow(null, '')
      .optional(),
    
    owner: Joi.string()
      .max(100)
      .allow(null, '')
      .optional(),
    
    steps: Joi.array()
      .items(Joi.object({
        order: Joi.number().integer().min(1).optional(),
        title: Joi.string().required(),
        description: Joi.string().allow('').optional(),
        duration: Joi.string().optional()
      }))
      .default([])
      .optional(),
    
    avg_time: Joi.number()
      .integer()
      .min(1)
      .max(365)
      .allow(null)
      .optional()
      .messages({
        'number.min': 'Durée minimum 1 jour',
        'number.max': 'Durée maximum 365 jours'
      }),
    
    status: Joi.string()
      .valid('draft', 'active', 'archived', 'planned')
      .default('draft')
      .optional()
      .messages({
        'any.only': 'Statut invalide (draft|active|archived|planned)'
      }),
    
    category: Joi.string()
      .max(100)
      .allow(null, '')
      .optional(),
    
    checklist: Joi.array()
      .items(Joi.object({
        item: Joi.string().required(),
        required: Joi.boolean().default(false).optional()
      }))
      .default([])
      .optional()
  }),

  // ✅ 8. TASKS
  task: Joi.object({
    title: Joi.string()
      .trim()
      .min(3)
      .max(255)
      .required()
      .messages({
        'string.min': 'Titre trop court (≥3 caractères)',
        'string.max': 'Titre trop long (≤255 caractères)',
        'any.required': 'Titre obligatoire'
      }),
    
    description: Joi.string()
      .max(1000)
      .allow(null, '')
      .optional(),
    
    priority: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('medium')
      .optional()
      .messages({
        'any.only': 'Priorité invalide (low|medium|high|critical)'
      }),
    
    due_date: Joi.date()
      .iso()
      .required()
      .messages({
        'date.base': 'Date invalide (format ISO requis)',
        'any.required': 'Date d\'échéance obligatoire'
      }),
    
    assigned_to: Joi.string()
      .max(100)
      .allow(null, '')
      .optional(),
    
    status: Joi.string()
      .valid('todo', 'in-progress', 'done', 'blocked')
      .default('todo')
      .optional()
      .messages({
        'any.only': 'Statut invalide (todo|in-progress|done|blocked)'
      }),
    
    sop_id: Joi.number()
      .integer()
      .positive()
      .allow(null)
      .optional()
      .messages({
        'number.positive': 'sop_id doit être un nombre positif'
      }),
    
    category: Joi.string()
      .max(100)
      .allow(null, '')
      .optional()
  })
};

const validate = (schemaOrKey) => {
  return (req, res, next) => {
    // ✅ Accepte soit un string ('account') soit un objet Joi directement
    const schema = typeof schemaOrKey === 'string' ? schemas[schemaOrKey] : schemaOrKey;

    if (!schema || typeof schema.validate !== 'function') {
      console.error('❌ Schema invalide:', schemaOrKey);
      return res.status(500).json({ 
        message: 'Erreur de configuration de validation',
        error: 'Schema invalide' 
      });
    }

    console.log('🔍 Validation du body:', JSON.stringify(req.body, null, 2));

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      console.error('❌ Erreur de validation:', JSON.stringify(errors, null, 2));
      
      return res.status(400).json({
        message: 'Validation échouée',
        errors
      });
    }

    req.body = value;
    next();
  };
};

module.exports = { validate, schemas };
