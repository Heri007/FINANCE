// FICHIER: migrate-avoir-transactions.js
const pool = require('../config/database');

async function migrateAvoirTransactions() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Trouver l'ID du compte "Avoir"
    const avoirResult = await client.query(
      `SELECT id FROM accounts WHERE LOWER(name) = 'avoir' LIMIT 1`
    );

    if (avoirResult.rows.length === 0) {
      console.log('❌ Compte "Avoir" introuvable');
      return;
    }

    const avoirAccountId = avoirResult.rows[0].id;
    console.log(`✅ Compte Avoir trouvé: ID ${avoirAccountId}`);

    // 2. Trouver le compte cible (par exemple "Coffre")
    const targetResult = await client.query(
      `SELECT id FROM accounts WHERE LOWER(name) = 'coffre' LIMIT 1`
    );

    if (targetResult.rows.length === 0) {
      console.log('❌ Compte cible (Coffre) introuvable');
      await client.query('ROLLBACK');
      return;
    }

    const targetAccountId = targetResult.rows[0].id;
    console.log(`✅ Compte cible trouvé: ID ${targetAccountId}`);

    // 3. Récupérer toutes les transactions du compte Avoir
    const transactionsResult = await client.query(
      `SELECT id, amount, type, description, transaction_date 
       FROM transactions 
       WHERE account_id = $1`,
      [avoirAccountId]
    );

    console.log(`\n📊 ${transactionsResult.rows.length} transactions trouvées dans Avoir`);

    if (transactionsResult.rows.length === 0) {
      console.log('✅ Aucune transaction à migrer');
      await client.query('COMMIT');
      return;
    }

    // 4. Afficher un résumé
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactionsResult.rows.forEach(t => {
      if (t.type === 'income') {
        totalIncome += parseFloat(t.amount);
      } else {
        totalExpense += parseFloat(t.amount);
      }
    });

    console.log(`\n💰 RÉSUMÉ DES TRANSACTIONS À MIGRER:`);
    console.log(`   Revenus:  ${totalIncome.toLocaleString('fr-FR')} Ar`);
    console.log(`   Dépenses: ${totalExpense.toLocaleString('fr-FR')} Ar`);
    console.log(`   Net:      ${(totalIncome - totalExpense).toLocaleString('fr-FR')} Ar`);

    // 5. Demander confirmation (commenté pour exécution automatique)
    // const readline = require('readline').createInterface({
    //   input: process.stdin,
    //   output: process.stdout
    // });
    
    // const answer = await new Promise(resolve => {
    //   readline.question('\n⚠️ Confirmer la migration vers Coffre ? (oui/non): ', resolve);
    // });
    // readline.close();

    // if (answer.toLowerCase() !== 'oui') {
    //   console.log('❌ Migration annulée');
    //   await client.query('ROLLBACK');
    //   return;
    // }

    // 6. Mettre à jour toutes les transactions
    const updateResult = await client.query(
      `UPDATE transactions 
       SET account_id = $1 
       WHERE account_id = $2`,
      [targetAccountId, avoirAccountId]
    );

    console.log(`\n✅ ${updateResult.rowCount} transactions migrées vers Coffre`);

    // 7. Recalculer le solde du compte Coffre
    const coffreBalanceResult = await client.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM transactions 
       WHERE account_id = $1`,
      [targetAccountId]
    );

    const newBalance = 
      parseFloat(coffreBalanceResult.rows[0].total_income) - 
      parseFloat(coffreBalanceResult.rows[0].total_expense);

    await client.query(
      `UPDATE accounts SET balance = $1 WHERE id = $2`,
      [newBalance, targetAccountId]
    );

    console.log(`\n💰 Nouveau solde Coffre: ${newBalance.toLocaleString('fr-FR')} Ar`);

    // 8. Mettre le solde du compte Avoir à 0
    await client.query(
      `UPDATE accounts SET balance = 0 WHERE id = $1`,
      [avoirAccountId]
    );

    console.log(`✅ Solde du compte Avoir réinitialisé à 0`);

    await client.query('COMMIT');
    console.log(`\n🎉 MIGRATION TERMINÉE AVEC SUCCÈS !`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécution
migrateAvoirTransactions()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
