const pool = require('../config/database');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Ar';
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

async function findMissing9Million() {
  try {
    console.log('🔍 RECHERCHE DE L\'ÉCART DE 9 000 000 Ar\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. Vérifier s'il y a des transactions de ~9M Ar
    console.log('📌 1. TRANSACTIONS PROCHES DE 9M Ar:\n');
    const query1 = `
      SELECT 
        id,
        transaction_date,
        type,
        amount,
        description,
        category,
        account_id
      FROM transactions
      WHERE account_id = 5
        AND amount BETWEEN 8000000 AND 10000000
      ORDER BY transaction_date DESC;
    `;
    const result1 = await pool.query(query1);
    
    if (result1.rows.length > 0) {
      result1.rows.forEach(tx => {
        console.log(`   ${formatDate(tx.transaction_date)} | ${tx.type === 'income' ? '📈' : '📉'} ${formatCurrency(tx.amount)}`);
        console.log(`   ID: ${tx.id} | Catégorie: ${tx.category}`);
        console.log(`   ${tx.description}\n`);
      });
    } else {
      console.log('   ❌ Aucune transaction de ~9M Ar trouvée\n');
    }

    // 2. Transactions récentes (dernières 48h)
    console.log('\n📌 2. TRANSACTIONS DES 48 DERNIÈRES HEURES:\n');
    const query2 = `
      SELECT 
        id,
        transaction_date,
        type,
        amount,
        description,
        category,
        created_at
      FROM transactions
      WHERE account_id = 5
        AND transaction_date >= NOW() - INTERVAL '48 hours'
      ORDER BY transaction_date DESC;
    `;
    const result2 = await pool.query(query2);
    
    if (result2.rows.length > 0) {
      result2.rows.forEach(tx => {
        console.log(`   ${formatDate(tx.transaction_date)} | ${tx.type === 'income' ? '📈' : '📉'} ${formatCurrency(tx.amount)}`);
        console.log(`   Créée le: ${formatDate(tx.created_at)}`);
        console.log(`   ${tx.description}\n`);
      });
    } else {
      console.log('   ℹ️  Aucune transaction récente\n');
    }

    // 3. Chercher des combinaisons qui font 9M
    console.log('\n📌 3. COMBINAISONS POSSIBLES TOTALISANT 9M Ar:\n');
    const query3 = `
      SELECT 
        id,
        transaction_date,
        type,
        amount,
        description,
        category
      FROM transactions
      WHERE account_id = 5
        AND transaction_date >= '2025-12-01'
      ORDER BY amount DESC;
    `;
    const result3 = await pool.query(query3);
    
    // Chercher des combinaisons
    const amounts = result3.rows.map(tx => ({
      id: tx.id,
      amount: parseFloat(tx.amount),
      type: tx.type,
      date: tx.transaction_date,
      description: tx.description,
    }));

    console.log('   Recherche de combinaisons...\n');
    
    // Combinaison de 2 transactions
    for (let i = 0; i < amounts.length; i++) {
      for (let j = i + 1; j < amounts.length; j++) {
        const sum = amounts[i].amount + amounts[j].amount;
        if (Math.abs(sum - 9000000) < 100000) { // Tolérance de 100k
          console.log(`   ✅ COMBINAISON TROUVÉE (${formatCurrency(sum)}):`);
          console.log(`      • ${formatDate(amounts[i].date)} - ${formatCurrency(amounts[i].amount)} (${amounts[i].type})`);
          console.log(`        ${amounts[i].description}`);
          console.log(`      • ${formatDate(amounts[j].date)} - ${formatCurrency(amounts[j].amount)} (${amounts[j].type})`);
          console.log(`        ${amounts[j].description}\n`);
        }
      }
    }

    // Combinaison de 3 transactions
    for (let i = 0; i < Math.min(amounts.length, 20); i++) {
      for (let j = i + 1; j < Math.min(amounts.length, 20); j++) {
        for (let k = j + 1; k < Math.min(amounts.length, 20); k++) {
          const sum = amounts[i].amount + amounts[j].amount + amounts[k].amount;
          if (Math.abs(sum - 9000000) < 100000) {
            console.log(`   ✅ COMBINAISON TROUVÉE (${formatCurrency(sum)}):`);
            console.log(`      • ${formatDate(amounts[i].date)} - ${formatCurrency(amounts[i].amount)}`);
            console.log(`      • ${formatDate(amounts[j].date)} - ${formatCurrency(amounts[j].amount)}`);
            console.log(`      • ${formatDate(amounts[k].date)} - ${formatCurrency(amounts[k].amount)}\n`);
          }
        }
      }
    }

    // 4. Historique des modifications du solde
    console.log('\n📌 4. HISTORIQUE DES MODIFICATIONS DU COMPTE:\n');
    const query4 = `
      SELECT 
        balance,
        updated_at
      FROM accounts
      WHERE id = 5
      ORDER BY updated_at DESC
      LIMIT 10;
    `;
    const result4 = await pool.query(query4);
    
    if (result4.rows.length > 0) {
      result4.rows.forEach(record => {
        console.log(`   ${formatDate(record.updated_at)} → ${formatCurrency(record.balance)}`);
      });
    }

    // 5. Vérifier si une transaction a été supprimée
    console.log('\n\n📌 5. AUDIT LOG (si activé):\n');
    const query5 = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'audit_log' OR table_name = 'transaction_history';
    `;
    const result5 = await pool.query(query5);
    
    if (result5.rows.length > 0) {
      console.log('   ✅ Table d\'audit trouvée. Vérification...');
      // Requête d'audit à adapter selon votre schéma
    } else {
      console.log('   ⚠️  Aucune table d\'audit trouvée');
    }

    // 6. Recalculer le solde manuellement
    console.log('\n\n📌 6. RECALCUL MANUEL DU SOLDE:\n');
    const query6 = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
      FROM transactions
      WHERE account_id = 5;
    `;
    const result6 = await pool.query(query6);
    
    const totalIncome = parseFloat(result6.rows[0].total_income || 0);
    const totalExpense = parseFloat(result6.rows[0].total_expense || 0);
    const calculatedBalance = totalIncome - totalExpense;
    const currentBalance = 56000000;
    const expectedBalance = 65000000;
    const discrepancy = expectedBalance - calculatedBalance;

    console.log(`   Total revenus:     ${formatCurrency(totalIncome)}`);
    console.log(`   Total dépenses:    ${formatCurrency(totalExpense)}`);
    console.log(`   Solde calculé:     ${formatCurrency(calculatedBalance)}`);
    console.log(`   Solde actuel BD:   ${formatCurrency(currentBalance)}`);
    console.log(`   Solde attendu:     ${formatCurrency(expectedBalance)}`);
    console.log(`   \n   ⚠️  ÉCART:          ${formatCurrency(discrepancy)}\n`);

    if (discrepancy > 0) {
      console.log(`   ❌ Il manque ${formatCurrency(discrepancy)} en revenus`);
      console.log(`   OU`);
      console.log(`   ❌ Il y a ${formatCurrency(discrepancy)} en dépenses en trop\n`);
    } else if (discrepancy < 0) {
      console.log(`   ❌ Il y a ${formatCurrency(Math.abs(discrepancy))} en revenus en trop`);
      console.log(`   OU`);
      console.log(`   ❌ Il manque ${formatCurrency(Math.abs(discrepancy))} en dépenses\n`);
    }

    // 7. Suggestions de correction
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('💡 SUGGESTIONS DE CORRECTION:\n');
    
    console.log('Option 1: AJOUTER une transaction de revenu manquante');
    console.log(`   → Montant: ${formatCurrency(Math.abs(discrepancy))}`);
    console.log(`   → Catégorie: À déterminer (Extra Solde, Remboursement, etc.)`);
    console.log(`   → Description: Régularisation écart inventaire\n`);

    console.log('Option 2: SUPPRIMER une dépense erronée');
    console.log(`   → Chercher une dépense de ${formatCurrency(Math.abs(discrepancy))}\n`);

    console.log('Option 3: CORRIGER le solde initial');
    console.log(`   → Modifier la transaction du 28/09/2025`);
    console.log(`   → De: 84 000 000 Ar`);
    console.log(`   → À: ${formatCurrency(84000000 + discrepancy)}\n`);

    console.log('Option 4: AUDIT PHYSIQUE');
    console.log(`   → Compter le cash physique dans le coffre`);
    console.log(`   → Vérifier les registres papier`);
    console.log(`   → Croiser avec les reçus\n`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

findMissing9Million();
