// routes/backup.js - VERSION COMPLÈTE + VALIDATION JOI INTÉGRÉE
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database'); // ✅ Import correct
const Joi = require('joi');

// Créer le dossier backup s'il n'existe pas
const BACKUP_DIR = path.join(__dirname, '..', 'backup');

async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    console.log('📁 Dossier backup créé:', BACKUP_DIR);
  }
}

// Import du middleware auth
const authenticateToken =
  require('../middleware/auth').authenticateToken || require('../middleware/auth');

// -----------------------------------------------------------------------------
// ✅ SCHEMAS JOI (Définis localement pour ce fichier spécifique)
// -----------------------------------------------------------------------------

const exportSchema = Joi.object({
  accounts: Joi.array().min(1).required().messages({
    'array.min': 'Au moins 1 compte requis',
    'any.required': 'accounts est obligatoire'
  }),
  transactions: Joi.array().min(1).required().messages({
    'array.min': 'Au moins 1 transaction requise',
    'any.required': 'transactions est obligatoire'
  }),
  receivables: Joi.array().optional(),
  projects: Joi.array().optional(),
  archived_projects: Joi.array().optional(),
  label: Joi.string().max(100).allow('').optional().messages({
    'string.max': 'Label trop long (max 100 car.)'
  })
}).unknown(true);

const restoreSchema = Joi.object({
  backup: Joi.object({
    version: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    date: Joi.string().optional(),
    accounts: Joi.array().min(1).required().messages({
      'array.min': 'Au moins 1 compte requis',
      'any.required': 'accounts est obligatoire'
    }),
    transactions: Joi.array().min(1).required().messages({
      'array.min': 'Au moins 1 transaction requise',
      'any.required': 'transactions est obligatoire'
    }),
    receivables: Joi.array().optional(),
    projects: Joi.array().optional(),
    archived_projects: Joi.array().optional()
  }).required().unknown(true).messages({ // ✅ .unknown(true) pour accepter les champs supplémentaires
    'any.required': 'Objet backup manquant'
  }),
  options: Joi.object({
    dryRun: Joi.boolean(),
    includeProjects: Joi.boolean()
  }).optional()
}).unknown(true); // ✅ Accepter d'autres champs à la racine

