// scripts/show-accounts-details.js
const pool = require('../config/database');

async function showAccountsDetails() {
  console.log('\n' + '═'.repeat(100));
  console.log('💰 DÉTAILS COMPLETS DES COMPTES');
  console.log('═'.repeat(100));

  try {
    // ✅ ÉTAPE 1: Récupérer tous les comptes
    const accountsResult = await pool.query(`
      SELECT 
        id, 
        name, 
        balance, 
        type,
        created_at,
        updated_at
      FROM accounts 
      ORDER BY id ASC
    `);

    if (accountsResult.rows.length === 0) {
      console.log('\n⚠️ Aucun compte trouvé dans la base de données\n');
      return;
    }

    console.log(`\n📊 Total: ${accountsResult.rows.length} compte(s)\n`);

    // ✅ ÉTAPE 2: Pour chaque compte, afficher les détails
    for (const account of accountsResult.rows) {
      console.log('─'.repeat(100));
      console.log(`\n🏦 ${account.name.toUpperCase()} (ID: ${account.id})`);
      console.log(`   Type: ${account.type}`);
      console.log(`   Créé le: ${new Date(account.created_at).toLocaleString('fr-FR')}`);
      console.log(`   Mis à jour: ${new Date(account.updated_at).toLocaleString('fr-FR')}`);
      
      // Solde actuel
      const currentBalance = parseFloat(account.balance);
      const balanceColor = currentBalance >= 0 ? '✅' : '❌';
      console.log(`\n   💰 Solde actuel: ${balanceColor} ${currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ar`);

      // ✅ ÉTAPE 3: Récupérer les statistiques des transactions
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_transactions,
          COUNT(CASE WHEN is_planned = true AND is_posted = false THEN 1 END) as planned_transactions,
          COUNT(CASE WHEN type = 'income' AND is_posted = true THEN 1 END) as income_count,
          COUNT(CASE WHEN type = 'expense' AND is_posted = true THEN 1 END) as expense_count,
          COALESCE(SUM(CASE WHEN type = 'income' AND is_posted = true THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' AND is_posted = true THEN amount ELSE 0 END), 0) as total_expense,
          MIN(transaction_date) as first_transaction,
          MAX(transaction_date) as last_transaction
        FROM transactions
        WHERE account_id = $1
      `, [account.id]);

      const stats = statsResult.rows[0];
      
      console.log('\n   📊 STATISTIQUES:');
      console.log(`      Total transactions: ${stats.total_transactions}`);
      console.log(`      ✅ Postées: ${stats.posted_transactions}`);
      console.log(`      ⏳ Planifiées: ${stats.planned_transactions}`);
      
      if (stats.total_transactions > 0) {
        console.log(`\n      💵 Revenus: ${stats.income_count} transactions → ${parseFloat(stats.total_income).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
        console.log(`      💸 Dépenses: ${stats.expense_count} transactions → ${parseFloat(stats.total_expense).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
        
        const netAmount = parseFloat(stats.total_income) - parseFloat(stats.total_expense);
        const netSign = netAmount >= 0 ? '+' : '';
        console.log(`      📈 Net: ${netSign}${netAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
        
        // Période
        if (stats.first_transaction && stats.last_transaction) {
          const firstDate = new Date(stats.first_transaction).toLocaleDateString('fr-FR');
          const lastDate = new Date(stats.last_transaction).toLocaleDateString('fr-FR');
          console.log(`\n      📅 Période: ${firstDate} → ${lastDate}`);
        }
      }

      // ✅ ÉTAPE 4: Recalculer le solde pour vérification
      const recalcResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as calculated_balance
        FROM transactions
        WHERE account_id = $1 AND is_posted = true
      `, [account.id]);

      const calculatedBalance = parseFloat(recalcResult.rows[0].calculated_balance);
      const difference = currentBalance - calculatedBalance;

      console.log('\n   🔍 VÉRIFICATION:');
      console.log(`      Solde en base: ${currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      console.log(`      Solde recalculé: ${calculatedBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      
      if (Math.abs(difference) < 0.01) {
        console.log(`      ✅ Cohérent (écart: ${difference.toFixed(2)} Ar)`);
      } else {
        console.log(`      ❌ INCOHÉRENT ! Écart: ${difference.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
      }

      // ✅ ÉTAPE 5: Afficher les 5 dernières transactions
      const recentTransactions = await pool.query(`
        SELECT 
          id,
          type,
          amount,
          category,
          description,
          transaction_date,
          is_posted,
          is_planned,
          created_at
        FROM transactions
        WHERE account_id = $1
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT 5
      `, [account.id]);

      if (recentTransactions.rows.length > 0) {
        console.log('\n   📝 DERNIÈRES TRANSACTIONS:');
        recentTransactions.rows.forEach((trx, index) => {
          const date = new Date(trx.transaction_date).toLocaleDateString('fr-FR');
          const sign = trx.type === 'income' ? '+' : '-';
          const status = trx.is_posted ? '✅' : (trx.is_planned ? '⏳' : '❓');
          const amount = parseFloat(trx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
          
          console.log(`\n      ${index + 1}. ${status} ${date} - ${trx.category}`);
          console.log(`         ${sign}${amount} Ar`);
          console.log(`         ${trx.description.substring(0, 60)}${trx.description.length > 60 ? '...' : ''}`);
        });
      }

      console.log('\n');
    }

    // ✅ ÉTAPE 6: Résumé global
    console.log('═'.repeat(100));
    console.log('📊 RÉSUMÉ GLOBAL');
    console.log('═'.repeat(100));

    const globalStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT account_id) as total_accounts,
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_transactions,
        COALESCE(SUM(CASE WHEN type = 'income' AND is_posted = true THEN amount ELSE 0 END), 0) as global_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND is_posted = true THEN amount ELSE 0 END), 0) as global_expense
      FROM transactions
    `);

    const global = globalStats.rows[0];
    const totalBalance = accountsResult.rows.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
    const netGlobal = parseFloat(global.global_income) - parseFloat(global.global_expense);

    console.log(`\n💼 Comptes actifs: ${accountsResult.rows.length}`);
    console.log(`📊 Total transactions: ${global.total_transactions} (${global.posted_transactions} postées)`);
    console.log(`💰 Solde total: ${totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
    console.log(`\n💵 Revenus totaux: ${parseFloat(global.global_income).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
    console.log(`💸 Dépenses totales: ${parseFloat(global.global_expense).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
    console.log(`📈 Net global: ${netGlobal >= 0 ? '+' : ''}${netGlobal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);

    // Vérifier la cohérence globale
    const diff = totalBalance - netGlobal;
    console.log(`\n🔍 Cohérence: ${Math.abs(diff) < 0.01 ? '✅' : '❌'} (écart: ${diff.toFixed(2)} Ar)`);

    console.log('\n' + '═'.repeat(100) + '\n');

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Exécuter le script
showAccountsDetails();
