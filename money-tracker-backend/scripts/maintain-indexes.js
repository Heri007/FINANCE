// scripts/maintain-indexes.js
// Script de Maintenance Automatique

const pool = require('../config/database');

async function maintainIndexes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Début de la maintenance des indexes...\n');
    
    // 1. Identifier les indexes non utilisés
    console.log('📊 Indexes non utilisés:');
    const unusedQuery = `
      SELECT 
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      JOIN pg_class ON pg_class.oid = indexrelid
      WHERE schemaname = 'public'
        AND idx_scan = 0
        AND indexname LIKE 'idx_%'
      ORDER BY pg_relation_size(indexrelid) DESC;
    `;
    const unused = await client.query(unusedQuery);
    console.table(unused.rows);
    
    // 2. Statistiques d'utilisation
    console.log('\n📈 Top 10 indexes les plus utilisés:');
    const topUsedQuery = `
      SELECT 
        tablename,
        indexname,
        idx_scan as scans,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      JOIN pg_class ON pg_class.oid = indexrelid
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY idx_scan DESC
      LIMIT 10;
    `;
    const topUsed = await client.query(topUsedQuery);
    console.table(topUsed.rows);
    
    // 3. Taille totale des indexes
    console.log('\n💾 Espace disque utilisé par table:');
    const sizeQuery = `
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
        pg_size_pretty(
          pg_total_relation_size(schemaname||'.'||tablename) - 
          pg_relation_size(schemaname||'.'||tablename)
        ) as index_size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    const sizes = await client.query(sizeQuery);
    console.table(sizes.rows);
    
    // 4. VACUUM ANALYZE
    console.log('\n🧹 Exécution de VACUUM ANALYZE...');
    const tables = ['transactions', 'accounts', 'projects', 'project_lines', 
                   'receivables', 'profit_distributions', 'notes', 'project_partners'];
    
    for (const table of tables) {
      console.log(`  ✓ VACUUM ANALYZE ${table}...`);
      await client.query(`VACUUM ANALYZE ${table}`);
    }
    
    console.log('\n✅ Maintenance terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la maintenance:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  maintainIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { maintainIndexes };
