// scripts/diagnose-capital-investing.js
const pool = require('../config/database');

async function diagnoseCapitalInvesting() {
  try {
    console.log('🔍 DIAGNOSTIC COMPLET - CAPITAL INVESTING\n');
    console.log('='.repeat(60) + '\n');
    
    // 1. Chercher le projet avec différentes variantes
    console.log('1️⃣ Recherche du projet...\n');
    
    const projectSearches = [
      { query: `SELECT id, name, type FROM projects WHERE name ILIKE '%CAPITAL%'`, label: 'Contient "CAPITAL"' },
      { query: `SELECT id, name, type FROM projects WHERE name ILIKE '%INVESTING%'`, label: 'Contient "INVESTING"' },
      { query: `SELECT id, name, type FROM projects WHERE type = 'PRODUCTFLIP'`, label: 'Type PRODUCTFLIP' },
      { query: `SELECT id, name, type FROM projects ORDER BY created_at DESC LIMIT 10`, label: 'Les 10 derniers projets' }
    ];
    
    for (const search of projectSearches) {
      console.log(`📋 ${search.label}:`);
      const result = await pool.query(search.query);
      
      if (result.rows.length > 0) {
        result.rows.forEach(p => {
          console.log(`   ✅ ID ${p.id}: "${p.name}" (${p.type || 'N/A'})`);
        });
      } else {
        console.log('   ❌ Aucun résultat');
      }
      console.log('');
    }
    
    // 2. Lister TOUS les projets
    console.log('2️⃣ LISTE COMPLÈTE DES PROJETS:\n');
    const allProjects = await pool.query(`
      SELECT id, name, type, status, total_cost, total_revenues
      FROM projects
      ORDER BY id DESC
    `);
    
    console.log(`   Total: ${allProjects.rows.length} projets\n`);
    allProjects.rows.forEach(p => {
      console.log(`   [${p.id}] ${p.name}`);
      console.log(`       Type: ${p.type || 'N/A'} | Statut: ${p.status}`);
      console.log(`       Budget: ${parseFloat(p.total_cost || 0).toLocaleString()} Ar`);
      console.log(`       Revenus: ${parseFloat(p.total_revenues || 0).toLocaleString()} Ar`);
      console.log('');
    });
    
    // 3. Chercher les lignes de revenus avec 30M
    console.log('3️⃣ Recherche des revenus de 30 000 000 Ar...\n');
    const revenueSearch = await pool.query(`
      SELECT 
        prl.id,
        prl.project_id,
        prl.description,
        prl.projected_amount,
        prl.transaction_date,
        p.name as project_name
      FROM project_revenue_lines prl
      LEFT JOIN projects p ON p.id = prl.project_id
      WHERE prl.projected_amount = 30000000
    `);
    
    if (revenueSearch.rows.length > 0) {
      console.log(`✅ Trouvé ${revenueSearch.rows.length} revenu(s) de 30M:\n`);
      revenueSearch.rows.forEach(r => {
        console.log(`   ID: ${r.id}`);
        console.log(`   Projet: ${r.project_name || 'NULL'} (ID: ${r.project_id || 'NULL'})`);
        console.log(`   Description: "${r.description}"`);
        console.log(`   Date: ${r.transaction_date || 'NULL ❌'}`);
        console.log('');
      });
    } else {
      console.log('❌ Aucun revenu de 30M trouvé\n');
    }
    
    // 4. Chercher toutes les lignes de revenus sans date
    console.log('4️⃣ Revenus SANS date de transaction:\n');
    const noDateRevenues = await pool.query(`
      SELECT 
        prl.id,
        prl.project_id,
        prl.description,
        prl.projected_amount,
        p.name as project_name
      FROM project_revenue_lines prl
      LEFT JOIN projects p ON p.id = prl.project_id
      WHERE prl.transaction_date IS NULL
      ORDER BY prl.projected_amount DESC
    `);
    
    if (noDateRevenues.rows.length > 0) {
      console.log(`⚠️  Trouvé ${noDateRevenues.rows.length} revenu(s) sans date:\n`);
      noDateRevenues.rows.forEach(r => {
        console.log(`   ID: ${r.id} | Projet: ${r.project_name || 'NULL'}`);
        console.log(`   Description: "${r.description}"`);
        console.log(`   Montant: ${parseFloat(r.projected_amount).toLocaleString()} Ar`);
        console.log('');
      });
    } else {
      console.log('✅ Tous les revenus ont une date\n');
    }
    
    // 5. Structure de la table
    console.log('5️⃣ Structure de project_revenue_lines:\n');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'project_revenue_lines'
      ORDER BY ordinal_position
    `);
    
    console.log('   Colonnes:');
    tableStructure.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    process.exit(0);
  }
}

diagnoseCapitalInvesting();
