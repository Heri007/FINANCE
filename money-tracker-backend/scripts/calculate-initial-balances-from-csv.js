const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// Parser CSV avec guillemets et virgules
function parseCSVLine(line) {
  // Utiliser un parser CSV simple
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
  
  return {
    description,
    category,
    amount,
    status,
    date,
  };
}

async function calculateInitialBalances() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 CALCUL DES SOLDES INITIAUX DEPUIS LES CSV\n');
    
    const csvConfigs = [
      { file: 'argent_liquide_mga.csv', accountId: 1, accountName: 'Argent Liquide' },
      { file: 'mvola_mga.csv', accountId: 2, accountName: 'MVola' },
      { file: 'orange_money_mga.csv', accountId: 3, accountName: 'Orange Money' },
      { file: 'boa_mga.csv', accountId: 4, accountName: 'BOA' },
    ];
    
    const adjustments = [];
    
    for (const config of csvConfigs) {
      console.log(`\n📄 Analyse: ${config.accountName}`);
      console.log('━'.repeat(60));
      
      // 1. Lire le CSV
      const csvPath = path.join(__dirname, '../csv/', config.file);
      if (!fs.existsSync(csvPath)) {
        console.log(`  ⚠️  Fichier introuvable: ${config.file}`);
        continue;
      }
      
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      console.log(`  📊 ${lines.length} lignes détectées`);
      
      // 2. Parser toutes les transactions
      let csvTotal = 0;
      const transactions = [];
      let parseErrors = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Ignorer header
        if (line.includes('PAYEE_ITEM_DESC') || line.includes('------')) continue;
        
        try {
          const parsed = parseCSVLine(line);
          
          if (parsed && parsed.amount !== 0) {
            transactions.push({
              date: parsed.date,
              amount: parsed.amount,
              description: parsed.description,
              category: parsed.category
            });
            csvTotal += parsed.amount;
          }
        } catch (err) {
          parseErrors++;
        }
      }
      
      console.log(`  ✅ ${transactions.length} transactions valides parsées`);
      if (parseErrors > 0) {
        console.log(`  ⚠️  ${parseErrors} lignes non parsées`);
      }
      console.log(`  💵 Total CSV: ${csvTotal.toLocaleString('fr-FR')} Ar`);
      
      if (transactions.length === 0) {
        console.log(`  ⚠️  Aucune transaction, ignoré`);
        continue;
      }
      
      // Afficher échantillon
      console.log(`\n  📝 Transactions parsées (3 premières):`);
      transactions.slice(0, 3).forEach(t => {
        console.log(`     ${t.date}: ${t.amount.toLocaleString('fr-FR')} Ar - ${t.description.substring(0, 40)}`);
      });
      
      // 3. Récupérer le solde actuel de la base
      const accountResult = await client.query(
        'SELECT balance FROM accounts WHERE id = $1',
        [config.accountId]
      );
      
      if (accountResult.rows.length === 0) {
        console.log(`  ❌ Compte introuvable en base`);
        continue;
      }
      
      const currentBalance = parseFloat(accountResult.rows[0].balance);
      console.log(`\n  🏦 Solde actuel en base: ${currentBalance.toLocaleString('fr-FR')} Ar`);
      
      // 4. Récupérer le total des transactions en base
      const dbResult = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as db_total,
          COUNT(*) as count,
          MIN(transaction_date) as first_date
        FROM transactions
        WHERE account_id = $1
      `, [config.accountId]);
      
      const { db_total, count, first_date } = dbResult.rows[0];
      const dbTotal = parseFloat(db_total);
      
      console.log(`  📊 ${count} transactions en base`);
      console.log(`  💵 Total en base: ${dbTotal.toLocaleString('fr-FR')} Ar`);
      
      // 5. Calculer le solde initial
      const initialBalance = currentBalance - dbTotal;
      
      console.log(`\n  🔧 CALCUL:`);
      console.log(`     Solde actuel: ${currentBalance.toLocaleString('fr-FR')} Ar`);
      console.log(`     - Total transactions: ${dbTotal.toLocaleString('fr-FR')} Ar`);
      console.log(`     = Solde initial: ${initialBalance.toLocaleString('fr-FR')} Ar`);
      
      if (Math.abs(initialBalance) < 1) {
        console.log(`\n  ✅ Solde initial proche de 0, aucun ajustement nécessaire`);
        continue;
      }
      
      // 6. Date pour l'ajustement
      const adjustmentDate = new Date(first_date);
      adjustmentDate.setDate(adjustmentDate.getDate() - 1);
      
      adjustments.push({
        accountId: config.accountId,
        accountName: config.accountName,
        initialBalance,
        adjustmentDate: adjustmentDate.toISOString().split('T')[0],
      });
      
      console.log(`\n  ✅ Ajustement à créer: ${initialBalance.toLocaleString('fr-FR')} Ar`);
      console.log(`     Date: ${adjustmentDate.toISOString().split('T')[0]}`);
    }
    
    // 7. Créer les ajustements
    if (adjustments.length === 0) {
      console.log('\n✅ Aucun ajustement nécessaire !\n');
      return;
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('🔧 CRÉATION DES AJUSTEMENTS');
    console.log('═'.repeat(60) + '\n');
    
    await client.query('BEGIN');
    
    for (const adj of adjustments) {
      console.log(`📝 ${adj.accountName}:`);
      
      // Supprimer ancien ajustement
      const deleteResult = await client.query(`
        DELETE FROM transactions
        WHERE account_id = $1 
        AND category = 'Extra Solde'
        AND description LIKE 'AJUSTEMENT AUTO%'
        RETURNING id
      `, [adj.accountId]);
      
      if (deleteResult.rowCount > 0) {
        console.log(`   🗑️  ${deleteResult.rowCount} ancien(s) ajustement(s) supprimé(s)`);
      }
      
      // Créer ajustement
      const type = adj.initialBalance > 0 ? 'income' : 'expense';
      const amount = Math.abs(adj.initialBalance);
      
      await client.query(`
        INSERT INTO transactions (
          account_id, type, amount, category, description,
          transaction_date, is_recurring, is_planned, is_posted,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, false, false, true, NOW(), NOW())
      `, [
        adj.accountId, type, amount, 'Extra Solde',
        'AJUSTEMENT AUTO (Solde Initial)', adj.adjustmentDate,
      ]);
      
      console.log(`   ✅ Ajustement créé: ${type === 'income' ? '+' : '-'}${amount.toLocaleString('fr-FR')} Ar`);
    }
    
    await client.query('COMMIT');
    
    // 8. Recalculer soldes
    console.log('\n🔄 Recalcul des soldes...');
    
    for (const adj of adjustments) {
      await client.query(`
        UPDATE accounts 
        SET balance = (
          SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
          FROM transactions WHERE account_id = $1
        )
        WHERE id = $1
      `, [adj.accountId]);
      
      const newBalance = await client.query(
        'SELECT balance FROM accounts WHERE id = $1',
        [adj.accountId]
      );
      
      console.log(`   💰 ${adj.accountName}: ${parseFloat(newBalance.rows[0].balance).toLocaleString('fr-FR')} Ar`);
    }
    
    console.log('\n✅ Ajustements terminés !\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

calculateInitialBalances();
