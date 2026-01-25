// routes/backup.js - VERSION CORRIGÉE SELON SCHEMA.SQL
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');
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
// ✅ SCHEMAS JOI
// -----------------------------------------------------------------------------

const exportSchema = Joi.object({
  accounts: Joi.array().min(1).required(),
  transactions: Joi.array().min(1).required(),
  receivables: Joi.array().optional(),
  projects: Joi.array().optional(),
  project_expense_lines: Joi.array().optional(),
  project_revenue_lines: Joi.array().optional(),
  project_partners: Joi.array().optional(),
  profit_distributions: Joi.array().optional(),
  partner_payments: Joi.array().optional(),
  notes: Joi.array().optional(),
  visions: Joi.array().optional(),
  objectives: Joi.array().optional(),
  employees: Joi.array().optional(),
  label: Joi.string().max(100).allow('').optional()
}).unknown(true);

const restoreSchema = Joi.object({
  backup: Joi.object({
    version: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
    date: Joi.string().optional(),
    accounts: Joi.array().min(1).required(),
    transactions: Joi.array().min(1).required(),
    receivables: Joi.array().optional(),
    projects: Joi.array().optional(),
    project_expense_lines: Joi.array().optional(),
    project_revenue_lines: Joi.array().optional(),
    project_partners: Joi.array().optional(),
    profit_distributions: Joi.array().optional(),
    partner_payments: Joi.array().optional(),
    notes: Joi.array().optional(),
    visions: Joi.array().optional(),
    objectives: Joi.array().optional(),
    employees: Joi.array().optional(),
  }).required().unknown(true),
  options: Joi.object({
    dryRun: Joi.boolean(),
    includeProjects: Joi.boolean(),
    includeProjectLines: Joi.boolean()
  }).optional()
}).unknown(true);

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
      projects: backupData.projects?.length || 0,
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
// GET /api/backup/full-export - Export complet
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
      expenseLinesRes,
      revenueLinesRes,
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
      pool.query('SELECT * FROM project_expense_lines ORDER BY id'),
      pool.query('SELECT * FROM project_revenue_lines ORDER BY id'),
    ]);

    console.log(
      `📦 Export: ${accountsRes.rows.length} comptes, ${transactionsRes.rows.length} transactions, ${receivablesRes.rows.length} receivables, ${projectsRes.rows.length} projets, ${expenseLinesRes.rows.length} expense_lines, ${revenueLinesRes.rows.length} revenue_lines`
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
      project_expense_lines: expenseLinesRes.rows,
      project_revenue_lines: revenueLinesRes.rows,
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
    const includeProjects = options.includeProjects !== false;

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
      project_expense_lines = [],
      project_revenue_lines = [],
    } = backup;

    const summary = {
      accounts: accounts.length,
      transactions: transactions.length,
      receivables: receivables.length,
      projects: projects.length,
      expenseLines: project_expense_lines.length,
      revenueLines: project_revenue_lines.length,
      notes: notes.length,
      visions: visions.length,
      objectives: objectives.length,
      employees: employees.length,
      project_partners: project_partners.length,
      profit_distributions: profit_distributions.length,
      partner_payments: partner_payments.length,
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

// ====================================================================
// ÉTAPE 1 : SUPPRIMER dans le bon ordre (FK inverses)
// ====================================================================
console.log('🗑️ Suppression de TOUTES les données...');

await client.query('DELETE FROM partner_payments');
await client.query('DELETE FROM profit_distributions');
await client.query('DELETE FROM project_partners');
await client.query('DELETE FROM transactions');
await client.query('DELETE FROM project_revenue_lines');
await client.query('DELETE FROM project_expense_lines');
await client.query('DELETE FROM receivables');

if (includeProjects) {
  await client.query('DELETE FROM projects');
}

await client.query('DELETE FROM objectives');
await client.query('DELETE FROM visions');
await client.query('DELETE FROM notes');
await client.query('DELETE FROM employees');
await client.query('DELETE FROM accounts');

// ====================================================================
// ÉTAPE 2 : RESTAURER dans le bon ordre
// ====================================================================

// 2.1) Restaurer les comptes
console.log(`📦 Restauration de ${accounts.length} comptes...`);
for (const acc of accounts) {
  await client.query(
    `INSERT INTO accounts (id, name, balance, type, created_at, updated_at, user_id, last_import_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      acc.id,
      acc.name,
      acc.balance || 0,
      acc.type,
      acc.created_at || new Date(),
      acc.updated_at || new Date(),
      acc.user_id || 1,
      acc.last_import_date || null
    ]
  );
}

// 2.2) Restaurer les employés
if (employees.length > 0) {
  console.log(`📦 Restauration de ${employees.length} employés...`);
  for (const e of employees) {
    await client.query(
      `INSERT INTO employees
       (id, first_name, last_name, photo, position, department, email, phone,
        facebook, linkedin, location, salary, start_date, end_date, contract_type,
        status, skills, projects, emergency_contact, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        e.id, e.first_name, e.last_name, e.photo, e.position, e.department,
        e.email, e.phone, e.facebook, e.linkedin, e.location, e.salary || 0,
        e.start_date, e.end_date, e.contract_type, e.status || 'active',
        typeof e.skills === 'string' ? e.skills : JSON.stringify(e.skills || []),
        typeof e.projects === 'string' ? e.projects : JSON.stringify(e.projects || []),
        typeof e.emergency_contact === 'string' ? e.emergency_contact : JSON.stringify(e.emergency_contact || {}),
        e.notes, e.created_at || new Date(), e.updated_at || new Date()
      ]
    );
  }
}

