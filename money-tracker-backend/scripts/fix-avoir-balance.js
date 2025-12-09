// scripts/fix-avoir-balance.js
const pool = require('../config/database');
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' Ar';
};

async function fixAvoirBalance() {
  const client = await pool.connect();
  
  try {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔧 CORRECTION DU SOLDE AVOIR');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await client.query('BEGIN');

    // 1. Vérifier l'état actuel
    const currentResult = await client.query(`
      SELECT id, name, balance
      FROM accounts
      WHERE name = 'Avoir'
    `);

    if (currentResult.rows.length === 0) {
      console.log('❌ Compte Avoir introuvable !');
      await client.query('ROLLBACK');
      return;
    }

    const avoir = currentResult.rows[0];
    const oldBalance = parseFloat(avoir.balance);

    console.log('📊 ÉTAT ACTUEL:');
    console.log(`   Solde en base: ${formatCurrency(oldBalance)}`);

    // 2. Calculer le solde réel depuis les receivables
    const receivablesResult = await client.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM receivables
      WHERE account_id = $1 AND status = 'open'
    `, [avoir.id]);

    const correctBalance = parseFloat(receivablesResult.rows[0].total);
    const diff = oldBalance - correctBalance;

    console.log(`   Receivables ouverts: ${formatCurrency(correctBalance)}`);
    console.log(`   Écart détecté: ${formatCurrency(diff)}\n`);

    if (Math.abs(diff) < 0.01) {
      console.log('✅ Le compte Avoir est déjà cohérent, aucune correction nécessaire.\n');
      await client.query('ROLLBACK');
      return;
    }

    // 3. Demander confirmation
    console.log('🔧 CORRECTION PROPOSÉE:');
    console.log(`   ${formatCurrency(oldBalance)} → ${formatCurrency(correctBalance)}\n`);

    // 4. Appliquer la correction
    const updateResult = await client.query(`
      UPDATE accounts
      SET balance = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, balance
    `, [correctBalance, avoir.id]);

    const updated = updateResult.rows[0];

    console.log('✅ CORRECTION APPLIQUÉE:');
    console.log(`   Nouveau solde: ${formatCurrency(updated.balance)}`);
    console.log(`   Mise à jour: ${new Date().toLocaleString('fr-FR')}\n`);

    // 5. Vérifier la cohérence globale après correction
    const allAccountsResult = await client.query(`
      SELECT id, name, balance
      FROM accounts
      ORDER BY name
    `);

    let totalBalanceDB = 0;
    console.log('📊 SOLDES APRÈS CORRECTION:\n');
    allAccountsResult.rows.forEach(acc => {
      const bal = parseFloat(acc.balance);
      totalBalanceDB += bal;
      const icon = acc.name === 'Avoir' ? '✅' : '   ';
      console.log(`${icon} ${acc.name.padEnd(20)} ${formatCurrency(bal)}`);
    });

    console.log(`\n💰 Solde total: ${formatCurrency(totalBalanceDB)}`);

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ CORRECTION TERMINÉE AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('💡 PROCHAINES ÉTAPES:');
    console.log('   1. Relance le script de vérification: node scripts/verify-balance-consistency.js');
    console.log('   2. Rafraîchis ton frontend pour voir le nouveau solde');
    console.log('   3. Vérifie que le Solde Total a bien diminué de 31M Ar\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erreur lors de la correction:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécution
fixAvoirBalance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
