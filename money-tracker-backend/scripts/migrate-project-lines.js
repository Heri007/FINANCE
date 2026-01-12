// migrate-project-lines.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'finance',
  user: process.env.DB_USER || 'm1',
  password: process.env.DB_PASSWORD || '',
});

async function migrateProjectLines() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔄 MIGRATION DES LIGNES DE PROJET (JSONB → Tables Relationnelles)');
    console.log('='.repeat(70));
    
    await client.query('BEGIN');
    
    // Récupérer tous les projets avec expenses/revenues
    const projectsResult = await client.query(`
      SELECT id, name, expenses, revenues 
      FROM projects 
      WHERE jsonb_array_length(COALESCE(expenses, '[]'::jsonb)) > 0 
         OR jsonb_array_length(COALESCE(revenues, '[]'::jsonb)) > 0
    `);
    
    console.log(`\nProjets trouvés: ${projectsResult.rows.length}\n`);
    
    let totalExpenses = 0;
    let totalRevenues = 0;
    
    for (const project of projectsResult.rows) {
      console.log(`📋 Projet: ${project.name} (ID: ${project.id})`);
      
      // Migrer les expenses
      if (project.expenses && Array.isArray(project.expenses)) {
        for (const expense of project.expenses) {
          await client.query(`
            INSERT INTO project_expense_lines 
              (project_id, description, category, projected_amount, is_paid, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            project.id,
            expense.description || expense.label || 'Sans description',
            expense.category || 'Non catégorisé',
            expense.amount || 0,
            expense.is_paid || false
          ]);
          totalExpenses++;
        }
        console.log(`   ✅ ${project.expenses.length} ligne(s) de dépenses migrées`);
      }
      
      // Migrer les revenues
      if (project.revenues && Array.isArray(project.revenues)) {
        for (const revenue of project.revenues) {
          await client.query(`
            INSERT INTO project_revenue_lines 
              (project_id, description, category, projected_amount, is_received, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
          `, [
            project.id,
            revenue.description || revenue.label || 'Sans description',
            revenue.category || 'Non catégorisé',
            revenue.amount || 0,
            revenue.is_received || false
          ]);
          totalRevenues++;
        }
        console.log(`   ✅ ${project.revenues.length} ligne(s) de revenus migrées`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSUMÉ DE LA MIGRATION');
    console.log('='.repeat(70));
    console.log(`Projets traités: ${projectsResult.rows.length}`);
    console.log(`Lignes de dépenses créées: ${totalExpenses}`);
    console.log(`Lignes de revenus créées: ${totalRevenues}`);
    console.log(`\n✅ Migration terminée avec succès!`);
    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier les données migrées');
    console.log('   2. Adapter votre code pour utiliser les tables relationnelles');
    console.log('   3. (Optionnel) Supprimer les colonnes JSONB expenses/revenues\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateProjectLines()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
