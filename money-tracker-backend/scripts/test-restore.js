// scripts/test-restore.js
const pool = require('../config/database');

async function testRestore() {
  console.log('🧪 TEST DE RESTAURATION\n');

  try {
    // 1. Vérifier les comptes
    const accountsResult = await pool.query('SELECT id, name, balance FROM accounts ORDER BY id');
    console.log('📊 COMPTES:');
    accountsResult.rows.forEach(acc => {
      console.log(`  ${acc.id}. ${acc.name}: ${parseFloat(acc.balance).toLocaleString('fr-FR')} Ar`);
    });

    // 2. Vérifier les transactions
    const transactionsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted,
        COUNT(CASE WHEN is_planned = true THEN 1 END) as planned
      FROM transactions
    `);
    
    console.log('\n📊 TRANSACTIONS:');
    console.log(`  Total: ${transactionsResult.rows[0].total}`);
    console.log(`  Postées: ${transactionsResult.rows[0].posted}`);
    console.log(`  Planifiées: ${transactionsResult.rows[0].planned}`);

    // 3. Recalculer et comparer
    console.log('\n🔄 RECALCUL DES SOLDES...');
    
    for (const acc of accountsResult.rows) {
      const trxResult = await pool.query(`
        SELECT type, amount 
        FROM transactions 
        WHERE account_id = $1 
        AND is_posted = true
        ORDER BY transaction_date ASC
      `, [acc.id]);

      let calculatedBalance = 0;
      trxResult.rows.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
          calculatedBalance += amount;
        } else {
          calculatedBalance -= amount;
        }
      });

      const currentBalance = parseFloat(acc.balance);
      const diff = Math.abs(currentBalance - calculatedBalance);

      if (diff < 0.01) {
        console.log(`✅ ${acc.name}: ${currentBalance.toLocaleString('fr-FR')} Ar (correct)`);
      } else {
        console.log(`❌ ${acc.name}: ÉCART DÉTECTÉ`);
        console.log(`   Actuel: ${currentBalance.toLocaleString('fr-FR')} Ar`);
        console.log(`   Calculé: ${calculatedBalance.toLocaleString('fr-FR')} Ar`);
        console.log(`   Différence: ${diff.toFixed(2)} Ar`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur test:', error);
  } finally {
    await pool.end();
  }
}

testRestore();
