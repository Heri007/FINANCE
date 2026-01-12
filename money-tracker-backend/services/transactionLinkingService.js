// services/transactionLinkingService.js
// -----------------------------------------------------------------------------
// Service de liaison entre transactions et lignes de projets (PostgreSQL)
// -----------------------------------------------------------------------------

const pool = require('../config/database');

// -----------------------------------------------------------------------------
// Lier une transaction à une ligne de projet
// -----------------------------------------------------------------------------
/**
 * Lie une transaction à une ligne de dépense ou de revenu
 * @param {number} transactionId - ID de la transaction
 * @param {number} lineId - ID de la ligne (expense ou revenue)
 * @param {string} userId - ID de l'utilisateur effectuant l'action
 * @returns {Promise<Object>} Résultat de l'opération
 */
async function linkTransactionToLine(transactionId, lineId, userId = 'system') {
  try {
    // Appel de la fonction PostgreSQL existante
    const result = await pool.query(
      'SELECT * FROM link_transaction_to_line($1, $2, $3)',
      [transactionId, lineId, userId]
    );

    if (result.rows && result.rows.length > 0) {
      const data = result.rows[0];
      
      console.log('✅ Transaction liée:', {
        transactionId: data.transactionid,
        lineId: data.lineid,
        amount: data.amount
      });

      return {
        success: true,
        data: {
          transactionId: data.transactionid,
          lineId: data.lineid,
          amount: parseFloat(data.amount),
          message: data.message
        }
      };
    }

    return { success: false, error: 'Aucun résultat retourné' };

  } catch (error) {
    console.error('❌ Erreur liaison transaction:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la liaison'
    };
  }
}

// -----------------------------------------------------------------------------
// Délier une transaction
// -----------------------------------------------------------------------------
/**
 * Supprime la liaison entre une transaction et sa ligne
 * @param {number} transactionId - ID de la transaction
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} Résultat de l'opération
 */
async function unlinkTransaction(transactionId, userId = 'system') {
  try {
    const result = await pool.query(
      'SELECT * FROM unlink_transaction($1, $2)',
      [transactionId, userId]
    );

    if (result.rows && result.rows.length > 0) {
      console.log('✅ Transaction déliée:', transactionId);
      
      return {
        success: true,
        message: result.rows[0].message
      };
    }

    return { success: false, error: 'Aucun résultat retourné' };

  } catch (error) {
    console.error('❌ Erreur déliaison:', error);
    return {
      success: false,
      error: error.message || 'Erreur lors de la déliaison'
    };
  }
}

// -----------------------------------------------------------------------------
// Récupérer les transactions non liées
// -----------------------------------------------------------------------------
/**
 * Liste les transactions sans ligne de projet associée
 * @param {number|null} projectId - Filtrer par projet (optionnel)
 * @returns {Promise<Array>} Liste des transactions non liées
 */
