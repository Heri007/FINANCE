// routes/receivables.js - VERSION COMPLÈTE + user_id

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { getAccountIds } = require('../config/accounts');

router.use(authMiddleware);

// GET tous les receivables ouverts
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    // Test 1 : SANS filtre
    const testAll = await pool.query('SELECT COUNT(*) FROM receivables');

    // Test 2 : Avec filtre user_id
    const testUserId = await pool.query(
      'SELECT COUNT(*) FROM receivables WHERE user_id = $1',
      [userId]
    );

    // Test 3 : Avec filtre status
    const testStatus = await pool.query(
      'SELECT COUNT(*) FROM receivables WHERE user_id = $1 AND status <> \'closed\'',
      [userId]
    );

    // Requête finale
    const result = await pool.query(
      `SELECT * FROM receivables
       WHERE user_id = $1 AND status <> 'closed'
       ORDER BY created_at DESC`,
      [userId]
    );

    if (result.rows.length > 0) {
      console.log('✅ Receivables trouvés:', result.rows.length);
    }

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

    const { person, description, amount, source_account_id } = req.body;
    const userId = req.user.id;

    const { RECEIVABLES_ACCOUNT_ID } = getAccountIds();

    if (!RECEIVABLES_ACCOUNT_ID) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: 'Compte RECEIVABLES non configuré (voir config/accounts.js)'
      });
    }

    // 1) Créer le receivable
    const insert = await client.query(
      `INSERT INTO receivables (account_id, person, description, amount, status, source_account_id, user_id)
       VALUES ($1, $2, $3, $4, 'open', $5, $6)
       RETURNING *`,
      [RECEIVABLES_ACCOUNT_ID, person, description || '', amount, source_account_id, userId]
    );

    const receivable = insert.rows[0];

    // 2) Transaction de dépense source
    await client.query(
      `INSERT INTO transactions
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned, user_id)
       VALUES ($1, 'expense', $2, 'Receivables', $3, NOW()::date, true, false, $4)`,
      [
        source_account_id,
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
         WHERE account_id = $1 AND user_id = $2 AND (is_posted = true OR is_planned = false)
       ), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [source_account_id, userId]
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
       WHERE id = $4 AND user_id = $5 RETURNING *`,
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
         FROM receivables WHERE account_id = $1 AND user_id = $2 AND status <> 'closed'
       ), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
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

// ✅ POST /pay (sans body = OK)
router.post('/:id/pay', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const userId = req.user.id;

    const { rows } = await client.query(
      `SELECT * FROM receivables WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Receivable introuvable ou non autorisé' });
    }

    const rec = rows[0];

    const { COFFRE_ACCOUNT_ID } = getAccountIds();

    if (!COFFRE_ACCOUNT_ID) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Compte COFFRE non configuré' });
    }

    // 1) Marquer payé
    await client.query(
      `UPDATE receivables SET status = 'closed', updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    // 2) Encaisser COFFRE (avec user_id)
    await client.query(
      `INSERT INTO transactions
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned, user_id)
       VALUES ($1, 'income', $2, 'Remboursement Receivables', $3, NOW()::date, true, false, $4)`,
      [COFFRE_ACCOUNT_ID, rec.amount, `Remboursement ${rec.person}${rec.description ? ' - ' + rec.description : ''}`, userId]
    );

    // 3) Recalcul RECEIVABLES (avec user_id)
    await client.query(
      `UPDATE accounts SET balance = (
         SELECT COALESCE(SUM(amount), 0)
         FROM receivables WHERE account_id = $1 AND user_id = $2 AND status <> 'closed'
       ), updated_at = CURRENT_TIMESTAMP
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
