// services/logArchiveService.js
const pool = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

// Répertoires d'archivage
const ARCHIVE_BASE_DIR = path.join(__dirname, '..', 'archives');
const AUDIT_DIR = path.join(ARCHIVE_BASE_DIR, 'audit');
const LINKING_DIR = path.join(ARCHIVE_BASE_DIR, 'linking');

/**
 * Créer les répertoires d'archivage
 */
async function ensureArchiveDirs() {
  try {
    await fs.mkdir(ARCHIVE_BASE_DIR, { recursive: true });
    await fs.mkdir(AUDIT_DIR, { recursive: true });
    await fs.mkdir(LINKING_DIR, { recursive: true });
    console.log('✅ Répertoires d\'archivage créés');
  } catch (error) {
    console.error('❌ Erreur création répertoires:', error);
    throw error;
  }
}

/**
 * Archiver les logs d'audit d'une période
 */
async function archiveAuditLogs(startDate, endDate, deleteAfterArchive = false) {
  try {
    console.log(`📦 Archivage audit logs: ${startDate} → ${endDate}`);

    // Récupérer les logs de la période
    const result = await pool.query(
      `SELECT * FROM audit_log
       WHERE performed_at >= $1 AND performed_at < $2
       ORDER BY performed_at ASC`,
      [startDate, endDate]
    );

    if (result.rows.length === 0) {
      console.log('ℹ️ Aucun log d\'audit pour cette période');
      return { success: true, archived: 0, deleted: 0 };
    }

    // Créer le répertoire mensuel
    const monthDir = path.join(AUDIT_DIR, format(new Date(startDate), 'yyyy-MM'));
    await fs.mkdir(monthDir, { recursive: true });

    // Nom du fichier
    const filename = `audit_${format(new Date(startDate), 'yyyy-MM-dd')}.json`;
    const filepath = path.join(monthDir, filename);

    // Sauvegarder
    const archive = {
      version: '1.0',
      type: 'audit_log',
      period: {
        start: startDate,
        end: endDate
      },
      count: result.rows.length,
      exported_at: new Date().toISOString(),
      logs: result.rows
    };

    await fs.writeFile(filepath, JSON.stringify(archive, null, 2), 'utf8');
    console.log(`✅ ${result.rows.length} audit logs archivés: ${filepath}`);

    // Supprimer de la DB si demandé
    let deletedCount = 0;
    if (deleteAfterArchive) {
      const deleteResult = await pool.query(
        `DELETE FROM audit_log
         WHERE performed_at >= $1 AND performed_at < $2`,
        [startDate, endDate]
      );
      deletedCount = deleteResult.rowCount;
      console.log(`🗑️ ${deletedCount} audit logs supprimés de la DB`);
    }

    return {
      success: true,
      archived: result.rows.length,
      deleted: deletedCount,
      filepath
    };

  } catch (error) {
    console.error('❌ Erreur archiveAuditLogs:', error);
    throw error;
  }
}

/**
 * Archiver les logs de liaison d'une période
 */
async function archiveLinkingLogs(startDate, endDate, deleteAfterArchive = false) {
  try {
    console.log(`🔗 Archivage linking logs: ${startDate} → ${endDate}`);

    const result = await pool.query(
      `SELECT * FROM transaction_linking_log
       WHERE performed_at >= $1 AND performed_at < $2
       ORDER BY performed_at ASC`,
      [startDate, endDate]
    );

    if (result.rows.length === 0) {
      console.log('ℹ️ Aucun log de liaison pour cette période');
      return { success: true, archived: 0, deleted: 0 };
    }

    const monthDir = path.join(LINKING_DIR, format(new Date(startDate), 'yyyy-MM'));
    await fs.mkdir(monthDir, { recursive: true });

    const filename = `linking_${format(new Date(startDate), 'yyyy-MM-dd')}.json`;
    const filepath = path.join(monthDir, filename);

    const archive = {
      version: '1.0',
      type: 'transaction_linking_log',
      period: {
        start: startDate,
        end: endDate
      },
      count: result.rows.length,
      exported_at: new Date().toISOString(),
      logs: result.rows
    };

    await fs.writeFile(filepath, JSON.stringify(archive, null, 2), 'utf8');
    console.log(`✅ ${result.rows.length} linking logs archivés: ${filepath}`);

    let deletedCount = 0;
    if (deleteAfterArchive) {
      const deleteResult = await pool.query(
        `DELETE FROM transaction_linking_log
         WHERE performed_at >= $1 AND performed_at < $2`,
        [startDate, endDate]
      );
      deletedCount = deleteResult.rowCount;
      console.log(`🗑️ ${deletedCount} linking logs supprimés de la DB`);
    }

    return {
      success: true,
      archived: result.rows.length,
      deleted: deletedCount,
      filepath
    };

  } catch (error) {
    console.error('❌ Erreur archiveLinkingLogs:', error);
    throw error;
  }
}

/**
 * Archiver les logs de la veille (à exécuter quotidiennement)
 */
