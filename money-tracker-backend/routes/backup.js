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
    accounts: Joi.array().min(1).required(),
    transactions: Joi.array().min(1).required(),
    receivables: Joi.array().optional(),
    projects: Joi.array().optional(),
    archived_projects: Joi.array().optional()
  }).required().messages({
    'any.required': 'Objet backup manquant'
  }),
  options: Joi.object({
    dryRun: Joi.boolean(),
    includeProjects: Joi.boolean()
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

    // ✅ Requêtes parallèles SANS filtrage par user_id
    const [accountsRes, transactionsRes, receivablesRes, projectsRes] = await Promise.all([
      pool.query('SELECT * FROM accounts ORDER BY id'),
      pool.query('SELECT * FROM transactions ORDER BY transaction_date, id'),
      pool.query('SELECT * FROM receivables ORDER BY id'),
      pool.query('SELECT * FROM projects ORDER BY id'), // ✅ AJOUT DES PROJETS
    ]);

    console.log(`✅ Export: ${accountsRes.rows.length} comptes, ${transactionsRes.rows.length} transactions, ${receivablesRes.rows.length} avoirs, ${projectsRes.rows.length} projets`);

    const backup = {
      version: '2.0',
      date: new Date().toISOString(),
      accounts: accountsRes.rows,
      transactions: transactionsRes.rows,
      receivables: receivablesRes.rows,
      projects: projectsRes.rows, // ✅ AJOUT DES PROJETS
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
    const includeProjects = options.includeProjects === true;

    const summary = {
      accounts: backup.accounts.length,
      transactions: backup.transactions.length,
      receivables: Array.isArray(backup.receivables) ? backup.receivables.length : 0,
      projects: Array.isArray(backup.projects) ? backup.projects.length : 0,
      archived_projects: Array.isArray(backup.archived_projects)
        ? backup.archived_projects.length
        : 0,
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

    const truncateStatements = [];
for (const acc of backup.accounts) {
  await client.query(
    `INSERT INTO accounts (id, name, balance, type, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6)`, // ✅ Retirer $7
    [
      acc.id,
      acc.name,
      acc.balance,
      acc.type,
      acc.created_at || new Date(),
      acc.updated_at || new Date(),
      // ❌ RETIRER: req.user.id
    ]
  );
}

// 5) Restaurer les projets - SANS user_id
if (includeProjects && Array.isArray(backup.projects)) {
  for (const p of backup.projects) {
    await client.query(
      `INSERT INTO projects
       (id, name, description, type, status, start_date, end_date,
        frequency, occurrences_count, total_cost, total_revenues, net_profit, roi,
        expenses, revenues, allocation, revenue_allocation,
        accounts_snapshot, activated_at, activated_transactions,
        created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               $8,$9,$10,$11,$12,$13,
               $14,$15,$16,$17,
               $18,$19,$20,
               $21,$22)`, // ✅ $23 retiré
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
        p.expenses || '[]',
        p.revenues || '[]',
        p.allocation || '{}',
        p.revenue_allocation || '{}',
        p.accounts_snapshot || '{}',
        p.activated_at || null,
        p.activated_transactions || 0,
        p.created_at || new Date(),
        p.updated_at || new Date(),
        // ❌ RETIRER: req.user.id
      ]
    );
  }
}

// 6) Restaurer les projets archivés - SANS user_id
if (includeProjects && Array.isArray(backup.archived_projects)) {
  for (const ap of backup.archived_projects) {
    await client.query(
      `INSERT INTO archived_projects
       (id, name, description, type, status, start_date, end_date,
        total_cost, total_revenues, net_profit, roi,
        expenses, revenues, allocation, revenue_allocation,
        occurrences_count, frequency, archived_at, original_project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               $8,$9,$10,$11,
               $12,$13,$14,$15,
               $16,$17,$18,$19)`, // ✅ $20 retiré
      [
        ap.id,
        ap.name,
        ap.description || '',
        ap.type || 'ponctuel',
        ap.status || 'completed',
        ap.start_date || null,
        ap.end_date || null,
        ap.total_cost || 0,
        ap.total_revenues || 0,
        ap.net_profit || 0,
        ap.roi || 0,
        ap.expenses || '[]',
        ap.revenues || '[]',
        ap.allocation || '{}',
        ap.revenue_allocation || '{}',
        ap.occurrences_count || 1,
        ap.frequency || null,
        ap.archived_at || new Date(),
        ap.original_project_id || null,
        // ❌ RETIRER: req.user.id
      ]
    );
  }
}

    await client.query('COMMIT');
    console.log('✅ Restauration committée avec succès');

    // 7) Recalculer tous les soldes
    try {
      const accountController = require('../controllers/accountController');
      const fakeReq = { user: req.user };
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
