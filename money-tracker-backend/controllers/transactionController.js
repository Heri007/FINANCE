// controllers/transactionController.js - VERSION FINALE OPTIMISÉE
const pool = require('../config/database');
const logger = require('../config/logger');

// Récupérer toutes les transactions
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
        t.created_at,
        a.name as account_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      ORDER BY t.transaction_date DESC, t.created_at DESC`
    );
    logger.info(`✅ Transactions récupérées: ${result.rows.length}`);
    res.json(result.rows);
  } catch (error) {
    next(error); 
  }
};

// Récupérer la dernière date de transaction par compte (Cutoff Import)
exports.getLastDates = async (req, res, next) => {
  try {
    const query = `SELECT account_id, MAX(transaction_date) as last_date FROM transactions GROUP BY account_id`;
    const { rows } = await pool.query(query);
    
    const datesMap = {};
    rows.forEach(row => {
      if (row.last_date) {
        datesMap[row.account_id] = new Date(row.last_date).toISOString().split('T')[0];
      } else {
        datesMap[row.account_id] = null;
      }
    });

    logger.debug('📅 Dernières dates par compte récupérées', { datesMap });
    res.json(datesMap);
  } catch (error) {
    next(error);
  }
};

// Créer une transaction
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
      date,              // ✅ Frontend peut envoyer 'date'
      transaction_date,  // ✅ ou 'transaction_date'
      is_planned, 
      is_posted, 
      project_id 
    } = req.body;

    // ✅ Utiliser transaction_date en priorité, sinon date
    const finalDate = transaction_date || date;

    logger.info('📥 Nouvelle transaction demandée', { account_id, type, amount, description });

    // Logique is_posted
    let shouldPost;
    if (is_posted !== undefined) shouldPost = is_posted;
    else if (is_planned === true) shouldPost = false;
    else shouldPost = true;

    const insertResult = await client.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, is_planned, is_posted, project_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [account_id, type, amount, category, description, finalDate, is_planned || false, shouldPost, project_id || null]
    );

    const transaction = insertResult.rows[0];

    if (shouldPost) {
      const updateQuery = type === 'income' 
        ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
        : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
      await client.query(updateQuery, [amount, account_id]);
      logger.info(`✅ Solde mis à jour pour le compte ${account_id}`);
    } else {
      logger.info('⏳ Transaction planifiée, solde non impacté');
    }

    await client.query('COMMIT');
    res.status(201).json(transaction);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('❌ Erreur createTransaction:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};


// Mettre à jour une transaction
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
      date,
      is_posted, 
      is_planned,
      project_id 
    } = req.body;

    logger.info(`🔵 UPDATE Transaction ID ${id}`, { is_posted, account_id, amount, project_id });

    // 1. Récupérer l'ancienne transaction
    const beforeResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    
    if (beforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }

    const oldTx = beforeResult.rows[0];
    const oldPosted = oldTx.is_posted || false;
    const newPosted = is_posted || false;

    logger.info(`📊 is_posted: ${oldPosted} → ${newPosted}`);

    // 2. Mettre à jour TOUS les champs de la transaction
    const updateResult = await client.query(
      `UPDATE transactions 
       SET account_id = $1, 
           type = $2, 
           amount = $3, 
           category = $4, 
           description = $5, 
           transaction_date = $6, 
           is_posted = $7, 
           is_planned = $8,
           project_id = $9
       WHERE id = $10
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
        id
      ]
    );

    const updatedTx = updateResult.rows[0];

    // 3. Ajuster le solde si passage de non-posté à posté (ou vice-versa)
    if (oldPosted !== newPosted) {
      const amt = parseFloat(updatedTx.amount);
      let adjustment = 0;

      if (newPosted && !oldPosted) {
        adjustment = updatedTx.type === 'income' ? amt : -amt;
        logger.info(`✅ Validation → ajustement: ${adjustment} Ar`);
      } else if (!newPosted && oldPosted) {
        adjustment = updatedTx.type === 'income' ? -amt : amt;
        logger.info(`❌ Annulation → ajustement: ${adjustment} Ar`);
      }

      if (adjustment !== 0) {
        const updateQuery = 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
        await client.query(updateQuery, [adjustment, updatedTx.account_id]);
        logger.info(`💰 Compte ${updatedTx.account_id} ajusté de ${adjustment} Ar`);
      }
    }

    await client.query('COMMIT');
    logger.info(`✅ Transaction ${id} mise à jour avec succès`);
    
    res.json(updatedTx);
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur updateTransaction:', error.message);
    next(error);
  } finally {
    client.release();
  }
};

// Supprimer une transaction
exports.deleteTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    logger.info(`🗑️ Suppression transaction ${id}`);

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
      logger.info(`💰 Impact solde annulé pour suppression transaction ${id}`);
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

// Dés-encaisser une transaction
exports.unpostTransaction = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    logger.info(`🔄 Unpost (Dés-encaissement) transaction ${id}`);

    const resTx = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (resTx.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }
    const tx = resTx.rows[0];

    if (!tx.is_posted) {
      await client.query('ROLLBACK');
      return res.json(tx);
    }

    // Annuler l'impact solde
    const updateQuery = tx.type === 'income'
      ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2'
      : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2';
    
    await client.query(updateQuery, [tx.amount, tx.account_id]);

    // Mettre à jour le flag
    const updateRes = await client.query(
      'UPDATE transactions SET is_posted = false WHERE id = $1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');
    logger.info(`✅ Transaction ${id} marquée comme non postée`);
    res.json(updateRes.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur unpostTransaction:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};
