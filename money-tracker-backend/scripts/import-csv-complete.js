// scripts/import-csv-complete.js
// Import CSV COMPLET : remplace toutes les transactions
const pool = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const CSV_FOLDER = path.join(__dirname, '..', 'csv');

function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('-')) return dateStr.split(' ')[0].substring(0, 10);
  if (dateStr.includes('/')) {
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = '20' + year;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  return null;
}

async function importCsvComplete() {
  console.log('\n' + '═'.repeat(100));
  console.log('📥 IMPORT CSV COMPLET - SYNCHRONISATION APP MOBILE → APP WEB');
  console.log('═'.repeat(100));
  console.log(`\n📁 Dossier CSV: ${CSV_FOLDER}\n`);

  try {
    // Vider les transactions existantes
    console.log('🗑️  Suppression des transactions existantes...');
    await pool.query('DELETE FROM transactions');
    console.log('✅ Transactions supprimées\n');

    const csvFiles = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'boa_mga.csv', accountId: 4, accountName: 'Compte BOA' }
    ];

    let totalImported = 0;
    let totalErrors = 0;

    for (const csvInfo of csvFiles) {
      console.log('─'.repeat(100));
      console.log(`\n📄 ${csvInfo.file} → ${csvInfo.accountName}`);

      const fullPath = path.join(CSV_FOLDER, csvInfo.file);

      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Fichier introuvable, ignoré.\n`);
        continue;
      }

      const transactions = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(fullPath)
          .pipe(csv())
          .on('data', (row) => transactions.push(row))
          .on('end', resolve)
          .on('error', reject);
      });

      console.log(`   📊 ${transactions.length} lignes dans le CSV`);

      let imported = 0;
      let skipped = 0;

      for (const trx of transactions) {
        const rawAmount = trx['QUANTITÉ'] || trx['QUANTITE'] || '0';
        const amount = parseFloat(rawAmount.replace(',', '.'));
        const date = parseDate(trx['TRAN_DATE']);
        const description = (trx['PAYEE_ITEM_DESC'] || 'Import CSV').trim();
        const category = (trx['CATÉGORIE'] || trx['CATEGORIE'] || 'Autre').trim();

        if (!date || isNaN(amount)) {
          skipped++;
          continue;
        }

        const type = amount < 0 ? 'expense' : 'income';
        const absAmount = Math.abs(amount);

        try {
          await pool.query(`
            INSERT INTO transactions 
              (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
            VALUES ($1, $2, $3, $4, $5, $6, true, false)
          `, [csvInfo.accountId, type, absAmount, category, description, date]);
          imported++;
        } catch (err) {
          console.error(`      ❌ Erreur: ${description.substring(0, 30)} - ${err.message}`);
          totalErrors++;
        }
      }

      console.log(`   ✅ ${imported} transactions importées`);
      if (skipped > 0) {
        console.log(`   ⚠️  ${skipped} lignes invalides ignorées`);
      }
      console.log('');

      totalImported += imported;
    }

    // Recalculer tous les soldes
    console.log('═'.repeat(100));
    console.log('🔄 RECALCUL DES SOLDES...\n');

    const accounts = await pool.query('SELECT id, name FROM accounts ORDER BY id');

    for (const acc of accounts.rows) {
      const result = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance,
          COUNT(*) as count
        FROM transactions 
        WHERE account_id = $1 AND is_posted = true
      `, [acc.id]);

      const balance = parseFloat(result.rows[0].balance);
      const count = parseInt(result.rows[0].count);

      await pool.query(`
        UPDATE accounts 
        SET balance = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [balance, acc.id]);

      const status = balance >= 0 ? '✅' : '❌';
      console.log(`   ${status} ${acc.name}: ${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${count} trx)`);
    }

    // Résumé
    console.log('\n' + '═'.repeat(100));
    console.log('📊 RÉSUMÉ');
    console.log('═'.repeat(100));
    console.log(`\n   ✅ Total importé: ${totalImported} transactions`);
    if (totalErrors > 0) {
      console.log(`   ❌ Erreurs: ${totalErrors}`);
    }
    console.log(`\n   ✅ Synchronisation terminée !\n`);
    console.log('═'.repeat(100) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

importCsvComplete();
