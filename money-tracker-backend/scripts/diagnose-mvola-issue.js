const pool = require('../config/database');

async function diagnoseMVola() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 DIAGNOSTIC APPROFONDI DU COMPTE MVOLA');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Transactions par date
    console.log('📅 TRANSACTIONS PAR DATE:\n');
    const byDate = await pool.query(`
      SELECT 
        transaction_date,
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      WHERE account_id = 2
      GROUP BY transaction_date, type
      ORDER BY transaction_date DESC
    `);
    console.table(byDate.rows);

    // 2. Doublons exacts
    console.log('\n🔍 RECHERCHE DE DOUBLONS EXACTS:\n');
    const duplicates = await pool.query(`
      SELECT 
        transaction_date,
        type,
        amount,
        description,
        category,
        COUNT(*) as occurrences,
        ARRAY_AGG(id ORDER BY id) as ids,
        ARRAY_AGG(created_at ORDER BY id) as dates_creation
      FROM transactions
      WHERE account_id = 2
      GROUP BY transaction_date, type, amount, description, category
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, transaction_date DESC
    `);
    
    if (duplicates.rows.length > 0) {
      console.log(`⚠️  ${duplicates.rows.length} doublons détectés:\n`);
      console.table(duplicates.rows);
    } else {
      console.log('✅ Aucun doublon exact détecté\n');
    }

    // 3. Transactions élevées
    console.log('\n⚠️  TRANSACTIONS ÉLEVÉES (> 500k):\n');
    const highAmount = await pool.query(`
      SELECT id, transaction_date, type, amount, category, description, created_at
      FROM transactions
      WHERE account_id = 2 AND amount > 500000
      ORDER BY amount DESC
    `);
    console.table(highAmount.rows);

    // 4. Distribution par catégorie
    console.log('\n📊 DISTRIBUTION PAR CATÉGORIE:\n');
    const byCategory = await pool.query(`
      SELECT 
        category,
        type,
        COUNT(*) as count,
        SUM(amount) as total,
        ROUND(AVG(amount), 2) as moyenne
      FROM transactions
      WHERE account_id = 2
      GROUP BY category, type
      ORDER BY total DESC
    `);
    console.table(byCategory.rows);

    // 5. Calcul du solde
    console.log('\n💰 CALCUL DU SOLDE:\n');
    const balance = await pool.query(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_revenus,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_depenses,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as solde_calcule,
        (SELECT balance FROM accounts WHERE id = 2) as solde_compte
      FROM transactions
      WHERE account_id = 2
    `);
    
    const calc = balance.rows[0];
    console.log('📈 Revenus totaux:', parseFloat(calc.total_revenus).toLocaleString('fr-FR'), 'Ar');
    console.log('📉 Dépenses totales:', parseFloat(calc.total_depenses).toLocaleString('fr-FR'), 'Ar');
    console.log('💵 Solde calculé:', parseFloat(calc.solde_calcule).toLocaleString('fr-FR'), 'Ar');
    console.log('🏦 Solde en base:', parseFloat(calc.solde_compte).toLocaleString('fr-FR'), 'Ar');
    
    const diff = parseFloat(calc.solde_calcule) - parseFloat(calc.solde_compte);
    if (Math.abs(diff) > 0.01) {
      console.log(`\n⚠️  DIFFÉRENCE: ${diff.toLocaleString('fr-FR')} Ar`);
    } else {
      console.log('\n✅ Soldes cohérents !');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

diagnoseMVola();
