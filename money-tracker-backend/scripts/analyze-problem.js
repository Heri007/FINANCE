// scripts/analyze-problem.js
const pool = require('../config/database');

async function analyzeProblem() {
  console.log('\n🔍 DIAGNOSTIC DU PROBLÈME\n');

  try {
    // Compter les transactions par compte
    const result = await pool.query(`
      SELECT 
        a.name,
        COUNT(*) FILTER (WHERE t.description LIKE '%SI%' OR t.description LIKE '%BALANCE%' OR t.description LIKE '%Solde Initial%') as soldes_initiaux,
        COUNT(*) FILTER (WHERE t.description NOT LIKE '%SI%' AND t.description NOT LIKE '%BALANCE%' AND t.description NOT LIKE '%Solde Initial%') as transactions_normales,
        COUNT(*) as total,
        a.balance
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id AND t.is_posted = true
      GROUP BY a.id, a.name, a.balance
      ORDER BY a.id
    `);

    console.log('═'.repeat(80));
    result.rows.forEach(row => {
      const status = parseFloat(row.balance) >= 0 ? '✅' : '❌';
      console.log(`\n${status} ${row.name}:`);
      console.log(`   Soldes initiaux (SI/BALANCE): ${row.soldes_initiaux}`);
      console.log(`   Transactions normales: ${row.transactions_normales}`);
      console.log(`   Total: ${row.total}`);
      console.log(`   Solde: ${parseFloat(row.balance).toLocaleString('fr-FR')} Ar`);
      
      if (parseFloat(row.balance) < 0 && row.soldes_initiaux === '0') {
        console.log(`   🔴 PROBLÈME: Solde négatif car aucun solde initial !`);
      }
    });
    console.log('\n' + '═'.repeat(80));

    // Afficher les transactions "Solde Initial"
    const siResult = await pool.query(`
      SELECT a.name, t.description, t.amount, t.transaction_date
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE (t.description LIKE '%SI%' OR t.description LIKE '%BALANCE%' OR t.description LIKE '%Solde Initial%')
      AND t.is_posted = true
      ORDER BY a.id, t.transaction_date
    `);

    if (siResult.rows.length > 0) {
      console.log('\n💰 SOLDES INITIAUX TROUVÉS:\n');
      siResult.rows.forEach(row => {
        console.log(`   ${row.name}: ${row.description} = ${parseFloat(row.amount).toLocaleString('fr-FR')} Ar (${new Date(row.transaction_date).toLocaleDateString('fr-FR')})`);
      });
    } else {
      console.log('\n❌ AUCUN SOLDE INITIAL TROUVÉ !');
      console.log('   → Les CSV ne contiennent pas les transactions SI/BALANCE');
      console.log('   → Il faut restaurer le backup JSON d\'abord\n');
    }

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeProblem();
