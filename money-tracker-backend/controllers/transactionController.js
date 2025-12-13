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
      account_id, 
      type, 
      amount, 
      category, 
      description, 
      date,              
      transaction_date,  
      is_planned, 
      is_posted, 
      project_id,
      project_line_id
    } = req.body;

    const finalDate = transaction_date || date;
    // Sécurité numérique
    const finalAmount = parseFloat(amount);

    logger.info('📥 Nouvelle transaction', { account_id, type, amount: finalAmount, description });

    // Logique is_posted (Par défaut posté sauf si planifié)
    let shouldPost = true;
    if (is_posted !== undefined) shouldPost = is_posted;
    else if (is_planned === true) shouldPost = false;

    const insertResult = await client.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, is_planned, is_posted, project_id, project_line_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [account_id, type, finalAmount, category, description, finalDate, is_planned || false, shouldPost, project_id || null, project_line_id || null]
    );
    const transaction = insertResult.rows[0];

    // Mise à jour du solde SI posté
    if (shouldPost) {
      const updateQuery = type === 'income' 
        ? 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'
        : 'UPDATE accounts SET balance = balance - $1 WHERE id = $2';
      await client.query(updateQuery, [finalAmount, account_id]);
      logger.info(`💰 Solde mis à jour pour le compte ${account_id}`);
    }

    // ---------------------------------------------------------
    // 🤖 AUTOMATISATION OPÉRATEUR (Le Chaînon Manquant)
    // ---------------------------------------------------------
    if (project_id && type === 'expense' && shouldPost) {
      try {
        // 1. Chercher les SOPs/Tâches qui pourraient correspondre à cette dépense
        // On cherche une correspondance floue sur le nom ou la description
        const keyword = description.split(' ')[0]; // Premier mot clé (ex: "Ciment", "Briques")
        
        if (keyword.length > 3) {
            // Mise à jour des SOPs (Checklist)
            const sopsRes = await client.query(
                `SELECT * FROM operator_sops`, // On charge tout pour filtrer en JS ou faire un ILIKE complexe
                []
            );

            for (const sop of sopsRes.rows) {
                let updated = false;
                const newChecklist = (sop.checklist || []).map(item => {
                    // Si l'item de checklist contient le mot clé ou "Budget"
                    // et que la description de la transaction contient le nom de l'item
                    const matchItem = item.item.toLowerCase();
                    const matchDesc = description.toLowerCase();
                    
                    // Logique : Si la transaction est "Achat Ciment" et l'item est "Budget Ciment"
                    if (!item.checked && (matchItem.includes(keyword.toLowerCase()) || matchItem.includes('budget'))) {
                        updated = true;
                        logger.info(`🤖 Auto-check SOP ${sop.id}: "${item.item}" validé par paiement.`);
                        return { ...item, checked: true };
                    }
                    return item;
                });

                if (updated) {
                    await client.query(
                        'UPDATE operator_sops SET checklist = $1::jsonb, updated_at = NOW() WHERE id = $2',
                        [JSON.stringify(newChecklist), sop.id]
                    );
                }
            }
        }
      } catch (autoErr) {
        logger.warn('⚠️ Erreur mineure automatisation SOP:', autoErr.message);
        // On ne bloque pas la transaction pour ça
      }
    }
    // ---------------------------------------------------------

    await client.query('COMMIT');
    res.status(201).json(transaction);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    // Gestion propre des doublons
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
// 4. PUT - Mettre à jour une transaction (ROBUSTE)
// ============================================================================
exports.updateTransaction = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { 
      account_id, type, amount, category, description, date,
      is_posted, is_planned, project_id 
    } = req.body;
      project_line_id

    // 1. Récupérer l'ancienne transaction
    const beforeResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (beforeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction introuvable' });
    }

    const oldTx = beforeResult.rows[0];
    const oldPosted = oldTx.is_posted;
    // Si is_posted n'est pas fourni, on garde l'ancien
    const newPosted = is_posted !== undefined ? is_posted : oldPosted; 

    // 2. Update SQL
    const updateResult = await client.query(
      `UPDATE transactions 
       SET account_id = $1, type = $2, amount = $3, category = $4, 
           description = $5, transaction_date = $6, is_posted = $7, 
           is_planned = $8, project_id = $9
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
          project_line_id !== undefined ? project_line_id : oldTx.project_line_id,
        id
      ]
    );

    const updatedTx = updateResult.rows[0];

    // 3. LOGIQUE DE SOLDE (La méthode "Reverse & Replay")
    // C'est la seule méthode qui gère tous les cas (changement montant, compte, type, statut)
    
    // A. Si l'ancienne était postée, on ANNULE son effet (Remboursement)
    if (oldPosted) {
        const reverseQuery = oldTx.type === 'income' 
          ? 'UPDATE accounts SET balance = balance - $1 WHERE id = $2' // On enlève le revenu
          : 'UPDATE accounts SET balance = balance + $1 WHERE id = $2'; // On remet la dépense
        await client.query(reverseQuery, [oldTx.amount, oldTx.account_id]);
    }

    // B. Si la nouvelle est postée, on APPLIQUE son effet
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