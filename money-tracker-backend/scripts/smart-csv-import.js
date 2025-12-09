// scripts/smart-csv-import.js - VERSION COMPLÈTE FINALE
const pool = require('../config/database');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// ✅ Chemin vers le dossier CSV
const CSV_FOLDER = path.join(__dirname, '..', 'csv');

// ✅ Fonction pour créer une signature unique
function createSignature(accountId, date, amount, description) {
  let cleanDate;
  if (date instanceof Date) {
    cleanDate = date.toISOString().split('T')[0];
  } else if (typeof date === 'string') {
    cleanDate = date.split('T')[0].split(' ')[0];
  } else {
    return null;
  }
  
  const cleanAmount = Math.abs(parseFloat(amount)).toFixed(2);
  const cleanDesc = (description || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?@#$%^&*()]/g, '')
    .trim()
    .substring(0, 40);
  
  return `${accountId}|${cleanDate}|${cleanAmount}|${cleanDesc}`;
}

// ✅ Fonction pour parser une date
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  if (dateStr.includes('-')) {
    return dateStr.split(' ')[0].substring(0, 10);
  }
  
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

async function smartCsvImport() {
  console.log('\n' + '═'.repeat(100));
  console.log('📥 IMPORT CSV INTELLIGENT AVEC DÉTECTION DE DOUBLONS');
  console.log('═'.repeat(100));
  console.log(`\n📁 Dossier CSV: ${CSV_FOLDER}`);

  if (!fs.existsSync(CSV_FOLDER)) {
    console.error(`\n❌ ERREUR: Le dossier ${CSV_FOLDER} n'existe pas !`);
    console.log('\n💡 Créez le dossier: mkdir csv\n');
    process.exit(1);
  }

  try {
    console.log('\n📊 Récupération des transactions existantes...');
    const existingResult = await pool.query(`
      SELECT account_id, type, amount, description, transaction_date
      FROM transactions
      WHERE is_posted = true
    `);

    const existingSignatures = new Set();
    existingResult.rows.forEach(t => {
      const sig = createSignature(t.account_id, t.transaction_date, t.amount, t.description);
      if (sig) existingSignatures.add(sig);
    });

    console.log(`✅ ${existingSignatures.size} signatures existantes indexées\n`);

    const csvFiles = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'boa_mga.csv', accountId: 4, accountName: 'Compte BOA' }
    ];

    let totalNew = 0, totalDuplicates = 0, totalErrors = 0;

    for (const csvInfo of csvFiles) {
      console.log('─'.repeat(100));
      console.log(`\n📄 ${csvInfo.file} → ${csvInfo.accountName}`);

      const fullPath = path.join(CSV_FOLDER, csvInfo.file);

      if (!fs.existsSync(fullPath)) {
        console.log(`   ⚠️  Fichier introuvable`);
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

      console.log(`   📊 ${transactions.length} lignes`);

      const newTransactions = [];
      const duplicates = [];
      let invalidCount = 0;

      for (const trx of transactions) {
        const rawAmount = trx['QUANTITÉ'] || trx['QUANTITE'] || '0';
        const amount = parseFloat(rawAmount.replace(',', '.'));
        const date = parseDate(trx['TRAN_DATE']);
        const description = (trx['PAYEE_ITEM_DESC'] || 'Import CSV').trim();
        const category = (trx['CATÉGORIE'] || trx['CATEGORIE'] || 'Autre').trim();

        if (!date || isNaN(amount)) {
          invalidCount++;
          continue;
        }

        const type = amount < 0 ? 'expense' : 'income';
        const absAmount = Math.abs(amount);
        const sig = createSignature(csvInfo.accountId, date, absAmount, description);

        if (!sig) {
          invalidCount++;
          continue;
        }

        if (existingSignatures.has(sig)) {
          duplicates.push({ date, description, amount: absAmount });
        } else {
          newTransactions.push({
            accountId: csvInfo.accountId,
            type,
            amount: absAmount,
            date,
            description,
            category
          });
          existingSignatures.add(sig);
        }
      }

      console.log(`   ✅ ${newTransactions.length} nouvelles`);
      console.log(`   ⚠️  ${duplicates.length} doublons`);
      if (invalidCount > 0) console.log(`   ❌ ${invalidCount} invalides`);

      if (duplicates.length > 0 && duplicates.length <= 3) {
        console.log(`\n   🔍 Exemples de doublons:`);
        duplicates.slice(0, 3).forEach(d => {
          console.log(`      - ${d.date}: ${d.description.substring(0, 40)} (${d.amount} Ar)`);
        });
      }

      if (newTransactions.length > 0 && newTransactions.length <= 5) {
        console.log(`\n   📝 Nouvelles à importer:`);
        newTransactions.slice(0, 5).forEach(t => {
          const sign = t.type === 'income' ? '+' : '-';
          console.log(`      - ${t.date}: ${t.description.substring(0, 40)} ${sign}${t.amount} Ar`);
        });
      }

      totalNew += newTransactions.length;
      totalDuplicates += duplicates.length;
      totalErrors += invalidCount;

      if (newTransactions.length > 0) {
        console.log(`\n   📤 Import de ${newTransactions.length} transactions...`);
        let successCount = 0;

        for (const trx of newTransactions) {
          try {
            await pool.query(`
              INSERT INTO transactions 
                (account_id, type, amount, category, description, transaction_date, is_posted, is_planned)
              VALUES ($1, $2, $3, $4, $5, $6, true, false)
            `, [trx.accountId, trx.type, trx.amount, trx.category, trx.description, trx.date]);
            successCount++;
          } catch (err) {
            console.error(`      ❌ ${trx.description.substring(0, 30)}: ${err.message}`);
            totalErrors++;
          }
        }

        console.log(`   ✅ ${successCount}/${newTransactions.length} importées`);
      } else {
        console.log(`   ℹ️  Rien à importer`);
      }
      console.log('');
    }

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

      await pool.query('UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [balance, acc.id]);

      const status = balance >= 0 ? '✅' : '❌';
      console.log(`   ${status} ${acc.name}: ${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${count} trx)`);
    }

    console.log('\n' + '═'.repeat(100));
    console.log('📊 RÉSUMÉ');
    console.log('═'.repeat(100));
    console.log(`\n   ✅ Nouvelles: ${totalNew}`);
    console.log(`   ⚠️  Doublons: ${totalDuplicates}`);
    if (totalErrors > 0) console.log(`   ❌ Erreurs: ${totalErrors}`);
    
    console.log(totalNew > 0 
      ? `\n   ✅ Import réussi !` 
      : `\n   ℹ️  Base déjà à jour.`
    );
    
    console.log('\n' + '═'.repeat(100) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

smartCsvImport();