// 2.3) Restaurer les projets
if (includeProjects && projects.length > 0) {
  console.log(`📦 Restauration de ${projects.length} projets...`);
  for (const p of projects) {
    await client.query(
      `INSERT INTO projects
       (id, name, description, type, status, start_date, end_date,
        frequency, occurrences_count, unit_volume, unit_label, price_per_unit, cost_per_unit,
        total_cost, total_revenues, net_profit, roi, profit_per_occurrence, margin_percent,
        break_even_units, feasible, remaining_budget, total_available,
        expenses, revenues, allocation, revenue_allocation, accounts_snapshot,
        activated_at, activated_transactions, created_at, updated_at, user_id, metadata,
        distribution_model, total_capital_investment, capital_fully_reimbursed, reimbursement_target_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)`,
      [
        p.id, p.name, p.description || '', p.type || 'ponctuel', p.status || 'draft',
        p.start_date, p.end_date, p.frequency, p.occurrences_count || 1,
        p.unit_volume, p.unit_label, p.price_per_unit, p.cost_per_unit,
        p.total_cost || 0, p.total_revenues || 0, p.net_profit || 0, p.roi || 0,
        p.profit_per_occurrence, p.margin_percent, p.break_even_units, p.feasible !== false,
        p.remaining_budget, p.total_available,
        typeof p.expenses === 'string' ? p.expenses : JSON.stringify(p.expenses || []),
        typeof p.revenues === 'string' ? p.revenues : JSON.stringify(p.revenues || []),
        typeof p.allocation === 'string' ? p.allocation : JSON.stringify(p.allocation || {}),
        typeof p.revenue_allocation === 'string' ? p.revenue_allocation : JSON.stringify(p.revenue_allocation || {}),
        typeof p.accounts_snapshot === 'string' ? p.accounts_snapshot : JSON.stringify(p.accounts_snapshot || {}),
        p.activated_at, p.activated_transactions || 0,
        p.created_at || new Date(), p.updated_at || new Date(), p.user_id || 1,
        typeof p.metadata === 'string' ? p.metadata : JSON.stringify(p.metadata || {}),
        p.distribution_model || 'weighted', p.total_capital_investment || 0,
        p.capital_fully_reimbursed || false, p.reimbursement_target_date
      ]
    );
  }
}

// 2.4) ✅ Restaurer expense_lines SANS transaction_id
if (project_expense_lines.length > 0) {
  console.log(`📦 Restauration de ${project_expense_lines.length} expense_lines (sans transaction_id)...`);
  for (const line of project_expense_lines) {
    await client.query(
      `INSERT INTO project_expense_lines
       (id, project_id, description, category, projected_amount, actual_amount,
        transaction_date, is_paid, created_at, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        line.id,
        line.project_id,
        line.description || '',
        line.category || 'Autre',
        line.projected_amount || 0,
        line.actual_amount || 0,
        line.transaction_date,
        line.is_paid || false,
        line.created_at || new Date(),
        line.last_synced_at || null
        // ✅ PAS de transaction_id ici
      ]
    );
  }
}

// 2.5) ✅ Restaurer revenue_lines SANS transaction_id
if (project_revenue_lines.length > 0) {
  console.log(`📦 Restauration de ${project_revenue_lines.length} revenue_lines (sans transaction_id)...`);
  for (const line of project_revenue_lines) {
    await client.query(
      `INSERT INTO project_revenue_lines
       (id, project_id, description, category, projected_amount, actual_amount,
        transaction_date, is_received, created_at, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        line.id,
        line.project_id,
        line.description || '',
        line.category || 'Autre',
        line.projected_amount || 0,
        line.actual_amount || 0,
        line.transaction_date,
        line.is_received || false,
        line.created_at || new Date(),
        line.last_synced_at || null
        // ✅ PAS de transaction_id ici
      ]
    );
  }
}