async function getUnlinkedTransactions(projectId = null) {
  try {
    // ✅ CORRECTION : Query directe, pas de vue
    let query = `
      SELECT 
        t.id as transaction_id,
        t.account_id,
        t.type,
        t.amount,
        t.category,
        t.description,
        t.transaction_date,
        t.project_id,
        t.project_line_id,
        a.name as account_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.project_line_id IS NULL
    `;

    const params = [];

    if (projectId) {
      query += ' AND t.project_id = $1';
      params.push(projectId);
    }

    query += ' ORDER BY t.transaction_date DESC LIMIT 100';

    const result = await pool.query(query, params);

    console.log(`✅ ${result.rows.length} transactions non liées trouvées`);
    
    return result.rows;

  } catch (error) {
    console.error('❌ Erreur récupération transactions non liées:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Récupérer les lignes d'un projet (dépenses + revenus)
// -----------------------------------------------------------------------------
/**
 * Récupère toutes les lignes budgétaires d'un projet
 * @param {number} projectId - ID du projet
 * @returns {Promise<Object>} { expenses, revenues }
 */
async function getProjectLines(projectId) {
  try {
    // Récupérer les lignes de dépenses
    const expensesResult = await pool.query(
      `SELECT 
        id, 
        project_id, 
        description, 
        category, 
        projected_amount, 
        actual_amount, 
        transaction_date, 
        is_paid,
        created_at,
        last_synced_at
      FROM project_expense_lines
      WHERE project_id = $1
      ORDER BY created_at DESC`,
      [projectId]
    );

    // Récupérer les lignes de revenus
    const revenuesResult = await pool.query(
      `SELECT 
        id, 
        project_id, 
        description, 
        category, 
        projected_amount, 
        actual_amount, 
        transaction_date, 
        is_received,
        created_at,
        last_synced_at
      FROM project_revenue_lines
      WHERE project_id = $1
      ORDER BY created_at DESC`,
      [projectId]
    );

    console.log(`✅ Lignes projet ${projectId}:`, {
      expenses: expensesResult.rows.length,
      revenues: revenuesResult.rows.length
    });

    return {
      expenses: expensesResult.rows,
      revenues: revenuesResult.rows
    };

  } catch (error) {
    console.error('❌ Erreur récupération lignes projet:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Obtenir les suggestions de liaison pour une transaction
// -----------------------------------------------------------------------------
/**
 * Trouve les meilleures correspondances pour lier une transaction
 * @param {number} transactionId - ID de la transaction
 * @returns {Promise<Array>} Lignes suggérées avec score
 */
async function getSuggestedMatches(transactionId) {
  try {
    // Récupérer la transaction
    const txResult = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (txResult.rows.length === 0) {
      return [];
    }

    const transaction = txResult.rows[0];
    const isExpense = transaction.type === 'expense';
    const tableName = isExpense ? 'project_expense_lines' : 'project_revenue_lines';
    const statusField = isExpense ? 'is_paid' : 'is_received';

    // Chercher les correspondances
    const result = await pool.query(
      `SELECT 
        id as line_id,
        description,
        category,
        projected_amount,
        ${statusField} as is_completed,
        ABS(projected_amount - $2) as amount_diff,
        CASE 
          WHEN ABS(projected_amount - $2) = 0 THEN 80
          WHEN ABS(projected_amount - $2) < projected_amount * 0.1 THEN 50
          ELSE 0
        END as amount_score,
        CASE 
          WHEN category = $3 THEN 20
          ELSE 0
        END as category_score
      FROM ${tableName}
      WHERE project_id = $1
        AND ${statusField} = false
      ORDER BY amount_diff ASC, category_score DESC
      LIMIT 10`,
      [transaction.project_id, transaction.amount, transaction.category]
    );

    console.log(`✅ ${result.rows.length} suggestions pour transaction ${transactionId}`);
    
    return result.rows.map(row => ({
      ...row,
      match_score: row.amount_score + row.category_score,
      line_type: isExpense ? 'expense' : 'revenue'
    }));

  } catch (error) {
    console.error('❌ Erreur recherche suggestions:', error);
    return []; // Retourner vide au lieu de throw
  }
}

// -----------------------------------------------------------------------------
// Obtenir les statistiques de liaison par projet
// -----------------------------------------------------------------------------
/**
 * Retourne les stats de liaison pour un projet
 * @param {number} projectId - ID du projet
 * @returns {Promise<Object>} Statistiques
 */
async function getProjectLinkingStats(projectId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE project_line_id IS NOT NULL) as linked_count,
        COUNT(*) FILTER (WHERE project_line_id IS NULL) as unlinked_count,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE type = 'expense' AND project_line_id IS NOT NULL) as linked_expenses,
        COUNT(*) FILTER (WHERE type = 'expense' AND project_line_id IS NULL) as unlinked_expenses,
        COUNT(*) FILTER (WHERE type = 'income' AND project_line_id IS NOT NULL) as linked_incomes,
        COUNT(*) FILTER (WHERE type = 'income' AND project_line_id IS NULL) as unlinked_incomes,
        ROUND(
          COUNT(*) FILTER (WHERE project_line_id IS NOT NULL)::NUMERIC / 
          NULLIF(COUNT(*), 0) * 100, 
          1
        ) as linking_percentage
      FROM transactions
      WHERE project_id = $1`,
      [projectId]
    );

    return result.rows[0] || {
      linked_count: 0,
      unlinked_count: 0,
      total_count: 0,
      linked_expenses: 0,
      unlinked_expenses: 0,
      linked_incomes: 0,
      unlinked_incomes: 0,
      linking_percentage: 0
    };

  } catch (error) {
    console.error('❌ Erreur statistiques:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Obtenir l'historique des liaisons
// -----------------------------------------------------------------------------
/**
 * Récupère l'historique des liaisons pour un projet
 * @param {number} projectId - ID du projet
 * @param {number} limit - Nombre max de résultats
 * @returns {Promise<Array>} Historique
 */
async function getLinkingHistory(projectId, limit = 50) {
  try {
    const result = await pool.query(
      `SELECT 
        tll.id,
        tll.transaction_id,
        tll.project_line_id,
        tll.line_type,
        tll.action,
        tll.performed_by,
        tll.performed_at,
        tll.notes,
        t.description as transaction_description,
        t.amount as transaction_amount,
        t.type as transaction_type,
        t.transaction_date
      FROM transaction_linking_log tll
      JOIN transactions t ON t.id = tll.transaction_id
      WHERE t.project_id = $1
      ORDER BY tll.performed_at DESC
      LIMIT $2`,
      [projectId, limit]
    );

    console.log(`✅ ${result.rows.length} entrées d'historique pour projet ${projectId}`);

    return result.rows;

  } catch (error) {
    console.error('❌ Erreur historique:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Liaison automatique pour un projet
// -----------------------------------------------------------------------------
/**
 * Tente de lier automatiquement toutes les transactions d'un projet
 * @param {number} projectId - ID du projet
 * @param {string} userId - ID utilisateur
 * @returns {Promise<Object>} Résultat avec nombre de liaisons effectuées
 */
async function autoLinkProjectTransactions(projectId, userId = 'system') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Récupérer les transactions non liées
    const unlinkedResult = await client.query(
      `SELECT id, type, amount, category, description
       FROM transactions
       WHERE project_id = $1 AND project_line_id IS NULL`,
      [projectId]
    );

    let linkedCount = 0;
    const results = [];

    for (const transaction of unlinkedResult.rows) {
      const isExpense = transaction.type === 'expense';
      const tableName = isExpense ? 'project_expense_lines' : 'project_revenue_lines';

      // ✅ Trouver la meilleure correspondance
      const matchResult = await client.query(
        `SELECT 
          id as line_id,
          description,
          projected_amount,
          ABS(projected_amount - $2) as amount_diff
        FROM ${tableName}
        WHERE project_id = $1
          AND ABS(projected_amount - $2) < 0.01
        ORDER BY amount_diff ASC
        LIMIT 1`,
        [projectId, transaction.amount]
      );

      if (matchResult.rows.length > 0) {
        const lineId = matchResult.rows[0].line_id;
        
        // Lier via la fonction PostgreSQL
        const linkResult = await client.query(
          'SELECT * FROM link_transaction_to_line($1, $2, $3)',
          [transaction.id, lineId, userId]
        );

        if (linkResult.rows.length > 0 && linkResult.rows[0].status === 'success') {
          linkedCount++;
          results.push({
            transactionId: transaction.id,
            lineId: lineId,
            success: true,
            description: transaction.description
          });
        } else {
          results.push({
            transactionId: transaction.id,
            success: false,
            error: linkResult.rows[0]?.message || 'Échec de liaison'
          });
        }
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Liaison automatique: ${linkedCount}/${unlinkedResult.rows.length} transactions liées`);

    return {
      success: true,
      totalTransactions: unlinkedResult.rows.length,
      linkedCount: linkedCount,
      results: results,
      message: `${linkedCount} transaction(s) liée(s) automatiquement`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur liaison automatique:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------
module.exports = {
  linkTransactionToLine,
  unlinkTransaction,
  getUnlinkedTransactions,
  getProjectLines,
  getSuggestedMatches,
  getProjectLinkingStats,
  getLinkingHistory,
  autoLinkProjectTransactions
};
