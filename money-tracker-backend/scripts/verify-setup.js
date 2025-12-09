const pool = require('../config/database');

async function verifySetup() {
  console.log('🔍 VÉRIFICATION DE LA BASE DE DONNÉES\n');
  
  try {
    // 1. Vérifier les colonnes
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name IN ('is_posted', 'is_planned', 'project_id')
    `);
    console.log(`✅ Colonnes transactions: ${columnsCheck.rows.length}/3 présentes`);
    columnsCheck.rows.forEach(r => console.log(`   - ${r.column_name}`));
    
    // 2. Vérifier les tables
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('accounts', 'transactions', 'projects', 'sops', 'tasks', 'master_content')
    `);
    console.log(`\n📋 Tables présentes: ${tablesCheck.rows.length}/6`);
    tablesCheck.rows.forEach(r => console.log(`   ✓ ${r.table_name}`));
    
    const missingTables = ['accounts', 'transactions', 'projects', 'sops', 'tasks', 'master_content']
      .filter(t => !tablesCheck.rows.find(r => r.table_name === t));
    if (missingTables.length > 0) {
      console.log(`\n❌ Tables manquantes: ${missingTables.join(', ')}`);
    }
    
    // 3. Vérifier les catégories
    const categoriesCheck = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM transactions 
      WHERE type = 'expense' AND category != 'Autre'
      GROUP BY category 
      ORDER BY count DESC 
      LIMIT 5
    `);
    console.log('\n📊 Top 5 catégories de dépenses:');
    categoriesCheck.rows.forEach(r => console.log(`   - ${r.category}: ${r.count}`));
    
    // 4. Vérifier les comptes
    const accountsCheck = await pool.query('SELECT COUNT(*) as count FROM accounts');
    console.log(`\n💰 Comptes créés: ${accountsCheck.rows[0].count}`);
    
    // 5. Vérifier les transactions
    const transactionsCheck = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_posted = true) as posted,
        COUNT(*) FILTER (WHERE is_planned = true AND is_posted = false) as planned,
        COUNT(*) as total
      FROM transactions
    `);
    console.log('\n📝 Transactions:');
    console.log(`   - Postées: ${transactionsCheck.rows[0].posted}`);
    console.log(`   - Planifiées: ${transactionsCheck.rows[0].planned}`);
    console.log(`   - Total: ${transactionsCheck.rows[0].total}`);
    
    console.log('\n✅ Vérification terminée !');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

verifySetup();
