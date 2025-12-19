// controllers/importController.js - VERSION AUTOMATIQUE

const pool = require('../config/database');
const logger = require('../config/logger');

exports.importTransactions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transactions } = req.body;
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ 
        message: 'Format invalide', 
        status: 400 
      });
    }

    logger.info(`📥 Import de ${transactions.length} transactions`);

    // ✅ 1. Récupérer la dernière date d'import pour chaque compte
    const accountsResult = await client.query(`
      SELECT id, name, last_import_date 
      FROM accounts
    `);
    
    const accountCutoffs = {};
    accountsResult.rows.forEach(row => {
      accountCutoffs[row.id] = {
        name: row.name,
        cutoffDate: row.last_import_date
      };
    });

    // ✅ 2. Grouper les transactions par compte
    const transactionsByAccount = {};
    transactions.forEach(tx => {
      if (!transactionsByAccount[tx.account_id]) {
        transactionsByAccount[tx.account_id] = [];
      }
      transactionsByAccount[tx.account_id].push(tx);
    });

    let totalImported = 0;
    let totalSkipped = 0;
    let totalBeforeCutoff = 0;
    const importSummary = [];

    // ✅ 3. Traiter chaque compte séparément
    for (const [accountId, accountTransactions] of Object.entries(transactionsByAccount)) {
      const accountInfo = accountCutoffs[accountId];
      const cutoffDate = accountInfo?.cutoffDate;
      
      logger.info(`📦 Compte: ${accountInfo?.name || accountId} (${accountTransactions.length} transactions)`);
      if (cutoffDate) {
        logger.info(`   📅 Cutoff automatique: ${cutoffDate}`);
      }

      let imported = 0;
      let skipped = 0;
      let beforeCutoff = 0;
      let maxDateImported = null;

      for (const tx of accountTransactions) {
        try {
          const type = tx.type || 'expense';
          const amount = parseFloat(tx.amount);
          const category = tx.category || 'Autre';
          const description = tx.description || null;
          const transactionDate = tx.transaction_date;
          const isPlanned = tx.is_planned || false;
          const isPosted = tx.is_posted !== undefined ? tx.is_posted : true;
          const projectId = tx.project_id || null;
          const remarks = tx.remarks || '';

          // Validation basique
          if (!accountId || !transactionDate || isNaN(amount)) {
            skipped++;
            continue;
          }

          // ✅ FILTRE AUTOMATIQUE : Ignorer si <= last_import_date
          if (cutoffDate && transactionDate <= cutoffDate) {
            beforeCutoff++;
            continue;
          }

          // Insertion
          await client.query(
            `INSERT INTO transactions (
              account_id, type, amount, category, description,
              transaction_date, is_planned, is_posted, project_id, remarks,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
            [accountId, type, amount, category, description, transactionDate, isPlanned, isPosted, projectId, remarks]
          );
          
          imported++;
          
          // Tracker la date max importée
          if (!maxDateImported || transactionDate > maxDateImported) {
            maxDateImported = transactionDate;
          }
          
        } catch (txError) {
          if (txError.code === '23505') {
            skipped++;
            continue;
          }
          throw txError;
        }
      }

      // ✅ 4. Mettre à jour last_import_date si des transactions ont été importées
      if (imported > 0 && maxDateImported) {
        await client.query(
          `UPDATE accounts 
           SET last_import_date = $1 
           WHERE id = $2`,
          [maxDateImported, accountId]
        );
        
        logger.info(`   ✅ ${imported} importées, last_import_date mis à jour: ${maxDateImported}`);
      } else {
        logger.info(`   ℹ️  Aucune nouvelle transaction`);
      }

      totalImported += imported;
      totalSkipped += skipped;
      totalBeforeCutoff += beforeCutoff;

      importSummary.push({
        accountId,
        accountName: accountInfo?.name || `Compte ${accountId}`,
        imported,
        duplicates: skipped,
        beforeCutoff,
        newCutoffDate: maxDateImported
      });
    }

    await client.query('COMMIT');
    
    logger.info(`\n✅ IMPORT TERMINÉ:`);
    logger.info(`   • Importées: ${totalImported}`);
    logger.info(`   • Doublons: ${totalSkipped}`);
    logger.info(`   • Avant cutoff: ${totalBeforeCutoff}`);
    
    res.json({
      message: `${totalImported} transactions importées`,
      imported: totalImported,
      duplicates: totalSkipped,
      beforeCutoff: totalBeforeCutoff,
      summary: importSummary,
      status: 200
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Erreur import:', error);
    
    res.status(500).json({ 
      message: 'Erreur serveur', 
      status: 500
    });
    
  } finally {
    client.release();
  }
};
