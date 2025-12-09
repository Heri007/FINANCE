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
      ORDER BY id
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

      // Cas spécial : AVOIR (receivables)
      if (account.name === 'Avoir') {
        const receivablesResult = await client.query(`
          SELECT COALESCE(SUM(amount), 0) as total
          FROM receivables
          WHERE account_id = $1 AND status != 'closed'
        `, [account.id]);

        const receivablesTotal = parseFloat(receivablesResult.rows[0].total || 0);
        totalBalanceCalculated += receivablesTotal;

        console.log(`   💰 Solde en base:        ${formatCurrency(balanceStored)}`);
        console.log(`   📊 Receivables ouverts:  ${formatCurrency(receivablesTotal)}`);

        const diff = Math.abs(balanceStored - receivablesTotal);
        if (diff > 0.01) {
          console.log(`   ❌ INCOHÉRENT ! Écart: ${formatCurrency(diff)}`);
          issues.push({
            account: account.name,
            type: 'AVOIR_RECEIVABLES',
            balanceStored,
            balanceCalculated: receivablesTotal,
            difference: diff
          });
        } else {
          console.log(`   ✅ Cohérent avec receivables`);
        }

        // Lister les receivables
        const receivablesList = await client.query(`
          SELECT person, amount, description, status, created_at
          FROM receivables
          WHERE account_id = $1
          ORDER BY created_at DESC
        `, [account.id]);

        if (receivablesList.rows.length > 0) {
          console.log(`\n   📋 Receivables détaillés:`);
          receivablesList.rows.forEach(r => {
            const statusIcon = r.status === 'open' ? '🟢' : '⚫';
            console.log(`      ${statusIcon} ${r.person}: ${formatCurrency(r.amount)} (${r.status})`);
          });
        }

        continue; // Skip transaction check for AVOIR
      }

      // Comptes standards : vérifier avec transactions
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

      // Vérifier les transactions en double (même signature)
      const duplicatesResult = await client.query(`
        SELECT 
          account_id,
          type,
          amount,
          description,
          transaction_date,
          COUNT(*) as duplicate_count
        FROM transactions
        WHERE account_id = $1 AND is_posted = true
        GROUP BY account_id, type, amount, description, transaction_date
        HAVING COUNT(*) > 1
      `, [account.id]);

      if (duplicatesResult.rows.length > 0) {
        console.log(`   ⚠️  ${duplicatesResult.rows.length} groupe(s) de doublons potentiels détectés`);
        duplicatesResult.rows.slice(0, 3).forEach(dup => {
          console.log(`      • ${dup.description}: ${formatCurrency(dup.amount)} (${dup.duplicate_count}x)`);
        });
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
      LIMIT 5
    `);

    if (orphanResult.rows.length > 0) {
      console.log(`⚠️  ${orphanResult.rows.length} transaction(s) orpheline(s) détectée(s)`);
      orphanResult.rows.forEach(t => {
        console.log(`   • TX ${t.id}: ${t.description} (compte ${t.account_id} introuvable)`);
      });
      issues.push({
        type: 'ORPHAN_TRANSACTIONS',
        count: orphanResult.rows.length
      });
    } else {
      console.log(`✅ Aucune transaction orpheline`);
    }

    // Receivables orphelins (compte inexistant)
    const orphanReceivablesResult = await client.query(`
      SELECT r.id, r.person, r.amount, r.account_id
      FROM receivables r
      LEFT JOIN accounts a ON r.account_id = a.id
      WHERE a.id IS NULL
      LIMIT 5
    `);

    if (orphanReceivablesResult.rows.length > 0) {
      console.log(`⚠️  ${orphanReceivablesResult.rows.length} receivable(s) orphelin(s) détecté(s)`);
      orphanReceivablesResult.rows.forEach(r => {
        console.log(`   • Receivable ${r.id}: ${r.person} (compte ${r.account_id} introuvable)`);
      });
      issues.push({
        type: 'ORPHAN_RECEIVABLES',
        count: orphanReceivablesResult.rows.length
      });
    } else {
      console.log(`✅ Aucun receivable orphelin`);
    }

    // Transactions avec montant négatif (anomalie)
    const negativeAmountResult = await client.query(`
      SELECT id, description, amount, type, account_id
      FROM transactions
      WHERE amount < 0
      LIMIT 5
    `);

    if (negativeAmountResult.rows.length > 0) {
      console.log(`⚠️  ${negativeAmountResult.rows.length} transaction(s) avec montant négatif`);
      negativeAmountResult.rows.forEach(t => {
        console.log(`   • TX ${t.id}: ${t.description} = ${t.amount} Ar (${t.type})`);
      });
      issues.push({
        type: 'NEGATIVE_AMOUNTS',
        count: negativeAmountResult.rows.length
      });
    } else {
      console.log(`✅ Aucun montant négatif détecté`);
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
    } else {
      console.log(`✅ Aucune transaction future suspecte`);
    }

    // ========================================
    // 5. RAPPORT FINAL
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
        }
        console.log('');
      });

      console.log('💡 ACTIONS RECOMMANDÉES:');
      console.log('   1. Lance le recalcul des soldes: POST /api/accounts/recalculate-all');
      console.log('   2. Vérifie les transactions en double');
      console.log('   3. Corrige les données orphelines\n');
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
