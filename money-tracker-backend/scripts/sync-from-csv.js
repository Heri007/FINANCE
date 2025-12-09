// scripts/sync-from-csv.js - VERSION FINALE CORRIGÉE
const pool = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const CSV_FOLDER = path.join(__dirname, '..', 'csv');

// ✅ SOLDES RÉELS (vérifiés avec votre backup JSON)
const REAL_BALANCES = {
  1: 241300,      // Argent Liquide
  2: 22050,       // MVola
  3: 6791,        // Orange Money
  4: 38602,      // Compte BOA 
  5: 101000000,    // Coffre 
  6: 9821300,     // Avoir
  7: 0        // Redotpay
};

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

async function syncFromCsv() {
  console.log('\n' + '═'.repeat(100));
  console.log('🔄 SYNCHRONISATION COMPLÈTE : CSV → APP WEB');
  console.log('═'.repeat(100));
  console.log(`\n📁 Dossier CSV: ${CSV_FOLDER}\n`);

  try {
    // Vider les transactions existantes
    console.log('🗑️  Suppression des transactions existantes...');
    await pool.query('DELETE FROM transactions');
    console.log('✅ Transactions supprimées\n');

    // ✅ MAPPING CORRIGÉ SELON LE CONTENU RÉEL DES CSV
    const csvFiles = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'orange_money_mga.csv', accountId: 3, accountName: 'Orange Money' },
      // Pas de CSV pour Compte BOA (ID 4) - Juste ajustement SI
      { file: 'coffre_mga.csv', accountId: 5, accountName: 'Coffre' },        // ← CORRIGÉ
      { file: 'avoir_mga.csv', accountId: 6, accountName: 'Redotpay' },       // ← CORRIGÉ
      { file: 'boa_mga.csv', accountId: 7, accountName: 'Avoir' }             // ← CORRIGÉ
    ];

    const accountBalances = {};

    // ÉTAPE 1 : Importer tous les CSV
    for (const csvInfo of csvFiles) {
      console.log('─'.repeat(100));
      console.log(`\n📄 ${csvInfo.file} → ${csvInfo.accountName} (ID: ${csvInfo.accountId})`);

      const fullPath = path.join(CSV_FOLDER, csvInfo.file);

      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Fichier introuvable, ignoré.\n`);
        accountBalances[csvInfo.accountId] = 0;
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
      let csvBalance = 0;
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

        // Calculer le solde du CSV
        if (type === 'income') {
          csvBalance += absAmount;
        } else {
          csvBalance -= absAmount;
        }

        try {
          await pool.query(`
            INSERT INTO transactions 
              (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
            VALUES ($1, $2, $3, $4, $5, $6, true, false)
          `, [csvInfo.accountId, type, absAmount, category, description, date]);
          imported++;
        } catch (err) {
          // Ignorer les doublons silencieusement
        }
      }

      accountBalances[csvInfo.accountId] = csvBalance;

      console.log(`   ✅ ${imported} transactions importées`);
      if (skipped > 0) {
        console.log(`   ⚠️  ${skipped} lignes invalides ignorées`);
      }
      console.log(`   📊 Solde calculé CSV: ${csvBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`);
    }

    // ÉTAPE 2 : Calculer et ajouter les ajustements
    console.log('═'.repeat(100));
    console.log('🔧 AJUSTEMENT DES SOLDES\n');

    for (const [accountIdStr, realBalance] of Object.entries(REAL_BALANCES)) {
      const accountId = parseInt(accountIdStr);
      const csvBalance = accountBalances[accountId] || 0;
      const adjustment = realBalance - csvBalance;

      if (Math.abs(adjustment) < 0.01) {
        continue;
      }

      const account = await pool.query('SELECT name FROM accounts WHERE id = $1', [accountId]);
      if (account.rows.length === 0) continue;

      const accountName = account.rows[0].name;

      console.log(`📊 ${accountName} (ID: ${accountId}):`);
      console.log(`   Solde CSV: ${csvBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      console.log(`   Solde réel app mobile: ${realBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      console.log(`   Ajustement nécessaire: ${adjustment >= 0 ? '+' : ''}${adjustment.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);

      const adjustmentType = adjustment > 0 ? 'income' : 'expense';
      const adjustmentAmount = Math.abs(adjustment);
      const adjustmentDate = new Date().toISOString().split('T')[0];

      try {
        await pool.query(`
          INSERT INTO transactions 
            (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
          VALUES ($1, $2, $3, 'Extra Solde', 'AJUSTEMENT AUTO (Solde Initial)', $4, true, false)
        `, [accountId, adjustmentType, adjustmentAmount, adjustmentDate]);

        console.log(`   ✅ Transaction d'ajustement ajoutée\n`);
      } catch (err) {
        console.error(`   ❌ Erreur ajustement: ${err.message}\n`);
      }
    }

    // ÉTAPE 3 : Recalculer tous les soldes
    console.log('═'.repeat(100));
    console.log('🔄 RECALCUL FINAL DES SOLDES\n');

    const accounts = await pool.query('SELECT id, name FROM accounts ORDER BY id');

    let totalMatch = 0;
    let totalMismatch = 0;

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
      const realBalance = REAL_BALANCES[acc.id] || 0;

      await pool.query(`
        UPDATE accounts 
        SET balance = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [balance, acc.id]);

      const status = balance >= 0 ? '✅' : '❌';
      const diff = Math.abs(balance - realBalance);
      const match = diff < 0.01 ? '✅' : '⚠️';
      
      if (diff < 0.01) {
        totalMatch++;
      } else {
        totalMismatch++;
      }
      
      console.log(`${status} ${acc.name} (ID: ${acc.id}): ${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${count} trx) ${match}`);
      
      if (diff >= 0.01) {
        console.log(`   ⚠️  Écart: ${diff.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      }
    }

    // Résumé
    console.log('\n' + '═'.repeat(100));
    console.log('📊 RÉSUMÉ DE LA SYNCHRONISATION');
    console.log('═'.repeat(100));
    console.log(`\n   ✅ Comptes synchronisés: ${totalMatch}`);
    if (totalMismatch > 0) {
      console.log(`   ⚠️  Comptes avec écarts: ${totalMismatch}`);
      console.log(`\n   💡 Vérifiez REAL_BALANCES dans le script et relancez.`);
    } else {
      console.log(`\n   🎉 PARFAIT ! Tous les soldes correspondent à votre app mobile.`);
    }
    console.log('\n' + '═'.repeat(100) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

syncFromCsv();
