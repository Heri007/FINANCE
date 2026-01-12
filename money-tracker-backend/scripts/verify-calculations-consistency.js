const pool = require('../config/database');

async function verifyCalculations() {
  const client = await pool.connect();
  
  try {
    console.log('\n' + '═'.repeat(80));
    console.log('🔍 VÉRIFICATION DE COHÉRENCE : BACKEND vs FRONTEND');
    console.log('═'.repeat(80) + '\n');

    // ============================================================
    // 1. SOLDES DES COMPTES (Source de vérité : table accounts)
    // ============================================================
    
    console.log('📊 1. SOLDES DES COMPTES\n');
    
    const accountsResult = await client.query(`
      SELECT 
        id,
        name,
        balance,
        type
      FROM accounts
      ORDER BY id
    `);
    
    const accountsMap = {};
    let totalBalanceDB = 0;
    
    console.log('┌─────┬──────────────────────────┬──────────────────┬───────────────┐');
    console.log('│ ID  │ Compte                   │ Solde (DB)       │ Type          │');
    console.log('├─────┼──────────────────────────┼──────────────────┼───────────────┤');
    
    accountsResult.rows.forEach(acc => {
      const balance = parseFloat(acc.balance);
      accountsMap[acc.id] = {
        name: acc.name,
        balanceDB: balance,
        type: acc.type
      };
      totalBalanceDB += balance;
      
      console.log(
        `│ ${String(acc.id).padEnd(3)} │ ${acc.name.padEnd(24)} │ ${balance.toLocaleString('fr-FR').padStart(16)} │ ${acc.type.padEnd(13)} │`
      );
    });
    
    console.log('└─────┴──────────────────────────┴──────────────────┴───────────────┘');
    console.log(`\n💰 TOTAL SOLDES (DB): ${totalBalanceDB.toLocaleString('fr-FR')} Ar\n`);

    // ============================================================
    // 2. CALCUL DEPUIS LES TRANSACTIONS (Backend)
    // ============================================================
    
    console.log('📊 2. CALCUL DEPUIS LES TRANSACTIONS (Backend)\n');
    
    const transactionsByAccount = await client.query(`
      SELECT 
        account_id,
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      GROUP BY account_id, type
      ORDER BY account_id, type
    `);
    
    // Calculer le solde de chaque compte depuis les transactions
    const accountBalancesFromTrx = {};
    
    transactionsByAccount.rows.forEach(row => {
      if (!accountBalancesFromTrx[row.account_id]) {
        accountBalancesFromTrx[row.account_id] = 0;
      }
      
      const amount = parseFloat(row.total);
      if (row.type === 'income') {
        accountBalancesFromTrx[row.account_id] += amount;
      } else {
        accountBalancesFromTrx[row.account_id] -= amount;
      }
    });
    
    console.log('┌─────┬──────────────────────────┬──────────────────┬──────────────────┬──────────────────┐');
    console.log('│ ID  │ Compte                   │ Solde (DB)       │ Solde (Calc)     │ Différence       │');
    console.log('├─────┼──────────────────────────┼──────────────────┼──────────────────┼──────────────────┤');
    
    let hasDifference = false;
    let totalCalculatedBalance = 0;
    
    Object.keys(accountsMap).forEach(accId => {
      const acc = accountsMap[accId];
      const calculatedBalance = accountBalancesFromTrx[accId] || 0;
      const difference = acc.balanceDB - calculatedBalance;
      
      totalCalculatedBalance += calculatedBalance;
      
      if (Math.abs(difference) > 0.01) {
        hasDifference = true;
      }
      
      const diffSymbol = Math.abs(difference) > 0.01 ? '⚠️ ' : '✅';
      
      console.log(
        `│ ${String(accId).padEnd(3)} │ ${acc.name.padEnd(24)} │ ${acc.balanceDB.toLocaleString('fr-FR').padStart(16)} │ ${calculatedBalance.toLocaleString('fr-FR').padStart(16)} │ ${diffSymbol} ${difference.toLocaleString('fr-FR').padStart(13)} │`
      );
    });
    
    console.log('└─────┴──────────────────────────┴──────────────────┴──────────────────┴──────────────────┘');
    console.log(`\n💰 TOTAL CALCULÉ: ${totalCalculatedBalance.toLocaleString('fr-FR')} Ar`);
    console.log(`💰 DIFFÉRENCE GLOBALE: ${(totalBalanceDB - totalCalculatedBalance).toLocaleString('fr-FR')} Ar\n`);
    
    if (hasDifference) {
      console.log('⚠️  INCOHÉRENCES DÉTECTÉES ! Certains comptes ont des différences.\n');
    } else {
      console.log('✅ COHÉRENCE PARFAITE ! Tous les soldes correspondent aux transactions.\n');
    }

    // ============================================================
    // 3. CALCUL GLOBAL DES REVENUS/DÉPENSES
    // ============================================================
    
    console.log('📊 3. REVENUS ET DÉPENSES GLOBALES\n');
    
    const globalStats = await client.query(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      GROUP BY type
    `);
    
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    
    globalStats.rows.forEach(row => {
      const total = parseFloat(row.total);
      const count = parseInt(row.count);
      
      if (row.type === 'income') {
        totalIncome = total;
        incomeCount = count;
      } else {
        totalExpense = total;
        expenseCount = count;
      }
    });
    
    const netBalance = totalIncome - totalExpense;
    
    console.log('┌──────────────┬──────────────┬──────────────────┬──────────────────┐');
    console.log('│ Type         │ Nb Trans.    │ Total            │ Moyenne          │');
    console.log('├──────────────┼──────────────┼──────────────────┼──────────────────┤');
    console.log(`│ Revenus      │ ${String(incomeCount).padStart(12)} │ ${totalIncome.toLocaleString('fr-FR').padStart(16)} │ ${(totalIncome / incomeCount).toLocaleString('fr-FR').padStart(16)} │`);
    console.log(`│ Dépenses     │ ${String(expenseCount).padStart(12)} │ ${totalExpense.toLocaleString('fr-FR').padStart(16)} │ ${(totalExpense / expenseCount).toLocaleString('fr-FR').padStart(16)} │`);
    console.log('├──────────────┼──────────────┼──────────────────┼──────────────────┤');
    console.log(`│ NET          │ ${String(incomeCount + expenseCount).padStart(12)} │ ${netBalance.toLocaleString('fr-FR').padStart(16)} │                  │`);
    console.log('└──────────────┴──────────────┴──────────────────┴──────────────────┘\n');

    // ============================================================
    // 4. DÉTECTION DE DOUBLONS (Logique FinanceContext)
    // ============================================================
    
    console.log('📊 4. DÉTECTION DE DOUBLONS (Logique Frontend)\n');
    
    const allTransactions = await client.query(`
      SELECT 
        id,
        account_id,
        transaction_date,
        amount,
        type,
        description
      FROM transactions
      ORDER BY transaction_date DESC, id DESC
    `);
    
    // Appliquer le filtre de doublons du FinanceContext
    const seen = new Set();
    const unique = [];
    const duplicates = [];
    
    allTransactions.rows.forEach(t => {
      const date = (t.transaction_date || '').toISOString().split('T')[0];
      const sig = `${t.account_id}|${date}|${t.amount}|${t.type}`;
      
      if (!seen.has(sig)) {
        seen.add(sig);
        unique.push(t);
      } else {
        duplicates.push({
          id: t.id,
          signature: sig,
          date,
          amount: t.amount,
          description: t.description
        });
      }
    });
    
    console.log(`📊 Total transactions en base: ${allTransactions.rows.length}`);
    console.log(`✅ Transactions uniques (filtre frontend): ${unique.length}`);
    console.log(`⚠️  Doublons potentiels détectés: ${duplicates.length}\n`);
    
    if (duplicates.length > 0) {
      console.log('🔍 DOUBLONS DÉTECTÉS:\n');
      console.log('┌──────┬──────────────┬──────────────────┬─────────────────────────────────────┐');
      console.log('│ ID   │ Date         │ Montant          │ Description                         │');
      console.log('├──────┼──────────────┼──────────────────┼─────────────────────────────────────┤');
      
      duplicates.slice(0, 10).forEach(d => {
        console.log(
          `│ ${String(d.id).padEnd(4)} │ ${d.date.padEnd(12)} │ ${d.amount.toLocaleString('fr-FR').padStart(16)} │ ${(d.description || '').substring(0, 35).padEnd(35)} │`
        );
      });
      
      console.log('└──────┴──────────────┴──────────────────┴─────────────────────────────────────┘');
      
      if (duplicates.length > 10) {
        console.log(`\n... et ${duplicates.length - 10} autres doublons\n`);
      }
    }

    // ============================================================
    // 5. CALCUL AVEC FILTRE DE DOUBLONS (Simulation Frontend)
    // ============================================================
    
    console.log('\n📊 5. RECALCUL AVEC FILTRE DE DOUBLONS (Simulation FinanceContext)\n');
    
    let incomeUnique = 0;
    let expenseUnique = 0;
    
    unique.forEach(t => {
      const amount = parseFloat(t.amount);
      if (t.type === 'income') {
        incomeUnique += amount;
      } else {
        expenseUnique += amount;
      }
    });
    
    const netBalanceUnique = incomeUnique - expenseUnique;
    const differenceDuplicates = netBalance - netBalanceUnique;
    
    console.log('┌──────────────────────────┬──────────────────┬──────────────────┬──────────────────┐');
    console.log('│                          │ Avec doublons    │ Sans doublons    │ Différence       │');
    console.log('├──────────────────────────┼──────────────────┼──────────────────┼──────────────────┤');
    console.log(`│ Revenus                  │ ${totalIncome.toLocaleString('fr-FR').padStart(16)} │ ${incomeUnique.toLocaleString('fr-FR').padStart(16)} │ ${(totalIncome - incomeUnique).toLocaleString('fr-FR').padStart(16)} │`);
    console.log(`│ Dépenses                 │ ${totalExpense.toLocaleString('fr-FR').padStart(16)} │ ${expenseUnique.toLocaleString('fr-FR').padStart(16)} │ ${(totalExpense - expenseUnique).toLocaleString('fr-FR').padStart(16)} │`);
    console.log(`│ NET                      │ ${netBalance.toLocaleString('fr-FR').padStart(16)} │ ${netBalanceUnique.toLocaleString('fr-FR').padStart(16)} │ ${differenceDuplicates.toLocaleString('fr-FR').padStart(16)} │`);
    console.log('└──────────────────────────┴──────────────────┴──────────────────┴──────────────────┘\n');

    // ============================================================
    // 6. RÉSUMÉ FINAL
    // ============================================================
    
    console.log('═'.repeat(80));
    console.log('📋 RÉSUMÉ FINAL\n');
    
    const issues = [];
    
    if (hasDifference) {
      issues.push('⚠️  Incohérence entre soldes comptes et transactions');
    }
    
    if (duplicates.length > 0) {
      issues.push(`⚠️  ${duplicates.length} doublons détectés (filtre frontend masque)`);
    }
    
    if (Math.abs(differenceDuplicates) > 0.01) {
      issues.push(`⚠️  Différence de ${differenceDuplicates.toLocaleString('fr-FR')} Ar due aux doublons`);
    }
    
    if (Math.abs(totalBalanceDB - netBalance) > 0.01) {
      issues.push(`⚠️  Total soldes (${totalBalanceDB.toLocaleString('fr-FR')} Ar) ≠ Net transactions (${netBalance.toLocaleString('fr-FR')} Ar)`);
    }
    
    if (issues.length === 0) {
      console.log('✅ TOUT EST COHÉRENT !\n');
      console.log('   • Soldes comptes = Somme des transactions');
      console.log('   • Aucun doublon détecté');
      console.log('   • Frontend et Backend alignés');
    } else {
      console.log('⚠️  PROBLÈMES DÉTECTÉS:\n');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('\n' + '═'.repeat(80) + '\n');
    
 } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyCalculations();
