const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Parser CSV avec guillemets et virgules
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
  
  // Format: Description, Catégorie, Montant, Statut, Date, Remarques
  if (values.length < 5) return null;
  
  const description = values[0];
  const category = values[1];
  const amount = parseFloat(values[2]);
  const status = values[3];
  const date = values[4];
  
  if (!date || isNaN(amount)) return null;
  
  return { description, category, amount, status, date };
}

async function compareDBvsCSV() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 COMPARAISON : TRANSACTIONS DB vs CSV');
    console.log('═'.repeat(80) + '\n');

    // Configuration des CSV et comptes
    const csvConfigs = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'orange_money_mga.csv', accountId: 3, accountName: 'Orange Money' },
      { file: 'boa_mga.csv', accountId: 4, accountName: 'BOA' },
    ];

    let totalCSVTransactions = 0;
    let totalDBTransactions = 0;
    let totalNewTransactions = 0;
    let totalDuplicates = 0;
    let totalRevenuCSV = 0;
    let totalDepenseCSV = 0;
    let totalRevenuDB = 0;
    let totalDepenseDB = 0;

    const detailedReport = [];

    for (const config of csvConfigs) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📄 Analyse: ${config.accountName} (ID: ${config.accountId})`);
      console.log('─'.repeat(80) + '\n');

      // ============================================================
      // 1. LIRE LE CSV
      // ============================================================
      
      const csvPath = path.join(__dirname, '../csv/', config.file);
      if (!fs.existsSync(csvPath)) {
        console.log(`  ⚠️  Fichier introuvable: ${config.file}`);
        continue;
      }

      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      const csvTransactions = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('PAYEE_ITEM_DESC') || line.includes('------')) continue;
        
        const parsed = parseCSVLine(line);
        if (parsed) {
          csvTransactions.push(parsed);
        }
      }

      console.log(`📊 CSV: ${csvTransactions.length} transactions`);
      totalCSVTransactions += csvTransactions.length;

      // Calculer revenus/dépenses CSV
      let csvRevenu = 0;
      let csvDepense = 0;
      
      csvTransactions.forEach(t => {
        if (t.amount > 0) {
          csvRevenu += t.amount;
        } else {
          csvDepense += Math.abs(t.amount);
        }
      });

      totalRevenuCSV += csvRevenu;
      totalDepenseCSV += csvDepense;

      // ============================================================
      // 2. RÉCUPÉRER LES TRANSACTIONS DE LA BASE
      // ============================================================

      const dbResult = await client.query(`
        SELECT 
          id,
          transaction_date,
          amount,
          type,
          description,
          category,
          created_at
        FROM transactions
        WHERE account_id = $1
        ORDER BY transaction_date DESC
      `, [config.accountId]);

      const dbTransactions = dbResult.rows;
      console.log(`🏦 DB: ${dbTransactions.length} transactions\n`);
      totalDBTransactions += dbTransactions.length;

      // Calculer revenus/dépenses DB
      let dbRevenu = 0;
      let dbDepense = 0;
      
      dbTransactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
          dbRevenu += amount;
        } else {
          dbDepense += amount;
        }
      });

      totalRevenuDB += dbRevenu;
      totalDepenseDB += dbDepense;

      // ============================================================
      // 3. CRÉER UN INDEX DES TRANSACTIONS DB
      // ============================================================

      const dbIndex = new Map();
      
      dbTransactions.forEach(t => {
        const date = t.transaction_date.toISOString().split('T')[0];
        const amount = parseFloat(t.amount);
        const amountCSV = t.type === 'income' ? amount : -amount;
        const sig = `${date}|${amountCSV.toFixed(2)}|${t.description}`;
        
        if (!dbIndex.has(sig)) {
          dbIndex.set(sig, []);
        }
        dbIndex.get(sig).push(t);
      });

      console.log(`🔑 ${dbIndex.size} signatures uniques en DB\n`);

      // ============================================================
      // 4. COMPARER CSV AVEC DB
      // ============================================================

      const newTransactions = [];
      const duplicates = [];
      const matched = [];

      csvTransactions.forEach((csvTx, index) => {
        const sig = `${csvTx.date}|${csvTx.amount.toFixed(2)}|${csvTx.description}`;
        
        if (dbIndex.has(sig)) {
          const dbMatches = dbIndex.get(sig);
          matched.push({
            csv: csvTx,
            db: dbMatches[0],
            sig
          });
          duplicates.push(csvTx);
        } else {
          newTransactions.push(csvTx);
        }
      });

      console.log('📊 RÉSULTAT DE LA COMPARAISON:\n');
      console.log(`  ✅ Nouvelles transactions (CSV uniquement): ${newTransactions.length}`);
      console.log(`  ⚠️  Déjà en base (doublons): ${duplicates.length}`);
      console.log(`  🔍 Transactions en DB seulement: ${dbTransactions.length - matched.length}\n`);

      totalNewTransactions += newTransactions.length;
      totalDuplicates += duplicates.length;

      // ============================================================
      // 5. DÉTAILS FINANCIERS
      // ============================================================

      let newRevenu = 0;
      let newDepense = 0;

      newTransactions.forEach(t => {
        if (t.amount > 0) {
          newRevenu += t.amount;
        } else {
          newDepense += Math.abs(t.amount);
        }
      });

      console.log('💰 IMPACT FINANCIER:\n');
      console.log('  CSV:');
      console.log(`    • Revenus: ${csvRevenu.toLocaleString('fr-FR')} Ar`);
      console.log(`    • Dépenses: ${csvDepense.toLocaleString('fr-FR')} Ar`);
      console.log(`    • NET: ${(csvRevenu - csvDepense).toLocaleString('fr-FR')} Ar\n`);
      
      console.log('  DB actuelle:');
      console.log(`    • Revenus: ${dbRevenu.toLocaleString('fr-FR')} Ar`);
      console.log(`    • Dépenses: ${dbDepense.toLocaleString('fr-FR')} Ar`);
      console.log(`    • NET: ${(dbRevenu - dbDepense).toLocaleString('fr-FR')} Ar\n`);
      
      if (newTransactions.length > 0) {
        console.log('  Nouvelles (à importer):');
        console.log(`    • Revenus: ${newRevenu.toLocaleString('fr-FR')} Ar`);
        console.log(`    • Dépenses: ${newDepense.toLocaleString('fr-FR')} Ar`);
        console.log(`    • NET: ${(newRevenu - newDepense).toLocaleString('fr-FR')} Ar\n`);
      }

      // ============================================================
      // 6. AFFICHER QUELQUES EXEMPLES
      // ============================================================

      if (newTransactions.length > 0) {
        console.log('📝 EXEMPLES DE NOUVELLES TRANSACTIONS (5 premières):\n');
        console.log('┌──────────────┬──────────────────┬─────────────────────────────────────┐');
        console.log('│ Date         │ Montant          │ Description                         │');
        console.log('├──────────────┼──────────────────┼─────────────────────────────────────┤');
        
        newTransactions.slice(0, 5).forEach(t => {
          console.log(
            `│ ${t.date.padEnd(12)} │ ${t.amount.toLocaleString('fr-FR').padStart(16)} │ ${t.description.substring(0, 35).padEnd(35)} │`
          );
        });
        
        console.log('└──────────────┴──────────────────┴─────────────────────────────────────┘\n');
      }

      if (duplicates.length > 0) {
        console.log('⚠️  EXEMPLES DE DOUBLONS (5 premiers):\n');
        console.log('┌──────────────┬──────────────────┬─────────────────────────────────────┐');
        console.log('│ Date         │ Montant          │ Description                         │');
        console.log('├──────────────┼──────────────────┼─────────────────────────────────────┤');
        
        duplicates.slice(0, 5).forEach(t => {
          console.log(
            `│ ${t.date.padEnd(12)} │ ${t.amount.toLocaleString('fr-FR').padStart(16)} │ ${t.description.substring(0, 35).padEnd(35)} │`
          );
        });
        
        console.log('└──────────────┴──────────────────┴─────────────────────────────────────┘\n');
      }

      // Stocker pour le rapport global
      detailedReport.push({
        account: config.accountName,
        csvCount: csvTransactions.length,
        dbCount: dbTransactions.length,
        newCount: newTransactions.length,
        duplicatesCount: duplicates.length,
        csvRevenu,
        csvDepense,
        dbRevenu,
        dbDepense,
        newRevenu,
        newDepense
      });
    }

    // ============================================================
    // 7. RAPPORT GLOBAL
    // ============================================================

    console.log('\n' + '═'.repeat(80));
    console.log('📊 RAPPORT GLOBAL');
    console.log('═'.repeat(80) + '\n');

    console.log('┌──────────────────────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('│ Compte                   │ CSV      │ DB       │ Nouveau  │ Doublons │');
    console.log('├──────────────────────────┼──────────┼──────────┼──────────┼──────────┤');
    
    detailedReport.forEach(r => {
      console.log(
        `│ ${r.account.padEnd(24)} │ ${String(r.csvCount).padStart(8)} │ ${String(r.dbCount).padStart(8)} │ ${String(r.newCount).padStart(8)} │ ${String(r.duplicatesCount).padStart(8)} │`
      );
    });
    
    console.log('├──────────────────────────┼──────────┼──────────┼──────────┼──────────┤');
    console.log(
      `│ ${'TOTAL'.padEnd(24)} │ ${String(totalCSVTransactions).padStart(8)} │ ${String(totalDBTransactions).padStart(8)} │ ${String(totalNewTransactions).padStart(8)} │ ${String(totalDuplicates).padStart(8)} │`
    );
    console.log('└──────────────────────────┴──────────┴──────────┴──────────┴──────────┘\n');

    console.log('💰 TOTAUX FINANCIERS:\n');
    console.log('┌──────────────────────────┬──────────────────┬──────────────────┐');
    console.log('│                          │ CSV              │ DB               │');
    console.log('├──────────────────────────┼──────────────────┼──────────────────┤');
    console.log(`│ Revenus                  │ ${totalRevenuCSV.toLocaleString('fr-FR').padStart(16)} │ ${totalRevenuDB.toLocaleString('fr-FR').padStart(16)} │`);
    console.log(`│ Dépenses                 │ ${totalDepenseCSV.toLocaleString('fr-FR').padStart(16)} │ ${totalDepenseDB.toLocaleString('fr-FR').padStart(16)} │`);
    console.log(`│ NET                      │ ${(totalRevenuCSV - totalDepenseCSV).toLocaleString('fr-FR').padStart(16)} │ ${(totalRevenuDB - totalDepenseDB).toLocaleString('fr-FR').padStart(16)} │`);
    console.log('└──────────────────────────┴──────────────────┴──────────────────┘\n');

    const diffRevenu = totalRevenuCSV - totalRevenuDB;
    const diffDepense = totalDepenseCSV - totalDepenseDB;
    const diffNet = diffRevenu - diffDepense;

    console.log('📊 DIFFÉRENCES CSV - DB:\n');
    console.log(`  • Revenus: ${diffRevenu >= 0 ? '+' : ''}${diffRevenu.toLocaleString('fr-FR')} Ar`);
    console.log(`  • Dépenses: ${diffDepense >= 0 ? '+' : ''}${diffDepense.toLocaleString('fr-FR')} Ar`);
    console.log(`  • NET: ${diffNet >= 0 ? '+' : ''}${diffNet.toLocaleString('fr-FR')} Ar\n`);

    // ============================================================
    // 8. RECOMMANDATIONS
    // ============================================================

    console.log('═'.repeat(80));
    console.log('💡 RECOMMANDATIONS\n');

    if (totalNewTransactions === 0) {
      console.log('✅ Tous les CSV sont déjà importés dans la base de données.');
      console.log('   Aucune action nécessaire.\n');
    } else {
      console.log(`⚠️  ${totalNewTransactions} nouvelles transactions détectées dans les CSV.\n`);
      console.log('   Actions recommandées:');
      console.log('   1. Vérifier les exemples de nouvelles transactions ci-dessus');
      console.log('   2. Si tout est correct, lancer l\'import via l\'interface');
      console.log('   3. Ou utiliser: node scripts/import-missing-transactions.js\n');
      
      console.log(`   Impact financier de l'import:`);
      console.log(`   • Revenus: +${(totalRevenuCSV - totalRevenuDB).toLocaleString('fr-FR')} Ar`);
      console.log(`   • Dépenses: +${(totalDepenseCSV - totalDepenseDB).toLocaleString('fr-FR')} Ar`);
      console.log(`   • NET: ${diffNet >= 0 ? '+' : ''}${diffNet.toLocaleString('fr-FR')} Ar\n`);
    }

    if (totalDuplicates > 0) {
      console.log(`ℹ️  ${totalDuplicates} transactions CSV sont déjà en base (doublons ignorés).\n`);
    }

    console.log('═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

compareDBvsCSV();
