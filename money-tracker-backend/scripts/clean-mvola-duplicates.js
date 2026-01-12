// scripts/clean-mvola-duplicates.js
const pool = require('../config/database');

async function cleanMVolaDuplicates() {
  const client = await pool.connect();
  
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🧹 NETTOYAGE DES DOUBLONS MVOLA');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    await client.query('BEGIN');
    
    // 1. Identifier les doublons précis
    const duplicates = [
      { old_id: 33, new_id: 382, desc: '@HIROKO', amount: 1008500 },
      { old_id: 129, new_id: 405, desc: 'Transfer 975k', amount: 975000 },
      { old_id: 130, new_id: 406, desc: '@RANDOU', amount: 848200 },
      { old_id: 163, new_id: 417, desc: 'Transfer 620k', amount: 620000 },
      { old_id: 164, new_id: 418, desc: 'DEPART @DELAH', amount: 608200 },
      { old_id: 7, new_id: 371, desc: 'RAPATR @DOVIC', amount: 505200 }
    ];
    
    console.log('🔍 Vérification des doublons identifiés...\n');
    
    for (const dup of duplicates) {
      // Vérifier que les deux transactions existent
      const check = await client.query(`
        SELECT 
          id, 
          transaction_date, 
          type, 
          amount, 
          description,
          created_at
        FROM transactions 
        WHERE id IN ($1, $2) 
          AND account_id = 2
        ORDER BY id
      `, [dup.old_id, dup.new_id]);
      
      if (check.rows.length === 2) {
        console.log(`✅ Doublon confirmé: ${dup.desc} (${dup.amount.toLocaleString()} Ar)`);
        console.table(check.rows);
        
        // Supprimer le doublon le plus récent (new_id)
        const deleted = await client.query(`
          DELETE FROM transactions 
          WHERE id = $1 
          RETURNING id, description, amount, created_at
        `, [dup.new_id]);
        
        console.log(`🗑️  Supprimé: ID ${dup.new_id}\n`);
      } else {
        console.log(`⚠️  Doublon non trouvé: ${dup.desc}\n`);
      }
    }
    
    // 2. Recalculer le solde MVola
    const newBalance = await client.query(`
      SELECT 
        COALESCE(
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 
          0
        ) as calculated_balance
      FROM transactions 
      WHERE account_id = 2
    `);
    
    const calcBalance = parseFloat(newBalance.rows[0].calculated_balance);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💰 NOUVEAU SOLDE CALCULÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Solde recalculé: ${calcBalance.toLocaleString('fr-FR')} Ar\n`);
    
    // 3. Mettre à jour le solde dans accounts
    await client.query(`
      UPDATE accounts 
      SET balance = $1, updated_at = NOW() 
      WHERE id = 2
    `, [calcBalance]);
    
    console.log('✅ Solde MVola mis à jour dans la table accounts\n');
    
    // 4. Statistiques post-nettoyage
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE type = 'income') as income_count,
        COUNT(*) FILTER (WHERE type = 'expense') as expense_count,
        SUM(amount) FILTER (WHERE type = 'income') as total_income,
        SUM(amount) FILTER (WHERE type = 'expense') as total_expense
      FROM transactions 
      WHERE account_id = 2
    `);
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES POST-NETTOYAGE');
    console.log('═══════════════════════════════════════════════════════════');
    console.table(stats.rows[0]);
    
    await client.query('COMMIT');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ ✅ ✅ NETTOYAGE TERMINÉ AVEC SUCCÈS ! ✅ ✅ ✅');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERREUR:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanMVolaDuplicates()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
