// scripts/find-sync-gap.js
const pool = require('../config/database');

async function findSyncGap() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Recherche de l\'écart de 40 400 Ar...\n');
    
    // 1. Calculer le solde théorique
    const balanceResult = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as balance
      FROM transactions
      WHERE account_id = 1
        AND is_posted = true
    `);
    
    const calc = balanceResult.rows[0];
    console.log('💰 Calculs:');
    console.log(`   Revenus:  ${parseFloat(calc.total_income).toLocaleString()} Ar`);
    console.log(`   Dépenses: ${parseFloat(calc.total_expense).toLocaleString()} Ar`);
    console.log(`   Balance:  ${parseFloat(calc.balance).toLocaleString()} Ar`);
    
    // 2. Comparer avec le solde en base
    const accountResult = await client.query(
      'SELECT balance FROM accounts WHERE id = 1'
    );
    const dbBalance = parseFloat(accountResult.rows[0].balance);
    console.log(`\n🗄️  Solde DB: ${dbBalance.toLocaleString()} Ar`);
    
    const diff = dbBalance - parseFloat(calc.balance);
    console.log(`📊 Écart DB: ${diff.toLocaleString()} Ar`);
    
    // 3. Chercher des transactions potentiellement problématiques
    const suspectResult = await client.query(`
      SELECT 
        id,
        type,
        amount,
        description,
        transaction_date,
        created_at,
        is_posted
      FROM transactions
      WHERE account_id = 1
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log('\n📋 20 Dernières Transactions:');
    suspectResult.rows.forEach(tx => {
      console.log(`   ${tx.id} | ${tx.type === 'income' ? '+' : '-'}${tx.amount} Ar | ${tx.description} | ${tx.transaction_date.toISOString().split('T')[0]}`);
    });
    
    // 4. Recherche spécifique pour 40400 Ar
    console.log('\n🔎 Recherche de transactions exactes de 40 400 Ar:');
    const exactResult = await client.query(`
      SELECT id, type, amount, description, transaction_date, is_posted
      FROM transactions
      WHERE account_id = 1 
        AND amount = 40400
      ORDER BY created_at DESC
    `);
    
    if (exactResult.rows.length > 0) {
      console.log('   ✅ Trouvées:');
      exactResult.rows.forEach(tx => {
        console.log(`      ${tx.id} | ${tx.type} | ${tx.description} | Posted: ${tx.is_posted}`);
      });
    } else {
      console.log('   ❌ Aucune transaction de 40 400 Ar trouvée');
    }
    
    // 5. Recherche de combinaisons possibles
    console.log('\n🧮 Combinaisons possibles pour 40 400 Ar:');
    const recentResult = await client.query(`
      SELECT id, type, amount, description, transaction_date
      FROM transactions
      WHERE account_id = 1
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    
    // Chercher des combinaisons
    const txs = recentResult.rows;
    let found = false;
    
    for (let i = 0; i < txs.length - 1; i++) {
      for (let j = i + 1; j < txs.length; j++) {
        const sum = parseFloat(txs[i].amount) + parseFloat(txs[j].amount);
        if (Math.abs(sum - 40400) < 0.01) {
          console.log(`   ✅ ${txs[i].id} (${txs[i].amount}) + ${txs[j].id} (${txs[j].amount}) = ${sum} Ar`);
          console.log(`      → ${txs[i].description}`);
          console.log(`      → ${txs[j].description}`);
          found = true;
        }
      }
    }
    
    if (!found) {
      console.log('   ℹ️  Aucune combinaison simple de 2 transactions trouvée');
    }
    
    // 6. Vérifier les transactions non postées
    const unpostedResult = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE account_id = 1 AND is_posted = false
    `);
    
    if (parseInt(unpostedResult.rows[0].count) > 0) {
      console.log(`\n⚠️  ${unpostedResult.rows[0].count} transactions non postées trouvées`);
      console.log(`   Total: ${parseFloat(unpostedResult.rows[0].total).toLocaleString()} Ar`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

findSyncGap();
