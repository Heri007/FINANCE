// scripts/clean-specific-duplicates.js
const pool = require('../config/database');

async function cleanSpecificDuplicates() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // IDs à supprimer (les plus récents : créés le 19/12)
    const idsToDelete = [384, 408, 409, 420, 421, 373];
    
    console.log('🗑️  Suppression des doublons identifiés:', idsToDelete);
    
    const result = await client.query(
      'DELETE FROM transactions WHERE id = ANY($1::int[]) RETURNING id, description, amount',
      [idsToDelete]
    );
    
    console.table(result.rows);
    
    // Recalculer le solde MVola
    await client.query(`
      UPDATE accounts 
      SET balance = (
        SELECT COALESCE(SUM(
          CASE WHEN type = 'income' THEN amount ELSE -amount END
        ), 0)
        FROM transactions
        WHERE account_id = 2
      )
      WHERE id = 2
    `);
    
    const newBalance = await client.query('SELECT balance FROM accounts WHERE id = 2');
    console.log(`\n💵 Nouveau solde MVola: ${parseFloat(newBalance.rows[0].balance).toLocaleString('fr-FR')} Ar`);
    
    await client.query('COMMIT');
    console.log('\n✅ Nettoyage terminé !');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanSpecificDuplicates();
