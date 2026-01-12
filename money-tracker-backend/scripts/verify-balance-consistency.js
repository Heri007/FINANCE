// scripts/verify-balance-consistency.js
const pool = require('../config/database');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MGA',
    minimumFractionDigits: 2,
  }).format(amount).replace('MGA', 'Ar');
};

async function verifyBalanceConsistency() {
  const client = await pool.connect();
  
  try {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔍 VÉRIFICATION COMPLÈTE DE LA COHÉRENCE DES SOLDES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ========================================
    // 1. RÉCUPÉRER TOUS LES COMPTES
    // ========================================
    const accountsResult = await client.query(`
      SELECT id, name, type, balance, created_at, updated_at
      FROM accounts
      ORDER BY 
        CASE 
          WHEN name = 'Coffre' THEN 1
          WHEN name = 'Receivables' THEN 2
          ELSE 3
        END,
        id
    `);
    const accounts = accountsResult.rows;

    console.log(`📊 Comptes trouvés: ${accounts.length}\n`);

    // ========================================
    // 2. VÉRIFIER CHAQUE COMPTE
    // ========================================
    const issues = [];
    let totalBalanceStored = 0;
    let totalBalanceCalculated = 0;

    for (const account of accounts) {
      console.log(`\n────────────────────────────────────────────────────────────`);
      console.log(`🏦 ${account.name.toUpperCase()} (ID: ${account.id})`);
      console.log(`   Type: ${account.type}`);
      
      const balanceStored = parseFloat(account.balance || 0);
      totalBalanceStored += balanceStored;

      // ========================================
      // CAS SPÉCIAL : RECEIVABLES
      // ========================================
      if (account.name === 'Receivables') {
        // Calculer le total des receivables ouverts
        const receivablesResult = await client.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM receivables
          WHERE status = 'open'
        `);

        const receivablesTotal = parseFloat(receivablesResult.rows[0].total || 0);
        totalBalanceCalculated += receivablesTotal;

        console.log(`   💰 Solde en base:        ${formatCurrency(balanceStored)}`);
        console.log(`   📊 Receivables ouverts:  ${formatCurrency(receivablesTotal)}`);

        const diff = Math.abs(balanceStored - receivablesTotal);
        if (diff > 0.01) {
          console.log(`   ❌ INCOHÉRENT ! Écart: ${formatCurrency(diff)}`);
          issues.push({
            account: account.name,
            type: 'RECEIVABLES_MISMATCH',
            balanceStored,
            balanceCalculated: receivablesTotal,
            difference: diff
          });
        } else {
          console.log(`   ✅ Cohérent avec receivables`);
          
          // Vérifier l'écart avec transactions (pour info)
          const txResult = await client.query(`
            SELECT 
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as tx_balance
            FROM transactions
            WHERE account_id = $1 AND is_posted = true
          `, [account.id]);
          
          const txBalance = parseFloat(txResult.rows[0].tx_balance || 0);
          const txDiff = Math.abs(receivablesTotal - txBalance);
          
          if (txDiff > 1) {
            console.log(`\n   ℹ️  Info: Écart transactions vs receivables = ${formatCurrency(txDiff)}`);
            console.log(`      (Créances migrées sans transactions correspondantes)`);
          }
        }

        // Lister les receivables avec détails
        const receivablesList = await client.query(`
          SELECT 
            id,
            person,
            amount,
            description,
            status,
            source_account_id,
            account_id,
            created_at
          FROM receivables
          ORDER BY status DESC, created_at DESC
        `);

        if (receivablesList.rows.length > 0) {
          const openCount = receivablesList.rows.filter(r => r.status === 'open').length;
          const closedCount = receivablesList.rows.filter(r => r.status === 'closed').length;
          const openReceivables = receivablesList.rows.filter(r => r.status === 'open');
          const migratedCount = openReceivables.filter(r => !r.source_account_id).length;
          const trackedCount = openReceivables.filter(r => r.source_account_id).length;

          console.log(`\n   📋 Receivables: ${receivablesList.rows.length} total (${openCount} ouverts, ${closedCount} fermés)`);
          console.log(`      • Migrés: ${migratedCount} | Tracés: ${trackedCount}`);
          
          // Afficher les receivables ouverts
          if (openReceivables.length > 0) {
            console.log(`\n   🟢 Receivables OUVERTS:`);
            openReceivables.forEach(r => {
              const sourceAccount = accounts.find(a => a.id === r.source_account_id);
              const sourceLabel = sourceAccount?.name || (r.source_account_id ? `Compte ${r.source_account_id} (invalide)` : 'Migration');
              console.log(`      • ${r.person}: ${formatCurrency(r.amount)}`);
              console.log(`        Source: ${sourceLabel} | ${r.description || 'Sans description'}`);
            });
          }

          // Afficher les 3 derniers receivables fermés
          const closedReceivables = receivablesList.rows.filter(r => r.status === 'closed').slice(0, 3);
          if (closedReceivables.length > 0) {
            console.log(`\n   ⚫ Derniers receivables FERMÉS:`);
            closedReceivables.forEach(r => {
              console.log(`      • ${r.person}: ${formatCurrency(r.amount)} (fermé)`);
            });
          }
          
          // Vérifier l'account_id des receivables
          const wrongAccountId = receivablesList.rows.filter(r => r.account_id !== account.id);
          if (wrongAccountId.length > 0) {
            console.log(`\n   ⚠️  ${wrongAccountId.length} receivable(s) avec account_id incorrect`);
            issues.push({
              type: 'WRONG_RECEIVABLE_ACCOUNT_ID',
              count: wrongAccountId.length,
              details: wrongAccountId.map(r => ({ id: r.id, person: r.person, account_id: r.account_id }))
            });
          }
        } else {
          console.log(`\n   📋 Aucun receivable enregistré`);
        }

        // Vérifier les receivables avec source_account_id invalide
        const invalidSourceResult = await client.query(`
          SELECT r.id, r.person, r.amount, r.source_account_id
          FROM receivables r
          LEFT JOIN accounts a ON r.source_account_id = a.id
          WHERE r.source_account_id IS NOT NULL AND a.id IS NULL
        `);

        if (invalidSourceResult.rows.length > 0) {
          console.log(`\n   ⚠️  ${invalidSourceResult.rows.length} receivable(s) avec compte source invalide`);
          issues.push({
            type: 'INVALID_SOURCE_ACCOUNT',
            count: invalidSourceResult.rows.length,
            details: invalidSourceResult.rows
          });
        }

        continue; // Skip transaction check for Receivables
      }

      // ========================================
      // COMPTES STANDARDS : VÉRIFIER AVEC TRANSACTIONS
      // ========================================
      const transactionsResult = await client.query(`
        SELECT 
          type,
          COALESCE(SUM(amount), 0) as total,
          COUNT(*) as count
        FROM transactions
        WHERE account_id = $1 AND is_posted = true
        GROUP BY type
      `, [account.id]);

      let income = 0;
      let expense = 0;
      let totalTx = 0;

      transactionsResult.rows.forEach(row => {
        totalTx += parseInt(row.count);
        if (row.type === 'income') {
          income = parseFloat(row.total);
        } else if (row.type === 'expense') {
          expense = parseFloat(row.total);
        }
      });

      const balanceCalculated = income - expense;
      totalBalanceCalculated += balanceCalculated;

      console.log(`   💰 Solde en base:        ${formatCurrency(balanceStored)}`);
      console.log(`   📊 Solde recalculé:      ${formatCurrency(balanceCalculated)}`);
      console.log(`      • Revenus:  ${formatCurrency(income)} (${transactionsResult.rows.find(r => r.type === 'income')?.count || 0} tx)`);
      console.log(`      • Dépenses: ${formatCurrency(expense)} (${transactionsResult.rows.find(r => r.type === 'expense')?.count || 0} tx)`);
      console.log(`      • Total tx: ${totalTx}`);

      const diff = Math.abs(balanceStored - balanceCalculated);
      if (diff > 0.01) {
        console.log(`   ❌ INCOHÉRENT ! Écart: ${formatCurrency(diff)}`);
        issues.push({
          account: account.name,
          type: 'TRANSACTION_MISMATCH',
          balanceStored,
          balanceCalculated,
          difference: diff,
          income,
          expense
        });
      } else {
        console.log(`   ✅ Cohérent`);
      }

      // Vérifier les receivables payés vers ce compte
      if (account.name === 'Coffre') {
        const receivablesPaidToThisAccount = await client.query(`
          SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
          FROM receivables
          WHERE status = 'closed'
        `);

        const paidCount = parseInt(receivablesPaidToThisAccount.rows[0].count);
        const paidTotal = parseFloat(receivablesPaidToThisAccount.rows[0].total);

        if (paidCount > 0) {
          console.log(`\n   💸 Receivables payés (historique): ${paidCount} receivables = ${formatCurrency(paidTotal)}`);
        }
      }
    }

       // ========================================
    // 3. VÉRIFICATION GLOBALE
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ GLOBAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`💼 Nombre de comptes:           ${accounts.length}`);
    console.log(`💰 Solde total (base):          ${formatCurrency(totalBalanceStored)}`);
    console.log(`📊 Solde total (recalculé):     ${formatCurrency(totalBalanceCalculated)}`);
    
    const globalDiff = Math.abs(totalBalanceStored - totalBalanceCalculated);
    console.log(`📉 Écart global:                ${formatCurrency(globalDiff)}`);

    if (globalDiff > 0.01) {
      console.log(`\n❌ INCOHÉRENCE GLOBALE DÉTECTÉE !`);
    } else {
      console.log(`\n✅ COHÉRENCE GLOBALE VALIDÉE`);
    }

    // ========================================
    // 4. VÉRIFICATIONS SUPPLÉMENTAIRES
    // ========================================
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('🔎 VÉRIFICATIONS SUPPLÉMENTAIRES');
    console.log('───────────────────────────────────────────────────────────────\n');

    // Transactions orphelines (compte inexistant)
    const orphanResult = await client.query(`
      SELECT t.id, t.description, t.amount, t.account_id
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE a.id IS NULL
      LIMIT 10
    `);

    if (orphanResult.rows.length > 0) {
      console.log(`⚠️  ${orphanResult.rows.length} transaction(s) orpheline(s) détectée(s)`);
      orphanResult.rows.forEach(t => {
        console.log(`   • TX ${t.id}: ${t.description} - ${formatCurrency(t.amount)} (compte ${t.account_id} introuvable)`);
      });
      issues.push({
        type: 'ORPHAN_TRANSACTIONS',
        count: orphanResult.rows.length,
        details: orphanResult.rows
      });
    } else {
      console.log(`✅ Aucune transaction orpheline`);
    }

    // Receivables avec statut invalide
    const invalidStatusResult = await client.query(`
      SELECT id, person, amount, status
      FROM receivables
      WHERE status NOT IN ('open', 'closed')
    `);

    if (invalidStatusResult.rows.length > 0) {
      console.log(`⚠️  ${invalidStatusResult.rows.length} receivable(s) avec statut invalide`);
      invalidStatusResult.rows.forEach(r => {
        console.log(`   • Receivable ${r.id}: ${r.person} - Statut: "${r.status}"`);
      });
      issues.push({
        type: 'INVALID_RECEIVABLE_STATUS',
        count: invalidStatusResult.rows.length
      });
    } else {
      console.log(`✅ Tous les receivables ont un statut valide`);
    }

    // Transactions avec montant négatif (anomalie)
    const negativeAmountResult = await client.query(`
      SELECT id, description, amount, type, account_id
      FROM transactions
      WHERE amount < 0
      LIMIT 10
    `);

    if (negativeAmountResult.rows.length > 0) {
      console.log(`⚠️  ${negativeAmountResult.rows.length} transaction(s) avec montant négatif`);
      negativeAmountResult.rows.forEach(t => {
        console.log(`   • TX ${t.id}: ${t.description} = ${formatCurrency(t.amount)} (${t.type})`);
      });
      issues.push({
        type: 'NEGATIVE_AMOUNTS',
        count: negativeAmountResult.rows.length
      });
    } else {
      console.log(`✅ Aucun montant négatif détecté`);
    }

    // Receivables avec montant négatif ou zéro
    const invalidReceivableAmountResult = await client.query(`
      SELECT id, person, amount, status
      FROM receivables
      WHERE amount <= 0
    `);

    if (invalidReceivableAmountResult.rows.length > 0) {
      console.log(`⚠️  ${invalidReceivableAmountResult.rows.length} receivable(s) avec montant invalide (≤0)`);
      invalidReceivableAmountResult.rows.forEach(r => {
        console.log(`   • Receivable ${r.id}: ${r.person} = ${formatCurrency(r.amount)}`);
      });
      issues.push({
        type: 'INVALID_RECEIVABLE_AMOUNT',
        count: invalidReceivableAmountResult.rows.length
      });
    } else {
      console.log(`✅ Tous les receivables ont un montant valide`);
    }

    // Transactions futures suspectes (> 30 jours dans le futur)
    const futureResult = await client.query(`
      SELECT id, description, amount, transaction_date
      FROM transactions
      WHERE transaction_date > CURRENT_DATE + INTERVAL '30 days'
      LIMIT 5
    `);

    if (futureResult.rows.length > 0) {
      console.log(`⚠️  ${futureResult.rows.length} transaction(s) datée(s) loin dans le futur`);
      futureResult.rows.forEach(t => {
        console.log(`   • TX ${t.id}: ${t.description} le ${t.transaction_date}`);
      });
      issues.push({
        type: 'FUTURE_TRANSACTIONS',
        count: futureResult.rows.length
      });
    } else {
      console.log(`✅ Aucune transaction future suspecte`);
    }

    // Vérifier les transactions non postées (is_posted = false)
    const unpostedResult = await client.query(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE is_posted = false
    `);

    const unpostedCount = parseInt(unpostedResult.rows[0].count);
    const unpostedTotal = parseFloat(unpostedResult.rows[0].total);

    if (unpostedCount > 0) {
      console.log(`⚠️  ${unpostedCount} transaction(s) non postée(s) = ${formatCurrency(unpostedTotal)}`);
      issues.push({
        type: 'UNPOSTED_TRANSACTIONS',
        count: unpostedCount,
        total: unpostedTotal
      });
    } else {
      console.log(`✅ Toutes les transactions sont postées`);
    }

    // ========================================
    // 5. STATISTIQUES RECEIVABLES
    // ========================================
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('📊 STATISTIQUES RECEIVABLES');
    console.log('───────────────────────────────────────────────────────────────\n');

    const receivablesStats = await client.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(AVG(amount), 0) as average,
        COALESCE(MIN(amount), 0) as min_amount,
        COALESCE(MAX(amount), 0) as max_amount
      FROM receivables
      GROUP BY status
      ORDER BY status DESC
    `);

    if (receivablesStats.rows.length > 0) {
      receivablesStats.rows.forEach(stat => {
        const statusIcon = stat.status === 'open' ? '🟢' : '⚫';
        console.log(`${statusIcon} ${stat.status.toUpperCase()}: ${stat.count} receivables`);
        console.log(`   Total:   ${formatCurrency(stat.total)}`);
        console.log(`   Moyenne: ${formatCurrency(stat.average)}`);
        console.log(`   Min:     ${formatCurrency(stat.min_amount)}`);
        console.log(`   Max:     ${formatCurrency(stat.max_amount)}`);
        console.log('');
      });
    } else {
      console.log('Aucun receivable dans la base de données\n');
    }

    // ========================================
    // 6. RAPPORT FINAL
    // ========================================
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 RAPPORT FINAL');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (issues.length === 0) {
      console.log('✅ ✅ ✅ TOUS LES CONTRÔLES SONT PASSÉS ! ✅ ✅ ✅');
      console.log('Votre application est cohérente au niveau comptable.\n');
    } else {
      console.log(`❌ ${issues.length} problème(s) détecté(s) :\n`);
      
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type}`);
        if (issue.account) {
          console.log(`   Compte: ${issue.account}`);
          console.log(`   Solde base: ${formatCurrency(issue.balanceStored)}`);
          console.log(`   Solde calculé: ${formatCurrency(issue.balanceCalculated)}`);
          console.log(`   Écart: ${formatCurrency(issue.difference)}`);
        } else if (issue.count) {
          console.log(`   Nombre d'éléments affectés: ${issue.count}`);
          if (issue.total !== undefined) {
            console.log(`   Montant total: ${formatCurrency(issue.total)}`);
          }
        }
        console.log('');
      });

      console.log('💡 ACTIONS RECOMMANDÉES:');
      console.log('   1. Lance le recalcul des soldes: POST /api/accounts/recalculate-all');
      console.log('   2. Vérifie les transactions en double');
      console.log('   3. Corrige les données orphelines');
      console.log('   4. Vérifie les receivables avec source_account_id invalide\n');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Erreur lors de la vérification:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécution
verifyBalanceConsistency()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