async function archiveYesterdayLogs(deleteAfterArchive = true) {
  try {
    await ensureArchiveDirs();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`📅 Archivage quotidien: ${yesterday.toISOString().split('T')[0]}`);

    const [auditResult, linkingResult] = await Promise.all([
      archiveAuditLogs(yesterday, today, deleteAfterArchive),
      archiveLinkingLogs(yesterday, today, deleteAfterArchive)
    ]);

    return {
      success: true,
      date: yesterday.toISOString().split('T')[0],
      audit: auditResult,
      linking: linkingResult,
      totalArchived: auditResult.archived + linkingResult.archived,
      totalDeleted: auditResult.deleted + linkingResult.deleted
    };

  } catch (error) {
    console.error('❌ Erreur archiveYesterdayLogs:', error);
    throw error;
  }
}

/**
 * Archiver les logs du mois précédent (résumé mensuel)
 */
async function archiveLastMonthLogs(deleteAfterArchive = true) {
  try {
    await ensureArchiveDirs();

    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    console.log(`📅 Archivage mensuel: ${format(firstDayLastMonth, 'yyyy-MM')}`);

    const [auditResult, linkingResult] = await Promise.all([
      archiveAuditLogs(firstDayLastMonth, firstDayThisMonth, deleteAfterArchive),
      archiveLinkingLogs(firstDayLastMonth, firstDayThisMonth, deleteAfterArchive)
    ]);

    // Créer un résumé mensuel
    await createMonthlySummary(firstDayLastMonth);

    return {
      success: true,
      month: format(firstDayLastMonth, 'yyyy-MM'),
      audit: auditResult,
      linking: linkingResult,
      totalArchived: auditResult.archived + linkingResult.archived,
      totalDeleted: auditResult.deleted + linkingResult.deleted
    };

  } catch (error) {
    console.error('❌ Erreur archiveLastMonthLogs:', error);
    throw error;
  }
}

/**
 * Créer un résumé mensuel
 */
async function createMonthlySummary(date) {
  try {
    const monthStr = format(date, 'yyyy-MM');
    const monthDir = path.join(AUDIT_DIR, monthStr);

    // Statistiques du mois
    const stats = await pool.query(
      `SELECT 
        table_name,
        operation,
        COUNT(*) as count,
        COUNT(DISTINCT performed_by) as unique_users,
        MIN(performed_at) as first_change,
        MAX(performed_at) as last_change
       FROM audit_log
       WHERE DATE_TRUNC('month', performed_at) = $1
       GROUP BY table_name, operation
       ORDER BY count DESC`,
      [date]
    );

    const summary = {
      month: monthStr,
      total_changes: stats.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      tables: stats.rows.reduce((acc, row) => {
        if (!acc[row.table_name]) {
          acc[row.table_name] = {};
        }
        acc[row.table_name][row.operation] = parseInt(row.count);
        return acc;
      }, {}),
      unique_users: [...new Set(stats.rows.map(r => r.unique_users))].length,
      period: {
        start: stats.rows[0]?.first_change,
        end: stats.rows[0]?.last_change
      },
      generated_at: new Date().toISOString()
    };

    const filepath = path.join(monthDir, `audit_${monthStr}_summary.json`);
    await fs.writeFile(filepath, JSON.stringify(summary, null, 2), 'utf8');

    console.log(`✅ Résumé mensuel créé: ${filepath}`);

    return summary;

  } catch (error) {
    console.error('❌ Erreur createMonthlySummary:', error);
    throw error;
  }
}

/**
 * Lister les archives disponibles
 */
async function listArchives(type = 'audit') {
  try {
    const baseDir = type === 'audit' ? AUDIT_DIR : LINKING_DIR;
    const months = await fs.readdir(baseDir);

    const archives = [];

    for (const month of months) {
      if (!month.match(/^\d{4}-\d{2}$/)) continue; // Ignorer les fichiers non-conformes

      const monthDir = path.join(baseDir, month);
      const files = await fs.readdir(monthDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filepath = path.join(monthDir, file);
        const stats = await fs.stat(filepath);

        archives.push({
          filename: file,
          month: month,
          size: stats.size,
          sizeHuman: formatBytes(stats.size),
          created: stats.birthtime,
          modified: stats.mtime,
          path: filepath
        });
      }
    }

    return archives.sort((a, b) => b.created - a.created);

  } catch (error) {
    console.error('❌ Erreur listArchives:', error);
    return [];
  }
}

/**
 * Lire une archive spécifique
 */
async function readArchive(month, filename) {
  try {
    const filepath = path.join(AUDIT_DIR, month, filename);
    const content = await fs.readFile(filepath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Erreur readArchive:', error);
    throw error;
  }
}

/**
 * Utilitaire : Formater bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

module.exports = {
  ensureArchiveDirs,
  archiveAuditLogs,
  archiveLinkingLogs,
  archiveYesterdayLogs,
  archiveLastMonthLogs,
  createMonthlySummary,
  listArchives,
  readArchive
};