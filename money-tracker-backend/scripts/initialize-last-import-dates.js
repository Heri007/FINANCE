// scripts/initialize-last-import-dates.js

const pool = require('../config/database');

async function initializeLastImportDates() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Initialisation des last_import_date...\n');
    
    await client.query('BEGIN');
    
    // Ajouter la colonne si elle n'existe pas
    await client.query(`
      ALTER TABLE accounts 
      ADD COLUMN IF NOT EXISTS last_import_date DATE DEFAULT NULL
    `);
    
    // Pour chaque compte, définir last_import_date = date de la dernière transaction
    const accounts = await client.query('SELECT id, name FROM accounts');
    
    for (const account of accounts.rows) {
      const lastTx = await client.query(`
        SELECT MAX(transaction_date) as max_date
        FROM transactions
        WHERE account_id = $1
      `, [account.id]);
      
      const maxDate = lastTx.rows[0].max_date;
      
      if (maxDate) {
        await client.query(`
          UPDATE accounts 
          SET last_import_date = $1 
          WHERE id = $2
        `, [maxDate, account.id]);
        
        console.log(`✅ ${account.name}: ${maxDate}`);
      } else {
        console.log(`ℹ️  ${account.name}: Aucune transaction`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Initialisation terminée !\n');
    
    // Afficher le résultat
    const result = await client.query(`
      SELECT id, name, last_import_date 
      FROM accounts 
      ORDER BY id
    `);
    
    console.table(result.rows);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeLastImportDates();
