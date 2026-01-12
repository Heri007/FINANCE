// services/auditService.js
const pool = require('../config/database');

/**
 * Récupérer l'historique d'audit avec filtres
 */
exports.getAuditLogs = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        id,
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        changed_fields,
        performed_by,
        performed_at,
        notes
      FROM audit_log
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filtre par table
    if (filters.tableName) {
      query += ` AND table_name = $${paramIndex}`;
      params.push(filters.tableName);
      paramIndex++;
    }

    // Filtre par record_id
    if (filters.recordId) {
      query += ` AND record_id = $${paramIndex}`;
      params.push(filters.recordId);
      paramIndex++;
    }

    // Filtre par opération
    if (filters.operation) {
      query += ` AND operation = $${paramIndex}`;
      params.push(filters.operation);
      paramIndex++;
    }

    // Filtre par utilisateur
    if (filters.performedBy) {
      query += ` AND performed_by = $${paramIndex}`;
      params.push(filters.performedBy);
      paramIndex++;
    }

    // Filtre par date
    if (filters.startDate) {
      query += ` AND performed_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND performed_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    // Tri et limite
    query += ` ORDER BY performed_at DESC LIMIT ${filters.limit || 100}`;

    const result = await pool.query(query, params);

    return {
      success: true,
      count: result.rows.length,
      data: result.rows
    };

  } catch (error) {
    console.error('❌ Erreur getAuditLogs:', error);
    throw error;
  }
};

/**
 * Historique d'un enregistrement spécifique
 */
exports.getRecordHistory = async (tableName, recordId) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        operation,
        old_data,
        new_data,
        changed_fields,
        performed_by,
        performed_at,
        notes
      FROM audit_log
      WHERE table_name = $1 AND record_id = $2
      ORDER BY performed_at DESC`,
      [tableName, recordId]
    );

    return {
      success: true,
      count: result.rows.length,
      data: result.rows
    };

  } catch (error) {
    console.error('❌ Erreur getRecordHistory:', error);
    throw error;
  }
};

/**
 * Statistiques d'audit
 */
exports.getAuditStats = async (days = 30) => {
  try {
    const result = await pool.query(
      `SELECT 
        table_name,
        operation,
        COUNT(*) as count,
        COUNT(DISTINCT performed_by) as unique_users,
        MIN(performed_at) as first_change,
        MAX(performed_at) as last_change
      FROM audit_log
      WHERE performed_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
      GROUP BY table_name, operation
      ORDER BY count DESC`
    );

    return {
      success: true,
      data: result.rows
    };

  } catch (error) {
    console.error('❌ Erreur getAuditStats:', error);
    throw error;
  }
};

/**
 * Activité récente par utilisateur
 */
exports.getUserActivity = async (userId, limit = 50) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        table_name,
        record_id,
        operation,
        performed_at,
        changed_fields
      FROM audit_log
      WHERE performed_by = $1
      ORDER BY performed_at DESC
      LIMIT $2`,
      [userId, limit]
    );

    return {
      success: true,
      count: result.rows.length,
      data: result.rows
    };

  } catch (error) {
    console.error('❌ Erreur getUserActivity:', error);
    throw error;
  }
};

/**
 * Recherche dans l'historique
 */
exports.searchAuditLogs = async (searchTerm) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        performed_by,
        performed_at
      FROM audit_log
      WHERE 
        old_data::text ILIKE $1
        OR new_data::text ILIKE $1
        OR table_name ILIKE $1
        OR performed_by ILIKE $1
      ORDER BY performed_at DESC
      LIMIT 100`,
      [`%${searchTerm}%`]
    );

    return {
      success: true,
      count: result.rows.length,
      data: result.rows
    };

  } catch (error) {
    console.error('❌ Erreur searchAuditLogs:', error);
    throw error;
  }
};

/**
 * Comparer deux versions d'un enregistrement
 */
