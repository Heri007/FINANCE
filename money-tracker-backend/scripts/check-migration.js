// scripts/check-migration.js
const pool = require('../config/database');

async function checkMigration() {
  console.log('🔍 Vérification de la migration...\n');
  
  // 1. Compter les projets
  const projects = await pool.query('SELECT id, name FROM projects ORDER BY id');
  console.log(`${projects.rows.length} projets en base:`);
  projects.rows.forEach(p => console.log(`  - ${p.id}: ${p.name}`));
  
  console.log('\n📊 Détails par projet:');
  
  for (const project of projects.rows) {
    const expenses = await pool.query(
      'SELECT COUNT(*) FROM project_expense_lines WHERE project_id = $1',
      [project.id]
    );
    
    const revenues = await pool.query(
      'SELECT COUNT(*) FROM project_revenue_lines WHERE project_id = $1',
      [project.id]
    );
    
    console.log(`\n${project.name} (ID: ${project.id}):`);
    console.log(`  Dépenses: ${expenses.rows[0].count} lignes`);
    console.log(`  Revenus: ${revenues.rows[0].count} lignes`);
    
    // Afficher quelques lignes
    if (expenses.rows[0].count > 0) {
      const sampleExp = await pool.query(
        'SELECT description, projected_amount, is_paid FROM project_expense_lines WHERE project_id = $1 LIMIT 3',
        [project.id]
      );
      sampleExp.rows.forEach(exp => {
        console.log(`    • ${exp.description}: ${exp.projected_amount} (${exp.is_paid ? 'payé' : 'à payer'})`);
      });
    }
  }
  
  console.log('\n✅ Vérification terminée');
}

checkMigration().catch(console.error);