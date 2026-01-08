const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Parser CSV
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current) values.push(current.trim());
  
  if (values.length < 5) return null;
  
  const description = values[0];
  const category = values[1];
  const amount = parseFloat(values[2]);
  const status = values[3];
  const date = values[4];
  
  if (!date || isNaN(amount)) return null;
  
  return { description, category, amount, status, date };
}

async function smartImportV2() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 IMPORT INTELLIGENT V2 (avec détection contrainte DB)');
    console.log('═'.repeat(80) + '\n');

    const csvConfigs = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'orange_money_mga.csv', accountId: 3, accountName: 'Orange Money' },
      { file: 'boa_mga.csv', accountId: 4, accountName: 'BOA' },
    ];

    let totalImported = 0;
    let totalSkipped = 0;

    for (const config of csvConfigs) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📄 ${config.accountName}`);
      console.log('─'.repeat(80) + '\n');

      await client.query('BEGIN');

      try {
        // 1. Lire CSV
        const csvPath = path.join(__dirname, '../csv/', config.file);
        if (!fs.existsSync(csvPath)) {
          console.log(`  ⚠️  Fichier introuvable: ${config.file}`);
          await client.query('ROLLBACK');
          continue;
        }

        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        const csvTransactions = [];
        
        for (const line of lines) {
          if (line.includes('PAYEE_ITEM_DESC') || line.includes('------')) continue;
          const parsed = parseCSVLine(line);
          if (parsed) csvTransactions.push(parsed);
        }

        console.log(`📊 CSV: ${csvTransactions.length} transactions`);

        // 2. Récupérer les transactions existantes
        const dbResult = await client.query(`
          SELECT 
            transaction_date,
            amount,
            description,
            type,
            category
          FROM transactions
          WHERE account_id = $1
        `, [config.accountId]);

        console.log(`🏦 DB: ${dbResult.rows.length} transactions existantes`);

        // 3. ✅ Créer un Set avec EXACTEMENT les mêmes champs que la contrainte
        const existingSignatures = new Set();
        
        dbResult.rows.forEach(t => {
          const date = t.transaction_date.toISOString().split('T')[0];
          const amount = parseFloat(t.amount).toFixed(2);
          const type = t.type;
          const description = t.description;
          
          // Signature complète : account_id + date + amount + description + type
          const sig = `${config.accountId}|${date}|${amount}|${description}|${type}`;
          existingSignatures.add(sig);
        });

        // 4. Filtrer les nouvelles avec la MÊME logique
        const newTransactions = [];
        const skipped = [];

        csvTransactions.forEach(csvTx => {
          const type = csvTx.amount > 0 ? 'income' : 'expense';
          const amount = Math.abs(csvTx.amount).toFixed(2);
          
          // Même signature que la contrainte DB
          const sig = `${config.accountId}|${csvTx.date}|${amount}|${csvTx.description}|${type}`;
          
          if (existingSignatures.has(sig)) {
            skipped.push(csvTx);
          } else {
            newTransactions.push(csvTx);
            // Ajouter au Set pour éviter les doublons dans le CSV lui-même
            existingSignatures.add(sig);
          }
        });

        console.log(`✅ Nouvelles: ${newTransactions.length}`);
        console.log(`⚠️  Ignorées (déjà en base): ${skipped.length}\n`);

        // 5. Importer les nouvelles
        if (newTransactions.length > 0) {
          console.log('🚀 Import en cours...\n');

          let imported = 0;
          let errors = 0;

          for (const tx of newTransactions) {
            const type = tx.amount > 0 ? 'income' : 'expense';
            const amount = Math.abs(tx.amount);

            try {
              await client.query(`
                INSERT INTO transactions (
                  account_id,
                  type,
                  amount,
                  category,
                  description,
                  transaction_date,
                  is_planned,
                  is_posted,
                  created_at,
                  updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, false, true, NOW(), NOW())
              `, [
                config.accountId,
                type,
                amount,
                tx.category || 'Autre',
                tx.description,
                tx.date
              ]);

              imported++;
            } catch (err) {
              if (errors === 0) {
                console.error(`\n❌ ERREUR INATTENDUE (ne devrait pas arriver):`);
                console.error(`   Code: ${err.code}`);
                console.error(`   Message: ${err.message}`);
                console.error(`   Transaction: ${tx.date} | ${tx.amount} | ${tx.description}`);
                console.error(`   Type: ${type}`);
                console.error('');
              }
              errors++;
            }
          }

          console.log(`✅ ${imported} transactions importées`);
          if (errors > 0) {
            console.log(`❌ ${errors} erreurs (contrainte DB)\n`);
          }

          totalImported += imported;
        } else {
          console.log('ℹ️  Aucune nouvelle transaction à importer\n');
        }

        totalSkipped += skipped.length;

        // 6. Recalculer le solde
        await client.query(`
          UPDATE accounts 
          SET balance = (
            SELECT COALESCE(SUM(
              CASE WHEN type = 'income' THEN amount ELSE -amount END
            ), 0)
            FROM transactions
            WHERE account_id = $1
          )
          WHERE id = $1
        `, [config.accountId]);

        const newBalance = await client.query(
          'SELECT balance FROM accounts WHERE id = $1',
          [config.accountId]
        );

        console.log(`💰 Nouveau solde: ${parseFloat(newBalance.rows[0].balance).toLocaleString('fr-FR')} Ar`);

        await client.query('COMMIT');

      } catch (accountError) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Erreur pour ${config.accountName}:`, accountError.message);
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('📊 RÉSUMÉ GLOBAL');
    console.log('═'.repeat(80) + '\n');
    console.log(`✅ Total importé: ${totalImported} nouvelles transactions`);
    console.log(`⚠️  Total ignoré: ${totalSkipped} doublons`);
    console.log('\n✅ Import terminé !\n');

  } catch (error) {
    console.error('❌ Erreur globale:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

smartImportV2();