// 2.6) Restaurer les transactions
console.log(`📦 Restauration de ${transactions.length} transactions...`);
let skippedTransactions = 0;

for (const t of transactions) {
  if (!t.account_id) {
    console.warn(`⚠️ Transaction ${t.id} ignorée: account_id manquant`);
    skippedTransactions++;
    continue;
  }

  await client.query(
    `INSERT INTO transactions 
     (id, account_id, type, amount, category, description, transaction_date,
      created_at, is_planned, project_id, is_posted, updated_at, project_line_id,
      linked_at, linked_by, user_id, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      t.id, t.account_id, t.type, t.amount, t.category || null,
      t.description || '', t.transaction_date, t.created_at || new Date(),
      t.is_planned || false, t.project_id || null, t.is_posted !== false,
      t.updated_at || new Date(), t.project_line_id || null,
      t.linked_at || null, t.linked_by || null, t.user_id || 1, t.remarks || null
    ]
  );
}

if (skippedTransactions > 0) {
  console.warn(`⚠️ ${skippedTransactions} transactions invalides ignorées`);
}

// 2.7) ✅ UPDATE expense_lines avec transaction_id APRÈS insertion des transactions
if (project_expense_lines.length > 0) {
  console.log(`🔄 Mise à jour des transaction_id pour expense_lines...`);
  let updatedExpenseLines = 0;
  
  for (const line of project_expense_lines) {
    if (line.transaction_id) {
      await client.query(
        `UPDATE project_expense_lines SET transaction_id = $1 WHERE id = $2`,
        [line.transaction_id, line.id]
      );
      updatedExpenseLines++;
    }
  }
  
  if (updatedExpenseLines > 0) {
    console.log(`✅ ${updatedExpenseLines} expense_lines liées à des transactions`);
  }
}

// 2.8) ✅ UPDATE revenue_lines avec transaction_id APRÈS insertion des transactions
if (project_revenue_lines.length > 0) {
  console.log(`🔄 Mise à jour des transaction_id pour revenue_lines...`);
  let updatedRevenueLines = 0;
  
  for (const line of project_revenue_lines) {
    if (line.transaction_id) {
      await client.query(
        `UPDATE project_revenue_lines SET transaction_id = $1 WHERE id = $2`,
        [line.transaction_id, line.id]
      );
      updatedRevenueLines++;
    }
  }
  
  if (updatedRevenueLines > 0) {
    console.log(`✅ ${updatedRevenueLines} revenue_lines liées à des transactions`);
  }
}

// 2.9) Restaurer receivables
if (receivables.length > 0) {
  console.log(`📦 Restauration de ${receivables.length} receivables...`);
  let skippedReceivables = 0;

  for (const r of receivables) {
    if (!r.account_id) {
      console.warn(`⚠️ Receivable ${r.id} ignoré: account_id manquant`);
      skippedReceivables++;
      continue;
    }

    await client.query(
      `INSERT INTO receivables 
       (id, account_id, person, description, amount, status, created_at, updated_at, 
        source_account_id, target_account_id, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.id, r.account_id, r.person, r.description || '', r.amount,
        r.status || 'open', r.created_at || new Date(), r.updated_at || new Date(),
        r.source_account_id || null, r.target_account_id || null, r.user_id || 1
      ]
    );
  }

  if (skippedReceivables > 0) {
    console.warn(`⚠️ ${skippedReceivables} receivables invalides ignorés`);
  }
}

// 2.10) Restaurer notes, visions, objectives
if (notes.length > 0) {
  console.log(`📝 Restauration de ${notes.length} notes...`);
  for (const note of notes) {
    await client.query(
      `INSERT INTO notes (id, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4)`,
      [note.id, note.content || '', note.created_at || new Date(), note.updated_at || new Date()]
    );
  }
}

if (visions.length > 0) {
  console.log(`📦 Restauration de ${visions.length} visions...`);
  const normalizeValues = (raw) => {
    if (!raw) return '[]';
    if (Array.isArray(raw)) return JSON.stringify(raw);
    if (typeof raw === 'object') return JSON.stringify(raw);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return JSON.stringify(parsed);
      } catch {
        return JSON.stringify([raw]);
      }
    }
    return '[]';
  };

  for (const v of visions) {
    await client.query(
      `INSERT INTO visions (id, content, mission, values, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        v.id, v.content || '', v.mission || '', normalizeValues(v.values),
        v.created_at || new Date(), v.updated_at || new Date()
      ]
    );
  }
}

if (objectives.length > 0) {
  console.log(`📦 Restauration de ${objectives.length} objectifs...`);
  for (const o of objectives) {
    await client.query(
      `INSERT INTO objectives
       (id, title, description, category, deadline, budget, progress, completed, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        o.id, o.title, o.description || '', o.category || 'short', o.deadline,
        o.budget || 0, o.progress || 0, o.completed || false,
        o.created_at || new Date(), o.updated_at || new Date()
      ]
    );
  }
}

