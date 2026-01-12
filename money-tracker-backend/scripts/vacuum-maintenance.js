// Script de maintenance VACUUM ANALYZE - Version Simple
const pool = require('../config/database');

async function runVacuumMaintenance() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Début de la maintenance VACUUM ANALYZE...\n');
    const startTime = Date.now();
    
    const tables = [
      'transactions',
      'accounts',
      'projects',
      'project_expense_lines',
      'project_revenue_lines',
      'receivables',
      'notes',
      'transaction_linking_log',
      'sessions',
      'tasks',
      'sops',
      'employees',
      'objectives'
    ];
    
    console.log(`📊 Maintenance de ${tables.length} tables...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const table of tables) {
      try {
        console.log(`  ✓ VACUUM ANALYZE ${table}...`);
        await client.query(`VACUUM ANALYZE ${table}`);
        successCount++;
      } catch (error) {
        console.error(`  ⚠️  Erreur sur ${table}:`, error.message);
        errorCount++;
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Maintenance terminée en ${duration}s!`);
    console.log(`   • Tables traitées avec succès: ${successCount}/${tables.length}`);
    console.log(`   • Erreurs: ${errorCount}\n`);
    
    // Rapport simple
    console.log('📋 Taille des tables:');
    const sizeQuery = `
      SELECT 
        t.tablename,
        pg_size_pretty(pg_relation_size('public.'||t.tablename)) as size
      FROM pg_tables t
      WHERE t.schemaname = 'public'
        AND t.tablename IN (${tables.map(t => `'${t}'`).join(',')})
      ORDER BY pg_relation_size('public.'||t.tablename) DESC;
    `;
    const sizes = await client.query(sizeQuery);
    console.table(sizes.rows);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runVacuumMaintenance()
    .then(() => {
      console.log('✨ Terminé!\n');
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = { runVacuumMaintenance };