exports.compareVersions = async (auditId1, auditId2) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        performed_at,
        performed_by
      FROM audit_log
      WHERE id IN ($1, $2)
      ORDER BY performed_at ASC`,
      [auditId1, auditId2]
    );

    if (result.rows.length !== 2) {
      return {
        success: false,
        error: 'Les deux versions doivent exister'
      };
    }

    const [version1, version2] = result.rows;

    // Calculer les différences
    const data1 = version1.new_data || version1.old_data;
    const data2 = version2.new_data || version2.old_data;

    const differences = {};
    
    if (data1 && data2) {
      Object.keys(data2).forEach(key => {
        if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
          differences[key] = {
            before: data1[key],
            after: data2[key]
          };
        }
      });
    }

    return {
      success: true,
      version1: version1,
      version2: version2,
      differences: differences
    };

  } catch (error) {
    console.error('❌ Erreur compareVersions:', error);
    throw error;
  }
};

/**
 * Restaurer une version précédente (DANGEREUX - à utiliser avec précaution)
 */
exports.restoreToPreviousVersion = async (auditId, userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Récupérer l'entrée d'audit
    const auditResult = await client.query(
      'SELECT * FROM audit_log WHERE id = $1',
      [auditId]
    );

    if (auditResult.rows.length === 0) {
      throw new Error('Entrée d\'audit introuvable');
    }

    const auditEntry = auditResult.rows[0];
    
    if (!auditEntry.old_data) {
      throw new Error('Aucune donnée ancienne à restaurer (c\'était un INSERT)');
    }

    // Construire la query UPDATE pour restaurer
    const oldData = auditEntry.old_data;
    const columns = Object.keys(oldData).filter(k => k !== 'id');
    const setClause = columns.map((col, idx) => `${col} = $${idx + 2}`).join(', ');
    const values = columns.map(col => oldData[col]);

    const restoreQuery = `
      UPDATE ${auditEntry.table_name}
      SET ${setClause}
      WHERE id = $1
    `;

    await client.query(restoreQuery, [auditEntry.record_id, ...values]);

    // Logger la restauration
    await client.query(
      `INSERT INTO audit_log (
        table_name, 
        record_id, 
        operation, 
        old_data, 
        new_data, 
        performed_by, 
        notes
      ) VALUES ($1, $2, 'UPDATE', $3, $4, $5, $6)`,
      [
        auditEntry.table_name,
        auditEntry.record_id,
        auditEntry.new_data,
        auditEntry.old_data,
        userId,
        `Restauré depuis audit_log #${auditId}`
      ]
    );

    await client.query('COMMIT');

    console.log(`✅ Restauration effectuée: ${auditEntry.table_name} #${auditEntry.record_id}`);

    return {
      success: true,
      message: 'Restauration effectuée avec succès',
      table: auditEntry.table_name,
      recordId: auditEntry.record_id
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur restoreToPreviousVersion:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    client.release();
  }
};

/**
 * Nettoyer l'historique ancien
 */
exports.cleanupOldLogs = async (daysToKeep = 90) => {
  try {
    const result = await pool.query(
      `DELETE FROM audit_log
       WHERE performed_at < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
       RETURNING id`,
    );

    console.log(`✅ ${result.rowCount} anciennes entrées d'audit supprimées`);

    return {
      success: true,
      deletedCount: result.rowCount
    };

  } catch (error) {
    console.error('❌ Erreur cleanupOldLogs:', error);
    throw error;
  }
};

module.exports = {
  getAuditLogs: exports.getAuditLogs,
  getRecordHistory: exports.getRecordHistory,
  getAuditStats: exports.getAuditStats,
  getUserActivity: exports.getUserActivity,
  searchAuditLogs: exports.searchAuditLogs,
  compareVersions: exports.compareVersions,
  restoreToPreviousVersion: exports.restoreToPreviousVersion,
  cleanupOldLogs: exports.cleanupOldLogs
};