// 2.11) Restaurer project_partners, distributions, payments
if (project_partners.length > 0) {
  console.log(`📦 Restauration de ${project_partners.length} associés...`);
  for (const partner of project_partners) {
    await client.query(
      `INSERT INTO project_partners
       (id, project_id, partner_name, partner_role, capital_contribution,
        contribution_percentage, phase1_percentage, phase2_percentage,
        is_capital_investor, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        partner.id, partner.project_id, partner.partner_name, partner.partner_role,
        partner.capital_contribution || 0, partner.contribution_percentage || 0,
        partner.phase1_percentage || 0, partner.phase2_percentage || 0,
        partner.is_capital_investor || false,
        partner.created_at || new Date(), partner.updated_at || new Date()
      ]
    );
  }
}

if (profit_distributions.length > 0) {
  console.log(`📦 Restauration de ${profit_distributions.length} distributions...`);
  for (const dist of profit_distributions) {
    await client.query(
      `INSERT INTO profit_distributions
       (id, project_id, distribution_period, period_start_date, period_end_date,
        total_revenue, total_costs, profit_to_distribute, distribution_phase,
        capital_reimbursed_cumulative, reimbursement_percentage, is_distributed,
        distribution_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        dist.id, dist.project_id, dist.distribution_period,
        dist.period_start_date, dist.period_end_date,
        dist.total_revenue || 0, dist.total_costs || 0, dist.profit_to_distribute || 0,
        dist.distribution_phase, dist.capital_reimbursed_cumulative || 0,
        dist.reimbursement_percentage || 0, dist.is_distributed || false,
        dist.distribution_date, dist.created_at || new Date(), dist.updated_at || new Date()
      ]
    );
  }
}

if (partner_payments.length > 0) {
  console.log(`📦 Restauration ${partner_payments.length} paiements...`);
  for (const p of partner_payments) {
    await client.query(
      `INSERT INTO partner_payments
       (id, distribution_id, partner_id, partner_name, amount_allocated,
        percentage_applied, is_paid, payment_date, payment_account_id,
        notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        p.id, p.distribution_id, p.partner_id, p.partner_name,
        p.amount_allocated || 0, p.percentage_applied || 0, p.is_paid || false,
        p.payment_date, p.payment_account_id, p.notes,
        p.created_at || new Date(), p.updated_at || new Date()
      ]
    );
  }
}

// 2.12) Reset séquences
console.log('🔄 Reset séquences...');
await client.query(`SELECT setval('accounts_id_seq', COALESCE((SELECT MAX(id) FROM accounts), 1))`);
await client.query(`SELECT setval('transactions_id_seq', COALESCE((SELECT MAX(id) FROM transactions), 1))`);
await client.query(`SELECT setval('receivables_id_seq', COALESCE((SELECT MAX(id) FROM receivables), 1))`);

if (includeProjects) {
  await client.query(`SELECT setval('projects_id_seq', COALESCE((SELECT MAX(id) FROM projects), 1))`);
  await client.query(`SELECT setval('project_expense_lines_id_seq', COALESCE((SELECT MAX(id) FROM project_expense_lines), 1))`);
  await client.query(`SELECT setval('project_revenue_lines_id_seq', COALESCE((SELECT MAX(id) FROM project_revenue_lines), 1))`);
}

await client.query(`SELECT setval('notes_id_seq', COALESCE((SELECT MAX(id) FROM notes), 1))`);
await client.query(`SELECT setval('visions_id_seq', COALESCE((SELECT MAX(id) FROM visions), 1))`);
await client.query(`SELECT setval('objectives_id_seq', COALESCE((SELECT MAX(id) FROM objectives), 1))`);
await client.query(`SELECT setval('employees_id_seq', COALESCE((SELECT MAX(id) FROM employees), 1))`);
await client.query(`SELECT setval('project_partners_id_seq', COALESCE((SELECT MAX(id) FROM project_partners), 1))`);
await client.query(`SELECT setval('profit_distributions_id_seq', COALESCE((SELECT MAX(id) FROM profit_distributions), 1))`);
await client.query(`SELECT setval('partner_payments_id_seq', COALESCE((SELECT MAX(id) FROM partner_payments), 1))`);

await client.query('COMMIT');
console.log('✅ Restauration committée');

// 2.13) Recalculer tous les soldes
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
module.exports = router;

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
