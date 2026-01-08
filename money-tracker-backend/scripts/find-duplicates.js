// scripts/find-duplicates.js
const pool = require('../config/database');

async function findDuplicates() {
  try {
    console.log('🔍 Recherche de doublons dans Argent Liquide...\n');
    
    // 1. Doublons exacts (montant + description + date)
    const exactDuplicates = await pool.query(`
      SELECT 
        amount,
        description,
        transaction_date,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY id) as ids,
        ARRAY_AGG(created_at ORDER BY id) as created_dates
      FROM transactions
      WHERE account_id = 1
      GROUP BY amount, description, transaction_date
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, amount DESC
    `);
    
    if (exactDuplicates.rows.length > 0) {
      console.log(`⚠️  ${exactDuplicates.rows.length} groupes de doublons EXACTS trouvés:\n`);
      
      exactDuplicates.rows.forEach(dup => {
        console.log(`   Montant: ${parseFloat(dup.amount).toLocaleString()} Ar`);
        console.log(`   Description: "${dup.description}"`);
        console.log(`   Date: ${dup.transaction_date.toISOString().split('T')[0]}`);
        console.log(`   IDs: ${dup.ids.join(', ')}`);
        console.log(`   Créés: ${dup.created_dates.map(d => d.toISOString().split('T')[0] + ' ' + d.toISOString().split('T')[1].slice(0,8)).join(' | ')}`);
        console.log('   ---');
      });
    } else {
      console.log('✅ Aucun doublon EXACT trouvé');
    }
    
    // 2. Doublons probables (même montant + description, dates proches)
    console.log('\n🔎 Recherche de doublons PROBABLES (dates proches)...\n');
    
    const suspectDuplicates = await pool.query(`
      WITH ranked_transactions AS (
        SELECT 
          id,
          amount,
          description,
          transaction_date,
          created_at,
          LAG(id) OVER (PARTITION BY amount, description ORDER BY transaction_date) as prev_id,
          LAG(transaction_date) OVER (PARTITION BY amount, description ORDER BY transaction_date) as prev_date
        FROM transactions
        WHERE account_id = 1
      )
      SELECT 
        id,
        prev_id,
        amount,
        description,
        transaction_date,
        prev_date,
        (transaction_date - prev_date) as days_diff,
        created_at
      FROM ranked_transactions
      WHERE prev_id IS NOT NULL
        AND (transaction_date - prev_date) <= 7
      ORDER BY amount DESC, transaction_date DESC
    `);
    
    if (suspectDuplicates.rows.length > 0) {
      console.log(`⚠️  ${suspectDuplicates.rows.length} doublons PROBABLES trouvés:\n`);
      
      suspectDuplicates.rows.forEach(dup => {
        console.log(`   IDs: ${dup.prev_id} → ${dup.id}`);
        console.log(`   Montant: ${parseFloat(dup.amount).toLocaleString()} Ar`);
        console.log(`   Description: "${dup.description}"`);
        console.log(`   Dates: ${dup.prev_date.toISOString().split('T')[0]} → ${dup.transaction_date.toISOString().split('T')[0]} (${dup.days_diff} jours)`);
        console.log(`   Créé: ${dup.created_at.toISOString()}`);
        console.log('   ---');
      });
    } else {
      console.log('✅ Aucun doublon PROBABLE trouvé');
    }
    
    // 3. Transaction d'ajustement suspecte
    console.log('\n🚨 Vérification de la transaction d\'ajustement...\n');
    
    const adjustmentTx = await pool.query(`
      SELECT id, amount, description, transaction_date, created_at
      FROM transactions
      WHERE account_id = 1 
        AND (description ILIKE '%balance%' OR amount = 40400)
      ORDER BY created_at DESC
    `);
    
    if (adjustmentTx.rows.length > 0) {
      console.log('⚠️  Transaction(s) d\'ajustement trouvée(s):');
      adjustmentTx.rows.forEach(tx => {
        console.log(`   ID ${tx.id}: ${tx.description} | ${tx.amount} Ar | ${tx.created_at.toISOString()}`);
      });
    }
    
    // 4. Statistiques
    console.log('\n📊 STATISTIQUES:\n');
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT amount) as unique_amounts,
        COUNT(DISTINCT description) as unique_descriptions,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
      FROM transactions
      WHERE account_id = 1
    `);
    
    const s = stats.rows[0];
    console.log(`   Total transactions: ${s.total_transactions}`);
    console.log(`   Montants uniques: ${s.unique_amounts}`);
    console.log(`   Descriptions uniques: ${s.unique_descriptions}`);
    console.log(`   Total revenus: ${parseFloat(s.total_income).toLocaleString()} Ar`);
    console.log(`   Total dépenses: ${parseFloat(s.total_expense).toLocaleString()} Ar`);
    console.log(`   Solde calculé: ${(parseFloat(s.total_income) - parseFloat(s.total_expense)).toLocaleString()} Ar`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    process.exit(0);
  }
}

findDuplicates();
