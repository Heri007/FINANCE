const pool = require('../config/database');

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Ar';
};

async function fixNemoDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 CORRECTION DES DOUBLONS NEMO EXPORT\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    await client.query('BEGIN');

    // 1. Récupérer les infos avant suppression
    const duplicateIds = [483, 484];
    const queryBefore = `
      SELECT id, transaction_date, amount, description, category
      FROM transactions
      WHERE id = ANY($1)
      ORDER BY id;
    `;
    const resultBefore = await client.query(queryBefore, [duplicateIds]);

    console.log('📋 TRANSACTIONS À SUPPRIMER:\n');
    let totalToRemove = 0;
    resultBefore.rows.forEach(tx => {
      console.log(`   ID ${tx.id}: ${formatCurrency(tx.amount)}`);
      console.log(`   Date: ${tx.transaction_date.toLocaleDateString('fr-FR')}`);
      console.log(`   ${tx.description}`);
      console.log(`   Catégorie: ${tx.category}\n`);
      totalToRemove += parseFloat(tx.amount);
    });

    console.log(`   TOTAL À SUPPRIMER: ${formatCurrency(totalToRemove)}\n`);

    // 2. Vérifier le solde actuel du Coffre
    const accountQuery = 'SELECT id, name, balance FROM accounts WHERE id = 5';
    const accountResult = await client.query(accountQuery);
    const currentBalance = parseFloat(accountResult.rows[0].balance);
    
    console.log(`💰 SOLDE ACTUEL: ${formatCurrency(currentBalance)}`);
    console.log(`💰 SOLDE APRÈS CORRECTION: ${formatCurrency(currentBalance + totalToRemove)}\n`);

    // 3. Demander confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('⚠️  Confirmer la suppression des doublons? (oui/non): ', async (answer) => {
      try {
        if (answer.toLowerCase() === 'oui') {
          
          // Supprimer les transactions doublons
          console.log('\n🗑️  Suppression des transactions...');
          const deleteQuery = 'DELETE FROM transactions WHERE id = ANY($1) RETURNING *';
          const deleteResult = await client.query(deleteQuery, [duplicateIds]);
          
          console.log(`✅ ${deleteResult.rows.length} transaction(s) supprimée(s)\n`);

          // Ajuster le solde du compte (enlever la dépense dupliquée = ajouter au solde)
          console.log('💰 Ajustement du solde du Coffre...');
          const updateQuery = `
            UPDATE accounts 
            SET balance = balance + $1,
                updated_at = NOW()
            WHERE id = 5
            RETURNING id, name, balance;
          `;
          const updateResult = await client.query(updateQuery, [totalToRemove]);
          
          const newBalance = parseFloat(updateResult.rows[0].balance);
          console.log(`✅ Nouveau solde: ${formatCurrency(newBalance)}\n`);

          // Créer une note de correction (optionnel)
          const noteQuery = `
            INSERT INTO transactions (
              account_id,
              type,
              amount,
              description,
              category,
              transaction_date,
              created_at
            ) VALUES (
              5,
              'income',
              0,
              'NOTE DE CORRECTION: Suppression doublons NEMO EXPORT (IDs 483, 484) - Total ajusté: ${formatCurrency(totalToRemove)}',
              'Correction',
              NOW(),
              NOW()
            );
          `;
          // Décommentez si vous voulez garder une trace:
          // await client.query(noteQuery);

          await client.query('COMMIT');
          
          console.log('═══════════════════════════════════════════════════════════════');
          console.log('✅ CORRECTION RÉUSSIE!\n');
          console.log('📊 RÉSUMÉ:');
          console.log(`   • Transactions supprimées: ${deleteResult.rows.length}`);
          console.log(`   • Montant ajusté: +${formatCurrency(totalToRemove)}`);
          console.log(`   • Ancien solde: ${formatCurrency(currentBalance)}`);
          console.log(`   • Nouveau solde: ${formatCurrency(newBalance)}`);
          console.log(`   • Solde attendu: 65 000 000,00 Ar`);
          console.log(`   • Écart restant: ${formatCurrency(65000000 - newBalance)}\n`);

          if (Math.abs(newBalance - 65000000) < 0.01) {
            console.log('🎉 LE SOLDE EST MAINTENANT CORRECT!\n');
          } else {
            console.log(`⚠️  Un écart de ${formatCurrency(Math.abs(65000000 - newBalance))} subsiste.\n`);
          }

          console.log('💡 PROCHAINES ÉTAPES:');
          console.log('   1. Vérifier le solde avec: node scripts/verify-coffre-integrity.js');
          console.log('   2. Mettre en place des contrôles anti-doublons\n');
          
        } else {
          await client.query('ROLLBACK');
          console.log('\n❌ Correction annulée. Aucune modification effectuée.\n');
        }
        
      } catch (innerError) {
        await client.query('ROLLBACK');
        console.error('\n❌ Erreur lors de la correction:', innerError.message);
      } finally {
        readline.close();
        client.release();
        await pool.end();
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
    client.release();
    await pool.end();
  }
}

fixNemoDuplicates();
