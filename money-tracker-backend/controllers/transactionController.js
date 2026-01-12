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
        t.destination_account_id,
        t.created_at,
        a.name as account_name,
        dest_acc.name as destination_account_name,
        p.name as project_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       LEFT JOIN accounts dest_acc ON t.destination_account_id = dest_acc.id
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
      account_id,
      type, 
      amount, 
      category, 
      description, 
      transaction_date,
      is_planned,
      is_posted, 
      project_id,
      project_line_id,
      destination_account_id  // ✅ NOUVEAU
    } = req.body;

    const finalAmount = parseFloat(amount);
    logger.info('📥 Nouvelle transaction', { account_id, type, amount: finalAmount });

    // ✅ VALIDATION POUR TRANSFERT
    if (type === 'transfer') {
      if (!destination_account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'destination_account_id requis pour un transfert' });
      }
      if (account_id === destination_account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Les comptes source et destination doivent être différents' });
      }
    }

    let shouldPost = true;
    if (is_posted !== undefined) shouldPost = is_posted;
    else if (is_planned === true) shouldPost = false;

    // Insérer la transaction
    const insertResult = await client.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, 
        is_planned, is_posted, project_id, project_line_id, destination_account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        account_id,
        type, 
        finalAmount, 
        category, 
        description, 
        transaction_date, 
        is_planned || false, 
        shouldPost, 
        project_id || null,
        project_line_id || null,
        destination_account_id || null  // ✅ NOUVEAU
      ]
    );

    const transaction = insertResult.rows[0];

    // ✅ LOGIQUE DE MISE À JOUR DES SOLDES
    if (shouldPost) {
      if (type === 'transfer') {
        // Débiter le compte source
        await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
          [finalAmount, account_id]
        );
        // Créditer le compte destination
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
          [finalAmount, destination_account_id]
        );
        logger.info(`✅ Transfert: ${finalAmount} Ar de compte ${account_id} → ${destination_account_id}`);
      } else {
        // Logique existante pour income/expense
        const updateQuery = type === 'income' 
          ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
          : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
        await client.query(updateQuery, [finalAmount, account_id]);
      }
    }

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
    
    const { 
      account_id, 
      type, 
      amount, 
      category, 
      description, 
      transaction_date,
      is_posted, 
      is_planned, 
      project_id, 
      project_line_id,
      destination_account_id  // ✅ NOUVEAU
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

    // ✅ VALIDATION POUR TRANSFERT
    if (type === 'transfer' || oldTx.type === 'transfer') {
      if (type === 'transfer' && !destination_account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'destination_account_id requis pour un transfert' });
      }
      if (type === 'transfer' && account_id === destination_account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Les comptes source et destination doivent être différents' });
      }
    }

    // 2. Mettre à jour la transaction
    const updateResult = await client.query(
      `UPDATE transactions 
       SET account_id = $1, type = $2, amount = $3, category = $4, 
           description = $5, transaction_date = $6, is_posted = $7, 
           is_planned = $8, project_id = $9, project_line_id = $10,
           destination_account_id = $11
       WHERE id = $12
       RETURNING *`,
      [
        account_id || oldTx.account_id, 
        type || oldTx.type, 
        amount || oldTx.amount, 
        category || oldTx.category, 
        description || oldTx.description, 
        transaction_date || oldTx.transaction_date, 
        newPosted,
        is_planned !== undefined ? is_planned : oldTx.is_planned,
        project_id !== undefined ? project_id : oldTx.project_id,
        project_line_id !== undefined ? project_line_id : oldTx.project_line_id,
        destination_account_id !== undefined ? destination_account_id : oldTx.destination_account_id,
        id
      ]
    );

    const updatedTx = updateResult.rows[0];

    // 3. ✅ LOGIQUE DE SOLDE (Reverse & Replay)
    
    // Annuler l'ancien impact si posted
    if (oldPosted) {
      if (oldTx.type === 'transfer') {
        // Annuler l'ancien transfert
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
          [oldTx.amount, oldTx.account_id]
        );
        await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
          [oldTx.amount, oldTx.destination_account_id]
        );
      } else {
        const reverseQuery = oldTx.type === 'income' 
          ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2'
          : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(reverseQuery, [oldTx.amount, oldTx.account_id]);
      }
    }

    // Appliquer le nouvel impact si posted
    if (newPosted) {
      if (updatedTx.type === 'transfer') {
        // Appliquer le nouveau transfert
        await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
          [updatedTx.amount, updatedTx.account_id]
        );
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
          [updatedTx.amount, updatedTx.destination_account_id]
        );
      } else {
        const applyQuery = updatedTx.type === 'income'
          ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
          : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
        await client.query(applyQuery, [updatedTx.amount, updatedTx.account_id]);
      }
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
// 5. DELETE - Supprimer une transaction
// ============================================================================
exports.deleteTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // 1. Récupérer la transaction avant suppression
    const checkResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    
    const transaction = checkResult.rows[0];
    console.log('🗑️ Suppression transaction:', {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      destination_account_id: transaction.destination_account_id
    });

    // 2. Réinitialiser les lignes de projet si nécessaire
    if (transaction.project_line_id) {
      const expenseCheck = await client.query(
        'SELECT id FROM project_expense_lines WHERE id = $1', 
        [transaction.project_line_id]
      );
      const revenueCheck = await client.query(
        'SELECT id FROM project_revenue_lines WHERE id = $1', 
        [transaction.project_line_id]
      );
      
      if (expenseCheck.rows.length > 0) {
        await client.query(
          'UPDATE project_expense_lines SET is_paid = false, actual_amount = 0, transaction_date = NULL, transaction_id = NULL WHERE id = $1',
          [transaction.project_line_id]
        );
      } else if (revenueCheck.rows.length > 0) {
        await client.query(
          'UPDATE project_revenue_lines SET is_received = false, actual_amount = 0, transaction_date = NULL, transaction_id = NULL WHERE id = $1',
          [transaction.project_line_id]
        );
      }
    }

    // 3. ✅ Annuler l'impact sur les soldes si postée
    if (transaction.is_posted) {
      if (transaction.type === 'transfer') {
        // Annuler le transfert
        await client.query(
          'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
          [transaction.amount, transaction.account_id]
        );
        await client.query(
          'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
          [transaction.amount, transaction.destination_account_id]
        );
        console.log('✅ Transfert annulé:', transaction.account_id, '←→', transaction.destination_account_id);
      } else {
        const updateQuery = transaction.type === 'income'
          ? 'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2'
          : 'UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2';
        
        await client.query(updateQuery, [transaction.amount, transaction.account_id]);
        console.log('✅ Compte recrédité:', transaction.account_id, transaction.amount);
      }
    }

    // 4. Supprimer la transaction
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);
    console.log('✅ Transaction supprimée:', id);

    await client.query('COMMIT');
    
    res.json({ 
      message: 'Transaction supprimée',
      expenseLineReset: !!transaction.project_line_id,
      accountCredited: transaction.is_posted,
      transferReversed: transaction.type === 'transfer' && transaction.is_posted
    });
    
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