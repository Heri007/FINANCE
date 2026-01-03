// scripts/adjust-coffre-balance.js
const pool = require('../config/database');

async function adjustCoffreBalance() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Vérification du solde actuel du Coffre...\n');
    
    // 1. Vérifier le solde actuel
    const currentBalanceResult = await client.query(`
      SELECT 
        balance,
        (SELECT SUM(amount) FROM transactions WHERE account_id = 5 AND type = 'income') as total_income,
        (SELECT SUM(amount) FROM transactions WHERE account_id = 5 AND type = 'expense') as total_expense
      FROM accounts
      WHERE id = 5
    `);
    
    const current = currentBalanceResult.rows[0];
    const currentBalance = parseFloat(current.balance);
    const calculatedBalance = parseFloat(current.total_income) - parseFloat(current.total_expense);
    
    console.log('💰 État actuel:');
    console.log(`   Solde en base: ${currentBalance.toLocaleString()} Ar`);
    console.log(`   Solde calculé: ${calculatedBalance.toLocaleString()} Ar`);
    console.log(`   Revenus: ${parseFloat(current.total_income).toLocaleString()} Ar`);
    console.log(`   Dépenses: ${parseFloat(current.total_expense).toLocaleString()} Ar`);
    
    const targetBalance = 40000000;
    const adjustment = targetBalance - currentBalance;
    
    console.log(`\n🎯 Objectif:`);
    console.log(`   Solde souhaité: ${targetBalance.toLocaleString()} Ar`);
    console.log(`   Ajustement nécessaire: ${adjustment.toLocaleString()} Ar`);
    
    if (adjustment === 0) {
      console.log('\n✅ Le solde est déjà correct !');
      await client.query('ROLLBACK');
      return;
    }
    
    // 2. Créer la transaction d'ajustement
    const txType = adjustment > 0 ? 'income' : 'expense';
    const txAmount = Math.abs(adjustment);
    
    const txResult = await client.query(`
      INSERT INTO transactions (
        account_id,
        type,
        amount,
        category,
        description,
        transaction_date,
        is_planned,
        is_posted,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      5, // Coffre
      txType,
      txAmount,
      'Ajustement Balance',
      `Ajustement pour rétablir le solde à ${targetBalance.toLocaleString()} Ar`,
      new Date(),
      false,
      true
    ]);
    
    const txId = txResult.rows[0].id;
    console.log(`\n✅ Transaction d'ajustement créée: ID ${txId}`);
    console.log(`   Type: ${txType === 'income' ? 'Revenu' : 'Dépense'}`);
    console.log(`   Montant: ${txAmount.toLocaleString()} Ar`);
    
    // 3. Mettre à jour le solde
    await client.query(
      'UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = 5',
      [targetBalance]
    );
    
    await client.query('COMMIT');
    
    console.log('\n✅ ✅ ✅ AJUSTEMENT TERMINÉ ! ✅ ✅ ✅');
    console.log(`\n💰 Nouveau solde Coffre: ${targetBalance.toLocaleString()} Ar`);
    
    // 4. Vérification finale
    const verifyResult = await client.query(`
      SELECT 
        balance,
        (SELECT SUM(amount) FROM transactions WHERE account_id = 5 AND type = 'income') as income,
        (SELECT SUM(amount) FROM transactions WHERE account_id = 5 AND type = 'expense') as expense
      FROM accounts
      WHERE id = 5
    `);
    
    const verify = verifyResult.rows[0];
    const newCalculated = parseFloat(verify.income) - parseFloat(verify.expense);
    
    console.log('\n📊 Vérification:');
    console.log(`   Solde en base: ${parseFloat(verify.balance).toLocaleString()} Ar`);
    console.log(`   Solde calculé: ${newCalculated.toLocaleString()} Ar`);
    console.log(`   Écart: ${(parseFloat(verify.balance) - newCalculated).toLocaleString()} Ar`);
    
    if (Math.abs(parseFloat(verify.balance) - newCalculated) < 1) {
      console.log('\n✅ Le solde est maintenant cohérent !');
    } else {
      console.log('\n⚠️  Attention: Écart détecté entre le solde et le calcul');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

adjustCoffreBalance();
