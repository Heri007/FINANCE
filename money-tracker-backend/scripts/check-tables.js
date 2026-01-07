const pool = require('../config/database');

async function checkTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Vérification des tables dans la base de données...\n');
    
    // Lister toutes les tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📊 Tables existantes (${result.rows.length}) :\n`);
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Chercher spécifiquement les tables de projet
    console.log('\n🔍 Recherche des tables de lignes de projet...');
    const projectTables = result.rows.filter(row => 
      row.table_name.includes('expense') || 
      row.table_name.includes('revenue') ||
      row.table_name.includes('line')
    );
    
    if (projectTables.length > 0) {
      console.log('\n📋 Tables liées aux lignes de projet :');
      projectTables.forEach(row => {
        console.log(`  ✓ ${row.table_name}`);
      });
    } else {
      console.log('\n❌ Aucune table pour les lignes de projet trouvée');
      console.log('\n💡 Les tables suivantes doivent être créées :');
      console.log('  - project_expense_lines (ou projectexpenselines)');
      console.log('  - project_revenue_lines (ou projectrevenuelines)');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkTables();
