// scripts/verify-coffre-integrity.js
const pool = require('../config/database');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' Ar';
};

async function verifyCoffreIntegrity() {
  const client = await pool.connect();
  
  try {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔐 AUDIT COMPLET DU COMPTE COFFRE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // ========================================
    // 1. INFORMATIONS DE BASE DU COFFRE
    // ========================================
    const coffreResult = await client.query(`
      SELECT id, name, type, balance, created_at, updated_at
      FROM accounts
      WHERE name = 'Coffre'
    `);

    if (coffreResult.rows.length === 0) {
      console.log('❌ Compte Coffre introuvable !');
      return;
    }

    const coffre = coffreResult.rows[0];
    const coffreId = coffre.id;
    const balanceStored = parseFloat(coffre.balance);

    console.log('📊 INFORMATIONS GÉNÉRALES');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`ID:              ${coffreId}`);
    console.log(`Type:            ${coffre.type}`);
    console.log(`Créé le:         ${new Date(coffre.created_at).toLocaleString('fr-FR')}`);
    console.log(`Dernière MAJ:    ${new Date(coffre.updated_at).toLocaleString('fr-FR')}`);
    console.log(`💰 Solde en base: ${formatCurrency(balanceStored)}`);

    // ========================================
    // 2. ANALYSE DES TRANSACTIONS COFFRE
    // ========================================
    console.log('\n\n📋 ANALYSE DES TRANSACTIONS COFFRE');
    console.log('─────────────────────────────────────────────────────────────');

    const txResult = await client.query(`
      SELECT 
        type,
        category,
        COUNT(*) as count,
        SUM(amount) as total,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        MIN(transaction_date) as first_date,
        MAX(transaction_date) as last_date
      FROM transactions
      WHERE account_id = $1 AND is_posted = true
      GROUP BY type, category
      ORDER BY type DESC, total DESC
    `, [coffreId]);

    let totalIncome = 0;
    let totalExpense = 0;
    let txCount = 0;

    console.log('\n🔹 PAR CATÉGORIE:\n');
    txResult.rows.forEach(row => {
      const icon = row.type === 'income' ? '💰' : '💸';
      console.log(`${icon} ${row.category} (${row.type})`);
      console.log(`   • Nombre:    ${row.count} transaction(s)`);
      console.log(`   • Total:     ${formatCurrency(row.total)}`);
      console.log(`   • Min:       ${formatCurrency(row.min_amount)}`);
      console.log(`   • Max:       ${formatCurrency(row.max_amount)}`);
      console.log(`   • Période:   ${new Date(row.first_date).toLocaleDateString('fr-FR')} → ${new Date(row.last_date).toLocaleDateString('fr-FR')}`);
      console.log('');

      txCount += parseInt(row.count);
      if (row.type === 'income') totalIncome += parseFloat(row.total);
      else totalExpense += parseFloat(row.total);
    });

    const balanceCalculated = totalIncome - totalExpense;
    const diff = Math.abs(balanceStored - balanceCalculated);

    console.log('─────────────────────────────────────────────────────────────');
    console.log(`📊 Nombre total de transactions: ${txCount}`);
    console.log(`💵 Total revenus:  ${formatCurrency(totalIncome)}`);
    console.log(`💸 Total dépenses: ${formatCurrency(totalExpense)}`);
    console.log(`📈 Net calculé:    ${formatCurrency(balanceCalculated)}`);
    console.log(`💰 Solde en base:  ${formatCurrency(balanceStored)}`);
    
    if (diff > 0.01) {
      console.log(`❌ ÉCART DÉTECTÉ:  ${formatCurrency(diff)}`);
    } else {
      console.log(`✅ COHÉRENT (écart: ${formatCurrency(diff)})`);
    }

    // ========================================
    // 3. TRANSFERTS VERS/DEPUIS LE COFFRE
    // ========================================
    console.log('\n\n🔄 TRANSFERTS ENTRE COMPTES');
    console.log('─────────────────────────────────────────────────────────────');

    // Transferts SORTANTS du Coffre
    const transfersOut = await client.query(`
      SELECT 
        description,
        amount,
        transaction_date,
        category
      FROM transactions
      WHERE account_id = $1 
        AND is_posted = true
        AND type = 'expense'
        AND (
          category ILIKE '%transfer%'
          OR category ILIKE '%transfert%'
          OR description ILIKE '%transfert%'
          OR description ILIKE '%vers%'
        )
      ORDER BY transaction_date DESC
    `, [coffreId]);

    console.log(`\n💸 SORTIES DU COFFRE (${transfersOut.rows.length}):\n`);
    let totalOut = 0;
    transfersOut.rows.forEach(tx => {
      console.log(`   ${new Date(tx.transaction_date).toLocaleDateString('fr-FR')} - ${tx.description}`);
      console.log(`   Montant: ${formatCurrency(tx.amount)} | Catégorie: ${tx.category}`);
      console.log('');
      totalOut += parseFloat(tx.amount);
    });
    console.log(`   TOTAL SORTIES: ${formatCurrency(totalOut)}\n`);

    // Transferts ENTRANTS vers le Coffre
    const transfersIn = await client.query(`
      SELECT 
        description,
        amount,
        transaction_date,
        category
      FROM transactions
      WHERE account_id = $1 
        AND is_posted = true
        AND type = 'income'
        AND (
          category ILIKE '%transfer%'
          OR category ILIKE '%transfert%'
          OR description ILIKE '%transfert%'
          OR description ILIKE '%depuis%'
        )
      ORDER BY transaction_date DESC
    `, [coffreId]);

    console.log(`💰 ENTRÉES AU COFFRE (${transfersIn.rows.length}):\n`);
    let totalIn = 0;
    transfersIn.rows.forEach(tx => {
      console.log(`   ${new Date(tx.transaction_date).toLocaleDateString('fr-FR')} - ${tx.description}`);
      console.log(`   Montant: ${formatCurrency(tx.amount)} | Catégorie: ${tx.category}`);
      console.log('');
      totalIn += parseFloat(tx.amount);
    });
    console.log(`   TOTAL ENTRÉES: ${formatCurrency(totalIn)}\n`);

    // ========================================
    // 4. CORRÉLATION AVEC AVOIRS
    // ========================================
    console.log('\n📊 CORRÉLATION AVEC LES AVOIRS');
    console.log('─────────────────────────────────────────────────────────────');

    // Avoirs créés depuis le Coffre
    const avoirFromCoffre = await client.query(`
      SELECT 
        t.description,
        t.amount,
        t.transaction_date,
        t.category
      FROM transactions t
      WHERE t.account_id = $1 
        AND t.is_posted = true
        AND t.type = 'expense'
        AND (
          t.category ILIKE '%avoir%'
          OR t.category ILIKE '%doit%'
          OR t.description ILIKE '%avoir pour%'
        )
      ORDER BY t.transaction_date DESC
    `, [coffreId]);

    console.log(`\n💸 AVOIRS CRÉÉS DEPUIS LE COFFRE (${avoirFromCoffre.rows.length}):\n`);
    let totalAvoirOut = 0;
    avoirFromCoffre.rows.forEach(tx => {
      console.log(`   ${new Date(tx.transaction_date).toLocaleDateString('fr-FR')} - ${tx.description}`);
      console.log(`   Montant: ${formatCurrency(tx.amount)} | Catégorie: ${tx.category}`);
      console.log('');
      totalAvoirOut += parseFloat(tx.amount);
    });
    console.log(`   TOTAL AVOIRS SORTIS: ${formatCurrency(totalAvoirOut)}\n`);

    // Vérifier les receivables correspondants
    const receivablesResult = await client.query(`
      SELECT 
        person,
        amount,
        description,
        status,
        created_at
      FROM receivables
      WHERE status = 'open'
      ORDER BY amount DESC
    `);

    console.log(`🔗 RECEIVABLES OUVERTS (${receivablesResult.rows.length}):\n`);
    let totalReceivables = 0;
    receivablesResult.rows.forEach(r => {
      console.log(`   ${r.person}: ${formatCurrency(r.amount)} (${r.status})`);
      console.log(`   Description: ${r.description || 'N/A'}`);
      console.log(`   Créé le: ${new Date(r.created_at).toLocaleDateString('fr-FR')}`);
      console.log('');
      totalReceivables += parseFloat(r.amount);
    });
    console.log(`   TOTAL RECEIVABLES: ${formatCurrency(totalReceivables)}\n`);

    // ========================================
    // 5. CORRÉLATION AVEC AUTRES COMPTES
    // ========================================
    console.log('\n🔗 CORRÉLATION AVEC AUTRES COMPTES');
    console.log('─────────────────────────────────────────────────────────────');

    const otherAccounts = await client.query(`
      SELECT id, name, balance
      FROM accounts
      WHERE id != $1
      ORDER BY name
    `, [coffreId]);

    console.log('\n📌 Recherche de transferts corrélés...\n');

    for (const account of otherAccounts.rows) {
      // Transferts depuis cet autre compte vers Coffre
      const txFromAccount = await client.query(`
        SELECT 
          description,
          amount,
          transaction_date
        FROM transactions
        WHERE account_id = $1
          AND is_posted = true
          AND type = 'expense'
          AND (
            description ILIKE '%coffre%'
            OR description ILIKE '%vers coffre%'
          )
      `, [account.id]);

      // Transferts depuis Coffre vers cet autre compte
      const txToAccount = await client.query(`
        SELECT 
          description,
          amount,
          transaction_date
        FROM transactions
        WHERE account_id = $1
          AND is_posted = true
          AND type = 'expense'
          AND description ILIKE $2
      `, [coffreId, `%${account.name}%`]);

      if (txFromAccount.rows.length > 0 || txToAccount.rows.length > 0) {
        console.log(`🔹 ${account.name} (solde: ${formatCurrency(account.balance)})`);
        
        if (txFromAccount.rows.length > 0) {
          const total = txFromAccount.rows.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
          console.log(`   → Vers Coffre: ${txFromAccount.rows.length} tx, total ${formatCurrency(total)}`);
        }
        
        if (txToAccount.rows.length > 0) {
          const total = txToAccount.rows.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
          console.log(`   ← Depuis Coffre: ${txToAccount.rows.length} tx, total ${formatCurrency(total)}`);
        }
        console.log('');
      }
    }

    // ========================================
    // 6. DÉTECTION D'ANOMALIES
    // ========================================
    console.log('\n⚠️  DÉTECTION D\'ANOMALIES');
    console.log('─────────────────────────────────────────────────────────────\n');

    const anomalies = [];

    // Transactions très élevées (> 50M)
    const bigTxResult = await client.query(`
      SELECT id, description, amount, transaction_date, type
      FROM transactions
      WHERE account_id = $1 AND amount > 50000000
      ORDER BY amount DESC
    `, [coffreId]);

    if (bigTxResult.rows.length > 0) {
      console.log(`⚠️  ${bigTxResult.rows.length} transaction(s) très élevée(s) (> 50M Ar):`);
      bigTxResult.rows.forEach(tx => {
        console.log(`   • ${new Date(tx.transaction_date).toLocaleDateString('fr-FR')} - ${tx.description}`);
        console.log(`     Montant: ${formatCurrency(tx.amount)} (${tx.type})`);
      });
      anomalies.push(`${bigTxResult.rows.length} transaction(s) > 50M`);
      console.log('');
    }

    // Transactions en double (même date, même montant, même description)
    const duplicatesResult = await client.query(`
      SELECT 
        description,
        amount,
        transaction_date,
        COUNT(*) as dup_count
      FROM transactions
      WHERE account_id = $1 AND is_posted = true
      GROUP BY description, amount, transaction_date
      HAVING COUNT(*) > 1
      ORDER BY dup_count DESC, amount DESC
    `, [coffreId]);

    if (duplicatesResult.rows.length > 0) {
      console.log(`⚠️  ${duplicatesResult.rows.length} groupe(s) de doublons potentiels:`);
      duplicatesResult.rows.slice(0, 5).forEach(dup => {
        console.log(`   • ${dup.description}: ${formatCurrency(dup.amount)} (${dup.dup_count}x le ${new Date(dup.transaction_date).toLocaleDateString('fr-FR')})`);
      });
      anomalies.push(`${duplicatesResult.rows.length} doublons potentiels`);
      console.log('');
    }

    if (anomalies.length === 0) {
      console.log('✅ Aucune anomalie détectée');
    } else {
      console.log(`\n⚠️  Anomalies détectées: ${anomalies.join(', ')}`);
    }

  } catch (error) {
    console.error('Erreur lors de la vérification de l\'intégrité du Coffre:', error);
  } finally {
    client.release();
  }
}

verifyCoffreIntegrity();