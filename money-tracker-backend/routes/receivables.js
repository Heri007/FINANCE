// routes/receivables.js - VERSION CORRIGÉE ET OPTIMISÉE

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getAccountIds } = require('../config/accounts');

// Middleware global d'authentification
router.use(authMiddleware);

// Middleware de vérification des comptes spéciaux
router.use((req, res, next) => {
  const { RECEIVABLES_ACCOUNT_ID, COFFRE_ACCOUNT_ID } = getAccountIds();
  
  if (!RECEIVABLES_ACCOUNT_ID || !COFFRE_ACCOUNT_ID) {
    return res.status(500).json({
      success: false,
      error: 'Configuration système incomplète',
      details: 'Les comptes "Receivables" et "Coffre" doivent exister.',
      missing: {
        receivables: !RECEIVABLES_ACCOUNT_ID,
        coffre: !COFFRE_ACCOUNT_ID
      }
    });
  }
  
  next();
});

// GET tous les receivables ouverts
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM receivables
       WHERE user_id = $1 AND status <> 'closed'
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur get receivables:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST créer receivable
router.post('/', validate('receivableCreate'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { 
      person, 
      description, 
      amount, 
      sourceaccountid,
      source_account_id  
    } = req.body;

    // Accepter les deux formats (camelCase et snake_case)
    const finalSourceAccountId = sourceaccountid || source_account_id;

    if (!finalSourceAccountId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'source_account_id requis' });
    }

    const userId = req.user.id;
    const { RECEIVABLES_ACCOUNT_ID } = getAccountIds();

    // 1) Créer le receivable
    const insert = await client.query(
      `INSERT INTO receivables (account_id, person, description, amount, status, source_account_id, user_id)
       VALUES ($1, $2, $3, $4, 'open', $5, $6)
       RETURNING *`,
      [RECEIVABLES_ACCOUNT_ID, person, description || '', amount, finalSourceAccountId, userId]
    );

    const receivable = insert.rows[0];

    // 2) Transaction de dépense source
    await client.query(
      `INSERT INTO transactions
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned, user_id)
       VALUES ($1, 'expense', $2, 'Receivables', $3, NOW()::date, true, false, $4)`,
      [
        finalSourceAccountId,
        amount,
        `Receivable ${person}${description ? ' - ' + description : ''}`,
        userId
      ]
    );

    // 3) Recalcul solde source
    await client.query(
      `UPDATE accounts SET balance = (
         SELECT COALESCE(SUM(
           CASE WHEN type = 'income' THEN amount
                WHEN type = 'expense' THEN -amount
                ELSE 0 END
         ), 0)
         FROM transactions
         WHERE account_id = $1 AND user_id = $2 AND is_posted = true
       ), updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [finalSourceAccountId, userId]
    );

    await client.query('COMMIT');
    res.status(201).json(receivable);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur création receivable:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH mise à jour
router.patch('/:id', validate('receivableUpdate'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { status, amount, description } = req.body;
    const { id } = req.params;
    const userId = req.user.id;

    const result = await client.query(
      `UPDATE receivables
       SET status = COALESCE($1, status),
           amount = COALESCE($2, amount),
           description = COALESCE($3, description),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5 
       RETURNING *`,
      [status || null, amount || null, description || null, id, userId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receivable introuvable ou non autorisé' });
    }

    const accountId = result.rows[0].account_id;

    // Recalcul solde RECEIVABLES
    await client.query(
      `UPDATE accounts SET balance = (
         SELECT COALESCE(SUM(amount), 0)
         FROM receivables 
         WHERE account_id = $1 AND user_id = $2 AND status <> 'closed'
       ), updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur patch receivable:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /pay - Marquer un receivable comme payé
router.post('/:id/pay', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = req.user.id;
    
    // 1. Récupérer le receivable
    const { rows } = await client.query(
      `SELECT * FROM receivables WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receivable introuvable' });
    }
    
    const rec = rows[0];
    const { COFFRE_ACCOUNT_ID } = getAccountIds();
    
    // 2. Marquer comme payé
    await client.query(
      `UPDATE receivables SET status = 'closed', updated_at = NOW() 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    
    // 3. Créer transaction d'encaissement dans COFFRE
    await client.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned, user_id)
       VALUES ($1, 'income', $2, 'Remboursement Receivables', $3, NOW()::date, true, false, $4)`,
      [
        COFFRE_ACCOUNT_ID,
        rec.amount,
        `Remboursement ${rec.person}${rec.description ? ' - ' + rec.description : ''}`,
        userId
      ]
    );
    
    // 4. ✅ AJOUT : Recalculer le solde du COFFRE
    await client.query(
      `UPDATE accounts 
       SET balance = (
         SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
         FROM transactions
         WHERE account_id = $1 AND user_id = $2 AND is_posted = true
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [COFFRE_ACCOUNT_ID, userId]
    );
    
    // 5. Recalculer le solde RECEIVABLES
    await client.query(
      `UPDATE accounts 
       SET balance = (
         SELECT COALESCE(SUM(amount), 0)
         FROM receivables
         WHERE account_id = $1 AND user_id = $2 AND status = 'open'
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [rec.account_id, userId]
    );
    
    await client.query('COMMIT');
    res.json({ success: true });
    
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur pay receivable:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


// ✅ POST restore (backup)
router.post('/restore', validate('receivableRestore'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { account_id, person, description, amount, status, source_account_id, created_at, updated_at } = req.body;

    const result = await pool.query(
      `INSERT INTO receivables
       (account_id, person, description, amount, status, source_account_id, user_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [account_id, person, description || '', amount, status || 'open', source_account_id || null, userId, created_at || new Date(), updated_at || new Date()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur restore receivable:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
