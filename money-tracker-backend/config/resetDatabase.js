// config/resetDatabase.js
const pool = require('./database');

async function resetDatabase() {
  const client = await pool.connect();
  try {
    console.log('🔄 Réinitialisation de la base de données...');
    
    await client.query('BEGIN');

    // Supprimer toutes les données existantes
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM sessions');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM app_settings');

    console.log('✅ Données supprimées');

    // Réinitialiser les séquences
    await client.query('ALTER SEQUENCE accounts_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE transactions_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE sessions_id_seq RESTART WITH 1');
    await client.query('ALTER SEQUENCE app_settings_id_seq RESTART WITH 1');

    // Insérer les comptes par défaut
    await client.query(`
      INSERT INTO accounts (name, type, balance) VALUES
        ('Argent liquide', 'cash', 0),
        ('COFFRE', 'savings', 0),
        ('ORANGE MONEY', 'mobile', 0),
        ('MVOLA', 'mobile', 0),
        ('BOA', 'bank', 0),
        ('AVOIR', 'credit', 0),
        ('RedotPay USD', 'digital', 0)
    `);

    console.log('✅ Comptes créés');

    await client.query('COMMIT');
    console.log('✅ Base de données réinitialisée avec succès !');
    console.log('ℹ️  Vous pouvez maintenant créer un nouveau PIN');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la réinitialisation:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

resetDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});