// -----------------------------------------------------------------------------
// POST /api/backup/export - Créer et sauvegarder un backup
// -----------------------------------------------------------------------------
router.post('/export', authenticateToken, async (req, res) => {
  const { error } = exportSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ 
      error: 'Format de backup invalide', 
      details: error.details.map(d => d.message) 
    });
  }

  try {
    await ensureBackupDir();
    const backupData = req.body;

    const safeLabel = (backupData.label || '')
      .toString()
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '_');

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = safeLabel
      ? `moneytracker_backup_${timestamp}_${safeLabel}.json`
      : `moneytracker_backup_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('✅ Backup créé:', filepath);

    res.json({
      success: true,
      filename,
      path: filepath,
      label: backupData.label || null,
      accounts: backupData.accounts.length,
      transactions: backupData.transactions.length,
      projects: backupData.projects?.length || 0, // ✅ Ajout
    });
  } catch (error) {
    console.error('❌ Erreur création backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /api/backup/save - Sauvegarder un backup uploadé
// -----------------------------------------------------------------------------
router.post('/save', authenticateToken, async (req, res) => {
  const { error } = exportSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ 
      error: 'Format de backup invalide', 
      details: error.details.map(d => d.message) 
    });
  }

  try {
    await ensureBackupDir();
    const backupData = req.body;

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `backup_restore_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('✅ Backup uploadé sauvegardé:', filepath);

    res.json({
      success: true,
      filename,
      path: filepath,
      accounts: backupData.accounts.length,
      transactions: backupData.transactions.length,
    });
  } catch (error) {
    console.error('❌ Erreur sauvegarde backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/backup/list - Lister tous les backups disponibles
// -----------------------------------------------------------------------------
router.get('/list', authenticateToken, async (req, res) => {
  try {
    await ensureBackupDir();
    const files = await fs.readdir(BACKUP_DIR);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(filepath);

      let label = null;
      try {
        const content = await fs.readFile(filepath, 'utf8');
        const parsed = JSON.parse(content);
        label = parsed.label || null;
      } catch {
        // Fichiers anciens ou invalides : pas de label
      }

      backups.push({
        filename: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        label,
      });
    }

    backups.sort((a, b) => b.created - a.created);

    res.json({
      success: true,
      count: backups.length,
      backups,
    });
  } catch (error) {
    console.error('❌ Erreur listage backups:', error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GET /api/backup/full-export - Export complet (accounts + transactions + receivables + projects)
// ✅ VERSION SANS USER_ID (pour application mono-utilisateur)
// -----------------------------------------------------------------------------
router.get('/full-export', authenticateToken, async (req, res) => {
  try {
    console.log('📦 Full export demandé');

    const [
      accountsRes,
      transactionsRes,
      receivablesRes,
      projectsRes,
      notesRes,
      visionsRes,
      objectivesRes,
      employeesRes,
      partnersRes,
      distributionsRes,
      paymentsRes,
    ] = await Promise.all([
      pool.query('SELECT * FROM accounts ORDER BY id'),
      pool.query('SELECT * FROM transactions ORDER BY transaction_date, id'),
      pool.query('SELECT * FROM receivables ORDER BY id'),
      pool.query('SELECT * FROM projects ORDER BY id'),
      pool.query('SELECT * FROM notes ORDER BY id'),
      pool.query('SELECT * FROM visions ORDER BY id'),
      pool.query('SELECT * FROM objectives ORDER BY id'),
      pool.query('SELECT * FROM employees ORDER BY id'),
      pool.query('SELECT * FROM project_partners ORDER BY id'),
      pool.query('SELECT * FROM profit_distributions ORDER BY id'),
      pool.query('SELECT * FROM partner_payments ORDER BY id'),
    ]);

    console.log(
      `📦 Export: ${accountsRes.rows.length} comptes, ${transactionsRes.rows.length} transactions, ${receivablesRes.rows.length} receivables, ${projectsRes.rows.length} projets, ${notesRes.rows.length} notes, ${visionsRes.rows.length} visions, ${objectivesRes.rows.length} objectifs, ${employeesRes.rows.length} employés, ${partnersRes.rows.length} associés, ${distributionsRes.rows.length} distributions, ${paymentsRes.rows.length} paiements`
    );

    const backup = {
      version: '2.2',
      date: new Date().toISOString(),
      accounts: accountsRes.rows,
      transactions: transactionsRes.rows,
      receivables: receivablesRes.rows,
      projects: projectsRes.rows,
      notes: notesRes.rows,
      visions: visionsRes.rows,
      objectives: objectivesRes.rows,
      employees: employeesRes.rows,
      project_partners: partnersRes.rows,
      profit_distributions: distributionsRes.rows,
      partner_payments: paymentsRes.rows,
    };

    res.json(backup);
  } catch (err) {
    console.error('❌ Erreur full-export:', err);
    res.status(500).json({ 
      error: err.message, 
      details: err.stack 
    });
  }
});

// -----------------------------------------------------------------------------
// GET /api/backup/:filename - Télécharger un backup précis
// -----------------------------------------------------------------------------
router.get('/:filename', authenticateToken, async (req, res) => {
  try {
    await ensureBackupDir();
    const { filename } = req.params;

    if (!filename.endsWith('.json') || filename.includes('..')) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const filepath = path.join(BACKUP_DIR, filename);

    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Backup introuvable' });
    }

    res.download(filepath, filename);
  } catch (error) {
    console.error('❌ Erreur téléchargement backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// POST /api/backup/restore-full - Restaurer la base depuis un full JSON
// -----------------------------------------------------------------------------
router.post('/restore-full', authenticateToken, async (req, res) => {
  const { error } = restoreSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ 
      error: 'Backup invalide pour restauration', 
      details: error.details.map(d => d.message) 
    });
  }

  const client = await pool.connect();
  try {
    const { backup, options = {} } = req.body;
    const dryRun = options.dryRun === true;
    const includeProjects = options.includeProjects !== false; // ✅ Par défaut true
    const userId = 1; // ✅ FORCER user_id = 1 (app mono-utilisateur)

        const {
  accounts,
  transactions,
  receivables = [],
  projects = [],
  notes = [],
  visions = [],
  objectives = [],
  employees = [],
  project_partners = [],         
  profit_distributions = [],    
  partner_payments = [],        
} = backup;


    const summary = {
  accounts: backup.accounts.length,
  transactions: backup.transactions.length,
  receivables: Array.isArray(backup.receivables) ? backup.receivables.length : 0,
  projects: Array.isArray(backup.projects) ? backup.projects.length : 0,
  archived_projects: Array.isArray(backup.archived_projects)
    ? backup.archived_projects.length
    : 0,
  notes: Array.isArray(backup.notes) ? backup.notes.length : 0,
  visions: Array.isArray(backup.visions) ? backup.visions.length : 0,          // ✅ Corrigé
  objectives: Array.isArray(backup.objectives) ? backup.objectives.length : 0,
  employees: employees.length,
  includeProjects,
  dryRun,
};

    if (dryRun) {
      return res.json({
        success: true,
        mode: 'dryRun',
        message: 'Backup valide, aucune écriture effectuée',
        summary,
      });
    }
    await client.query('BEGIN');

    // 1) SUPPRIMER les données (SANS filtrer par user_id pour tout effacer)
   console.log('🗑️ Suppression de TOUTES les données...');
  await client.query('DELETE FROM partner_payments');       
  await client.query('DELETE FROM profit_distributions');   
  await client.query('DELETE FROM project_partners');       
  await client.query('DELETE FROM transactions');
  await client.query('DELETE FROM receivables');
  if (includeProjects) {
  await client.query('DELETE FROM projects');
  }
  await client.query('DELETE FROM objectives'); 
  await client.query('DELETE FROM visions');    
  await client.query('DELETE FROM accounts');
  await client.query('DELETE FROM employees');

    // 2) Restaurer les comptes
    console.log(`📦 Restauration de ${backup.accounts.length} comptes...`);
    for (const acc of backup.accounts) {
      await client.query(
        `INSERT INTO accounts (id, name, balance, type, created_at, updated_at, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`, // ✅ Ignorer les doublons
        [
          acc.id,
          acc.name,
          acc.balance || 0,
          acc.type,
          acc.created_at || new Date(),
          acc.updated_at || new Date(),
          1, // ✅ Toujours user_id = 1
        ]
      );
    }

    // 3) Restaurer les transactions
    console.log(`📦 Restauration de ${backup.transactions.length} transactions...`);
    for (const t of backup.transactions) {
      await client.query(
        `INSERT INTO transactions 
         (id, account_id, type, amount, category, description, transaction_date, created_at, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id,
          t.account_id,
          t.type,
          t.amount,
          t.category || null,
          t.description || '',
          t.transaction_date || t.date,
          t.created_at || new Date(),
          1, // ✅ Toujours user_id = 1
        ]
      );
    }

    // 4) Restaurer les receivables
if (Array.isArray(backup.receivables) && backup.receivables.length > 0) {
  console.log(`📦 Restauration de ${backup.receivables.length} receivables...`);
  for (const r of backup.receivables) {
    await client.query(
      `INSERT INTO receivables 
       (id, account_id, person, amount, description, status, created_at, updated_at, source_account_id, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        r.account_id,
        r.person,
        r.amount,
        r.description || '',
        r.status || 'open',
        r.created_at || new Date(),
        r.updated_at || new Date(),
        r.source_account_id || null,
        1, // user_id
      ]
    );
  }
}

    // 5) Restaurer les projets
if (includeProjects && Array.isArray(backup.projects) && backup.projects.length > 0) {
  console.log(`📦 Restauration de ${backup.projects.length} projets...`);
  for (const p of backup.projects) {
    // ✅ Helper function pour parser les JSON (si string, parser; sinon retourner tel quel)
    const parseJSON = (value, defaultValue = '{}') => {
      if (!value) return defaultValue;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return defaultValue;
        }
      }
      return value; // Déjà un objet
    };

    await client.query(
      `INSERT INTO projects
       (id, name, description, type, status, start_date, end_date,
        frequency, occurrences_count, total_cost, total_revenues, net_profit, roi,
        expenses, revenues, allocation, revenue_allocation,
        accounts_snapshot, activated_at, activated_transactions,
        created_at, updated_at, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               $8,$9,$10,$11,$12,$13,
               $14,$15,$16,$17,
               $18,$19,$20,
               $21,$22,$23)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.name,
        p.description || '',
        p.type || 'ponctuel',
        p.status || 'draft',
        p.start_date || null,
        p.end_date || null,
        p.frequency || null,
        p.occurrences_count || 1,
        p.total_cost || 0,
        p.total_revenues || 0,
        p.net_profit || 0,
        p.roi || 0,
        JSON.stringify(parseJSON(p.expenses, '[]')),        // ✅ Toujours string JSON
        JSON.stringify(parseJSON(p.revenues, '[]')),        // ✅ Toujours string JSON
        JSON.stringify(parseJSON(p.allocation, '{}')),      // ✅ Toujours string JSON
        JSON.stringify(parseJSON(p.revenue_allocation, '{}')), // ✅ Toujours string JSON
        JSON.stringify(parseJSON(p.accounts_snapshot, '{}')), // ✅ Toujours string JSON
        p.activated_at || null,
        p.activated_transactions || 0,
        p.created_at || new Date(),
        p.updated_at || new Date(),
        1, // user_id
      ]
    );
  }
}
    // ✅ 5.5️⃣ Restaurer les notes
    if (Array.isArray(backup.notes) && backup.notes.length > 0) {
      console.log(`📝 Restauration de ${backup.notes.length} notes...`);
      
      for (const note of backup.notes) {
        await client.query(
          `INSERT INTO notes (id, content, created_at, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET 
             content = EXCLUDED.content,
             updated_at = EXCLUDED.updated_at`,
          [
            note.id,
            note.content || '',
            note.created_at || new Date(),
            note.updated_at || new Date()
          ]
        );
      }
    }

    // 5bis) Restaurer les visions
if (Array.isArray(backup.visions) && backup.visions.length > 0) {
  console.log(`📦 Restauration de ${backup.visions.length} visions...`);

  // Helper local
  const normalizeValues = (raw) => {
    if (!raw) return '[]';                // valeur par défaut
    if (Array.isArray(raw)) return JSON.stringify(raw);
    if (typeof raw === 'object') return JSON.stringify(raw);
    // si c'est une string, on tente de parser, sinon on l’emballe dans un tableau
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed);
      } catch {
        // "TEST5" -> ["TEST5"]
        return JSON.stringify([raw]);
      }
    }
    return '[]';
  };

  for (const v of backup.visions) {
    await client.query(
      `INSERT INTO visions (id, content, mission, values, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [
        v.id,
        v.content || '',
        v.mission || '',
        normalizeValues(v.values),         // 👈 ici
        v.created_at || new Date(),
        v.updated_at || new Date()
      ]
    );
  }
}

// 5ter) Restaurer les objectifs
if (Array.isArray(backup.objectives) && backup.objectives.length > 0) {
  console.log(`📦 Restauration de ${backup.objectives.length} objectifs...`);
  for (const o of backup.objectives) {
    await client.query(
      `INSERT INTO objectives
       (id, title, description, category, deadline, budget, progress, completed, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        o.id,
        o.title,
        o.description || '',
        o.category || 'short',
        o.deadline || null,
        o.budget || 0,
        o.progress || 0,
        o.completed || false,
        o.created_at || new Date(),
        o.updated_at || new Date()
      ]
    );
  }
}

// 5quinquies) Restaurer les employés
if (Array.isArray(employees) && employees.length > 0) {
  console.log(`📦 Restauration de ${employees.length} employés...`);
  for (const e of employees) {
    await client.query(
      `INSERT INTO employees
       (id, full_name, role, salary, status, hired_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        e.id,
        e.full_name || e.name || '',
        e.role || '',
        e.salary || 0,
        e.status || 'active',
        e.hired_at || null,
        e.created_at || new Date(),
        e.updated_at || new Date(),
      ]
    );
  }
}

    // 5sexies) Restaurer les associés de projets
if (Array.isArray(project_partners) && project_partners.length > 0) {
  console.log(`📦 Restauration de ${project_partners.length} associés...`);
  for (const partner of project_partners) {
    await client.query(
      `INSERT INTO project_partners
       (id, project_id, name, phase1_percentage, phase2_percentage, 
        is_main_investor, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        partner.id,
        partner.project_id,
        partner.name,
        partner.phase1_percentage || 0,
        partner.phase2_percentage || 0,
        partner.is_main_investor || false,
        partner.created_at || new Date(),
        partner.updated_at || new Date(),
      ]
    );
  }
}

// 5septies) Restaurer les distributions de profits
if (Array.isArray(profit_distributions) && profit_distributions.length > 0) {
  console.log(`📦 Restauration de ${profit_distributions.length} distributions...`);
  for (const dist of profit_distributions) {
    await client.query(
      `INSERT INTO profit_distributions
       (id, project_id, period, start_date, end_date, 
        total_profit, is_reimbursement_phase, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        dist.id,
        dist.project_id,
        dist.period,
        dist.start_date,
        dist.end_date,
        dist.total_profit || 0,
        dist.is_reimbursement_phase || false,
        dist.created_at || new Date(),
      ]
    );
  }
}

// 5octies) Restaurer les paiements aux associés
if (Array.isArray(partner_payments) && partner_payments.length > 0) {
  console.log(`📦 Restauration de ${partner_payments.length} paiements...`);
  for (const payment of partner_payments) {
    await client.query(
      `INSERT INTO partner_payments
       (id, distribution_id, partner_id, amount, transaction_id, 
        paid_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO NOTHING`,
      [
        payment.id,
        payment.distribution_id,
        payment.partner_id,
        payment.amount || 0,
        payment.transaction_id || null,
        payment.paid_at || null,
        payment.created_at || new Date(),
      ]
    );
  }
}

    // 6) Reset des séquences PostgreSQL
await client.query(`SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts))`);
await client.query(`SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions))`);
await client.query(`SELECT setval('receivables_id_seq', (SELECT MAX(id) FROM receivables))`);
if (includeProjects) {
  await client.query(`SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects))`);
}
await client.query(`SELECT setval('visions_id_seq', (SELECT MAX(id) FROM visions))`);
await client.query(`SELECT setval('objectives_id_seq', (SELECT MAX(id) FROM objectives))`);
await client.query(`SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees))`);
await client.query(`SELECT setval('project_partners_id_seq', (SELECT MAX(id) FROM project_partners))`);
await client.query(`SELECT setval('profit_distributions_id_seq', (SELECT MAX(id) FROM profit_distributions))`);
await client.query(`SELECT setval('partner_payments_id_seq', (SELECT MAX(id) FROM partner_payments))`);

await client.query('COMMIT');

console.log('✅ Restauration committée avec succès');

    // 7) Recalculer tous les soldes
    try {
      const accountController = require('../controllers/accountController');
      const fakeReq = { user: { user_id: 1 } };
      const fakeRes = { 
        status: () => fakeRes, 
        json: (data) => {
          console.log('✅ Recalcul des soldes effectué:', data);
        }
      };
      await accountController.recalculateAllBalances(fakeReq, fakeRes);
    } catch (recalcErr) {
      console.warn('⚠️ Erreur recalcul soldes (non bloquant):', recalcErr.message);
    }

    res.json({
      success: true,
      message: 'Base restaurée depuis le backup et soldes recalculés',
      summary,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur restore-full:', err);
    res.status(500).json({ 
      error: err.message,
      details: err.stack 
    });
  } finally {
    client.release();
  }
});

// -----------------------------------------------------------------------------
// POST /api/backup/validate-full - Valider la structure du JSON de backup
// -----------------------------------------------------------------------------
router.post('/validate-full', authenticateToken, async (req, res) => {
  const { error } = restoreSchema.validate({ backup: req.body }, { abortEarly: false });
  
  try {
    const backup = req.body;
    const errors = [];
    const warnings = [];

    // Erreur Joi structurelle ?
    if (error) {
      error.details.forEach(d => errors.push(d.message));
    }

    if (!backup || typeof backup !== 'object') {
      if (errors.length === 0) errors.push('Body vide ou non objet');
    } else {
      // Validation fine des comptes
      if (Array.isArray(backup.accounts)) {
        backup.accounts.forEach((acc, idx) => {
          if (acc.id == null) errors.push(`accounts[${idx}].id manquant`);
          if (!acc.name) errors.push(`accounts[${idx}].name manquant`);
          if (acc.type == null) errors.push(`accounts[${idx}].type manquant`);
          if (acc.created_at == null)
            warnings.push(`accounts[${idx}].created_at manquant (sera remplacé)`);
          if (acc.updated_at == null)
            warnings.push(`accounts[${idx}].updated_at manquant (sera remplacé)`);
        });
      }

      // Validation fine des transactions
      if (Array.isArray(backup.transactions)) {
        const accountIds = new Set((backup.accounts || []).map(a => a.id));
        backup.transactions.forEach((t, idx) => {
          if (t.id == null) errors.push(`transactions[${idx}].id manquant`);
          if (t.account_id == null) {
            errors.push(`transactions[${idx}].account_id manquant`);
          } else if (!accountIds.has(t.account_id)) {
            errors.push(`transactions[${idx}].account_id=${t.account_id} n'existe pas dans accounts`);
          }
          
          if (!t.type) errors.push(`transactions[${idx}].type manquant`);
          if (t.amount == null) errors.push(`transactions[${idx}].amount manquant`);
          if (!t.transaction_date) errors.push(`transactions[${idx}].transaction_date manquant`);
        });
      }

      // Validation des receivables
      if (Array.isArray(backup.receivables)) {
        const accountIds = new Set((backup.accounts || []).map(a => a.id));
        backup.receivables.forEach((r, idx) => {
          if (r.id == null) warnings.push(`receivables[${idx}].id manquant`);
          if (r.account_id == null) {
            errors.push(`receivables[${idx}].account_id manquant`);
          } else if (!accountIds.has(r.account_id)) {
            errors.push(`receivables[${idx}].account_id=${r.account_id} n'existe pas dans accounts`);
          }
          if (!r.person) errors.push(`receivables[${idx}].person manquant`);
          if (r.amount == null) errors.push(`receivables[${idx}].amount manquant`);
        });
      }

      // Validation des projets
      if (Array.isArray(backup.projects)) {
        backup.projects.forEach((p, idx) => {
          if (p.id == null) warnings.push(`projects[${idx}].id manquant`);
          if (!p.name) errors.push(`projects[${idx}].name manquant`);
          if (!p.type) warnings.push(`projects[${idx}].type manquant (défaut: ponctuel)`);
        });
      }
    }

    const valid = errors.length === 0;

    return res.json({
      valid,
      errors,
      warnings,
      counts: {
        accounts: backup?.accounts?.length || 0,
        transactions: backup?.transactions?.length || 0,
        receivables: backup?.receivables?.length || 0,
        projects: backup?.projects?.length || 0,
        archived_projects: backup?.archived_projects?.length || 0,
        project_partners: backup?.project_partners?.length || 0,           
        profit_distributions: backup?.profit_distributions?.length || 0,   
        partner_payments: backup?.partner_payments?.length || 0,           
      },
    });
  } catch (err) {
    console.error('❌ Erreur validate-full:', err);
    res.status(500).json({ 
      valid: false, 
      errors: [err.message],
      stack: err.stack 
    });
  }
});

module.exports = router;
