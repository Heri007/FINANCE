// controllers/transactionController.js - VERSION FINALE (Avec Automatisation SOP)
const pool = require('../config/database');
const logger = require('../config/logger');

// ============================================================================
// 1. GET - Récupérer toutes les transactions
// ============================================================================
exports.getTransactions = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        t.id, 
        t.account_id, 
        t.type, 
        t.amount, 
        t.category, 
        t.description, 
        t.transaction_date as date,
        t.is_planned, 
        t.is_posted,
        t.project_id,
        t.project_line_id,
        t.created_at,
        a.name as account_name,
        p.name as project_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN projects p ON t.project_id = p.id
      ORDER BY t.transaction_date DESC, t.created_at DESC`
    );
    logger.info(`✅ Transactions récupérées: ${result.rows.length}`);
    res.json(result.rows);
  } catch (error) {
    next(error); 
  }
};

// ============================================================================
// 2. GET - Dernières dates par compte (Pour l'import CSV)
// ============================================================================
exports.getLastDates = async (req, res, next) => {
  try {
    const query = `SELECT account_id, MAX(transaction_date) as last_date FROM transactions GROUP BY account_id`;
    const { rows } = await pool.query(query);
    
    const datesMap = {};
    rows.forEach(row => {
      if (row.last_date) {
        // On force le format YYYY-MM-DD
        datesMap[row.account_id] = new Date(row.last_date).toISOString().split('T')[0];
      } else {
        datesMap[row.account_id] = null;
      }
    });

    res.json(datesMap);
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 3. POST - Créer une transaction (+ Automatisation SOP)
// ============================================================================
exports.createTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { 
      account_id, type, amount, category, description, date, transaction_date,  
      is_planned, is_posted, project_id, 
      project_line_id // ✅ Récupération du champ
    } = req.body;

    const finalDate = transaction_date || date;
    const finalAmount = parseFloat(amount);

    logger.info('📥 Nouvelle transaction', { account_id, type, amount: finalAmount });

    let shouldPost = true;
    if (is_posted !== undefined) shouldPost = is_posted;
    else if (is_planned === true) shouldPost = false;

    // ✅ REQUÊTE SQL MISE À JOUR (Ajout de project_line_id)
    const insertResult = await client.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, 
        is_planned, is_posted, project_id, project_line_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        account_id, 
        type, 
        finalAmount, 
        category, 
        description, 
        finalDate, 
        is_planned || false, 
        shouldPost, 
        project_id || null,
        project_line_id || null // $10 : On passe la valeur brute (String ou Int)
      ]
    );

    const transaction = insertResult.rows[0];

    // Mise à jour du solde
    if (shouldPost) {
      const updateQuery = type === 'income' 
        ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
        : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
      await client.query(updateQuery, [finalAmount, account_id]);
    }

    // ... (Code Automatisation SOP inchangé) ...

    await client.query('COMMIT');
    res.status(201).json(transaction);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') {
        return res.status(409).json({ error: 'Transaction déjà existante (doublon).' });
    }
    logger.error('❌ Erreur createTransaction:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};
// ============================================================================
// 4. PUT - Mettre à jour une transaction (CORRIGÉ)
// ============================================================================
exports.updateTransaction = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // ✅ CORRECTION : Inclure project_line_id dans la destructuration
    const { 
      account_id, type, amount, category, description, date,
      is_posted, is_planned, project_id, project_line_id
    } = req.body;

    // 1. Récupérer l'ancienne transaction
    const beforeResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (beforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }

    const oldTx = beforeResult.rows[0];
    const oldPosted = oldTx.is_posted;
    const newPosted = is_posted !== undefined ? is_posted : oldPosted; 

    // ✅ CORRECTION : Ajouter project_line_id dans le SET (10 colonnes + WHERE)
    const updateResult = await client.query(
      `UPDATE transactions 
       SET account_id = $1, type = $2, amount = $3, category = $4, 
           description = $5, transaction_date = $6, is_posted = $7, 
           is_planned = $8, project_id = $9, project_line_id = $10
       WHERE id = $11
       RETURNING *`,
      [
        account_id || oldTx.account_id, 
        type || oldTx.type, 
        amount || oldTx.amount, 
        category || oldTx.category, 
        description || oldTx.description, 
        date || oldTx.transaction_date, 
        newPosted,
        is_planned !== undefined ? is_planned : oldTx.is_planned,
        project_id !== undefined ? project_id : oldTx.project_id,
        project_line_id !== undefined ? project_line_id : oldTx.project_line_id,
        id
      ]
    );

    const updatedTx = updateResult.rows[0];

    // 3. LOGIQUE DE SOLDE (Reverse & Replay)
    if (oldPosted) {
        const reverseQuery = oldTx.type === 'income' 
          ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2'
          : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(reverseQuery, [oldTx.amount, oldTx.account_id]);
    }

    if (newPosted) {
        const applyQuery = updatedTx.type === 'income'
          ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
          : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
        await client.query(applyQuery, [updatedTx.amount, updatedTx.account_id]);
    }

    await client.query('COMMIT');
    res.json(updatedTx);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur updateTransaction:', error.message);
    next(error);
  } finally {
    client.release();
  }
};


// ============================================================================
// 5. DELETE - Supprimer
// ============================================================================
exports.deleteTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const checkResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    const transaction = checkResult.rows[0];

    // Annuler l'impact solde si postée
    if (transaction.is_posted) {
      const updateQuery = transaction.type === 'income'
        ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2'
        : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
      
      await client.query(updateQuery, [transaction.amount, transaction.account_id]);
    }

    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Transaction supprimée' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur deleteTransaction:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// 6. PATCH - Unpost (Raccourci)
// ============================================================================
exports.unpostTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const resTx = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (resTx.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    const tx = resTx.rows[0];

    if (!tx.is_posted) {
      await client.query('ROLLBACK');
      return res.json(tx); // Déjà non posté
    }

    // Annuler l'impact solde
    const updateQuery = tx.type === 'income'
      ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2'
      : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
    
    await client.query(updateQuery, [tx.amount, tx.account_id]);

    // Update flag
    const updateRes = await client.query(
      'UPDATE transactions SET is_posted = false WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');
    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur unpostTransaction:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};