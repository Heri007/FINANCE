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
    // Appel de la fonction PostgreSQL
    const result = await pool.query(
      'SELECT * FROM link_transaction_to_line($1, $2, $3)',
      [transactionId, lineId, userId]
    );

    if (result.rows && result.rows.length > 0) {
      const data = result.rows[0];
      
      console.log('✅ Transaction liée:', {
        transactionId: data.transaction_id,
        lineId: data.line_id,
        amount: data.amount
      });

      return {
        success: true,
        data: {
          transactionId: data.transaction_id,
          lineId: data.line_id,
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
    let query = `
      SELECT * FROM v_transactions_with_lines
      WHERE link_status = 'unlinked'
    `;
    const params = [];

    if (projectId) {
      query += ' AND project_id = $1';
      params.push(projectId);
    }

    query += ' ORDER BY transaction_date DESC, transaction_id DESC';

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
 * @returns {Promise<Object>} { expenseLines, revenueLines }
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
        created_at
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
        created_at
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
      expenseLines: expensesResult.rows,
      revenueLines: revenuesResult.rows
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
    const result = await pool.query(
      `WITH transaction_info AS (
        SELECT 
          t.id,
          t.type,
          t.amount,
          t.category,
          t.description,
          t.project_id,
          t.transaction_date
        FROM transactions t
        WHERE t.id = $1
      )
      SELECT 
        CASE 
          WHEN t.type = 'expense' THEN pel.id
          ELSE prl.id
        END as line_id,
        CASE 
          WHEN t.type = 'expense' THEN 'expense'
          ELSE 'revenue'
        END as line_type,
        CASE 
          WHEN t.type = 'expense' THEN pel.description
          ELSE prl.description
        END as description,
        CASE 
          WHEN t.type = 'expense' THEN pel.category
          ELSE prl.category
        END as category,
        CASE 
          WHEN t.type = 'expense' THEN pel.projected_amount
          ELSE prl.projected_amount
        END as projected_amount,
        CASE 
          WHEN t.type = 'expense' THEN pel.is_paid
          ELSE prl.is_received
        END as is_completed,
        
        -- Calcul du score de correspondance
        (
          -- Score montant (50 points max)
          CASE 
            WHEN ABS((CASE WHEN t.type = 'expense' THEN pel.projected_amount ELSE prl.projected_amount END) - t.amount) = 0 
            THEN 80
            WHEN ABS((CASE WHEN t.type = 'expense' THEN pel.projected_amount ELSE prl.projected_amount END) - t.amount) < 
                 (CASE WHEN t.type = 'expense' THEN pel.projected_amount ELSE prl.projected_amount END) * 0.1
            THEN 50
            ELSE 0
          END
          +
          -- Score catégorie (20 points)
          CASE 
            WHEN (CASE WHEN t.type = 'expense' THEN pel.category ELSE prl.category END) = t.category 
            THEN 20 
            ELSE 0 
          END
          +
          -- Score description (30 points)
          CASE 
            WHEN (CASE WHEN t.type = 'expense' THEN pel.description ELSE prl.description END) ILIKE '%' || t.description || '%'
              OR t.description ILIKE '%' || (CASE WHEN t.type = 'expense' THEN pel.description ELSE prl.description END) || '%'
            THEN 30
            ELSE 0
          END
        ) as match_score
        
      FROM transaction_info t
      LEFT JOIN project_expense_lines pel 
        ON pel.project_id = t.project_id AND t.type = 'expense'
      LEFT JOIN project_revenue_lines prl 
        ON prl.project_id = t.project_id AND t.type = 'income'
      WHERE 
        (t.type = 'expense' AND pel.id IS NOT NULL)
        OR (t.type = 'income' AND prl.id IS NOT NULL)
      ORDER BY match_score DESC
      LIMIT 10`,
      [transactionId]
    );

    console.log(`✅ ${result.rows.length} suggestions trouvées pour transaction ${transactionId}`);
    
    return result.rows.filter(row => row.match_score > 0);

  } catch (error) {
    console.error('❌ Erreur recherche suggestions:', error);
    throw error;
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

    return result.rows[0] || {};

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
        tll.*,
        t.description as transaction_description,
        t.amount as transaction_amount,
        t.type as transaction_type
      FROM transaction_linking_log tll
      JOIN transactions t ON t.id = tll.transaction_id
      WHERE t.project_id = $1
      ORDER BY tll.performed_at DESC
      LIMIT $2`,
      [projectId, limit]
    );

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
      // Trouver la meilleure correspondance
      const matchResult = await client.query(
        `SELECT 
          CASE WHEN $2 = 'expense' THEN pel.id ELSE prl.id END as line_id,
          CASE WHEN $2 = 'expense' THEN pel.projected_amount ELSE prl.projected_amount END as amount
        FROM ${transaction.type === 'expense' ? 'project_expense_lines pel' : 'project_revenue_lines prl'}
        WHERE ${transaction.type === 'expense' ? 'pel' : 'prl'}.project_id = $1
          AND ABS((CASE WHEN $2 = 'expense' THEN pel.projected_amount ELSE prl.projected_amount END) - $3) < 0.01
          AND (
            (CASE WHEN $2 = 'expense' THEN pel.category ELSE prl.category END) = $4
            OR (CASE WHEN $2 = 'expense' THEN pel.description ELSE prl.description END) ILIKE '%' || $5 || '%'
          )
        LIMIT 1`,
        [projectId, transaction.type, transaction.amount, transaction.category, transaction.description]
      );

      if (matchResult.rows.length > 0) {
        const lineId = matchResult.rows[0].line_id;
        
        // Lier
        const linkResult = await client.query(
          'SELECT * FROM link_transaction_to_line($1, $2, $3)',
          [transaction.id, lineId, userId]
        );

        if (linkResult.rows.length > 0) {
          linkedCount++;
          results.push({
            transactionId: transaction.id,
            lineId: lineId,
            success: true
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
      results: results
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