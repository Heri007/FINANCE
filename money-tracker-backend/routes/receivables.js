// routes/receivables.js - VERSION COMPLÈTE + JOI + ACID
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate'); // ✅ JOI
const { getAccountIds } = require('../config/accounts');

router.use(authMiddleware); // ✅ TOUTES LES ROUTES PROTÉGÉES

// GET sans body = OK
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM receivables
       WHERE status <> 'closed'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur get receivables:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ POST créer avoir (CRITIQUE - montants !)
router.post('/', validate('receivableCreate'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { person, description, amount, source_account_id } = req.body;
    const { AVOIR_ACCOUNT_ID } = getAccountIds();

    if (!AVOIR_ACCOUNT_ID) {
      await client.query('ROLLBACK');
      return res.status(500).json({ 
        error: 'Compte AVOIR non configuré (voir config/accounts.js)' 
      });
    }

    // 1) Créer l'avoir
    const insert = await client.query(
      `INSERT INTO receivables (account_id, person, description, amount, status, source_account_id)
       VALUES ($1, $2, $3, $4, 'open', $5)
       RETURNING *`,
      [AVOIR_ACCOUNT_ID, person, description || '', amount, source_account_id]
    );
    const receivable = insert.rows[0];

    // 2) Transaction de dépense source
    await client.query(
      `INSERT INTO transactions
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
       VALUES ($1, 'expense', $2, 'Avoir', $3, NOW()::date, true, false)`,
      [
        source_account_id,
        amount,
        `Avoir pour ${person}${description ? ' - ' + description : ''}`,
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
         WHERE account_id = $1 AND (is_posted = true OR is_planned = false)
       ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [source_account_id]
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

// ✅ PATCH mise à jour (hors paiement)
router.patch('/:id', validate('receivableUpdate'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { status, amount, description } = req.body;
    const { id } = req.params;

    const result = await client.query(
      `UPDATE receivables
       SET status = COALESCE($1, status),
           amount = COALESCE($2, amount),
           description = COALESCE($3, description),
           updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status || null, amount || null, description || null, id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Avoir introuvable' });
    }

    const accountId = result.rows[0].account_id;

    // Recalcul solde AVOIR
    await client.query(
      `UPDATE accounts SET balance = (
         SELECT COALESCE(SUM(amount), 0)
         FROM receivables WHERE account_id = $1 AND status <> 'closed'
       ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [accountId]
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

    const { rows } = await client.query(`SELECT * FROM receivables WHERE id = $1`, [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Avoir introuvable' });
    }
    const rec = rows[0];

    const { COFFRE_ACCOUNT_ID } = getAccountIds();
    if (!COFFRE_ACCOUNT_ID) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Compte COFFRE non configuré' });
    }

    // 1) Marquer payé
    await client.query(`UPDATE receivables SET status = 'closed', updated_at = NOW() WHERE id = $1`, [id]);

    // 2) Encaisser COFFRE
    await client.query(
      `INSERT INTO transactions
       (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
       VALUES ($1, 'income', $2, 'Remboursement Avoir', $3, NOW()::date, true, false)`,
      [COFFRE_ACCOUNT_ID, rec.amount, `Remboursement ${rec.person}${rec.description ? ' - ' + rec.description : ''}`]
    );

    // 3) Recalcul AVOIR
    await client.query(
      `UPDATE accounts SET balance = (
         SELECT COALESCE(SUM(amount), 0)
         FROM receivables WHERE account_id = $1 AND status <> 'closed'
       ), updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [rec.account_id]
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
    const { account_id, person, description, amount, status, source_account_id, created_at, updated_at } = req.body;
    const result = await pool.query(
      `INSERT INTO receivables
       (account_id, person, description, amount, status, source_account_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [account_id, person, description || '', amount, status || 'open', source_account_id || null, created_at || new Date(), updated_at || new Date()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur restore receivable:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
