const pool = require('../config/database');

async function resyncProjectLines() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const projectsResult = await client.query(
      'SELECT id, name, expenses, revenues FROM projects WHERE status = $1',
      ['active']
    );
    
    console.log(`📦 ${projectsResult.rows.length} projets à synchroniser`);
    
    for (const project of projectsResult.rows) {
      const expenses = typeof project.expenses === 'string' 
        ? JSON.parse(project.expenses) 
        : project.expenses || [];
      
      const revenues = typeof project.revenues === 'string'
        ? JSON.parse(project.revenues)
        : project.revenues || [];
      
      console.log(`\n🔄 Projet: ${project.name}`);
      console.log(`   - ${expenses.length} dépenses dans JSON`);
      console.log(`   - ${revenues.length} revenus dans JSON`);
      
      // NE PAS supprimer, juste mettre à jour ou insérer si manquant
      for (const expense of expenses) {
        // Vérifier si la ligne existe déjà
        const existing = await client.query(
          `SELECT id, is_paid FROM project_expense_lines 
           WHERE project_id = $1 AND description = $2`,
          [project.id, expense.description || expense.name || '']
        );
        
        if (existing.rows.length > 0) {
          // Mettre à jour seulement si nécessaire (garder is_paid)
          await client.query(
            `UPDATE project_expense_lines 
             SET category = $1, 
                 projected_amount = $2, 
                 actual_amount = $3,
                 transaction_date = $4,
                 last_synced_at = NOW()
             WHERE id = $5`,
            [
              expense.category || 'Autre',
              parseFloat(expense.amount || expense.projectedAmount || 0),
              parseFloat(expense.actualAmount || 0),
              expense.date || expense.transactionDate || new Date(),
              existing.rows[0].id
            ]
          );
        } else {
          // Insérer nouvelle ligne
          await client.query(
            `INSERT INTO project_expense_lines 
             (project_id, description, category, projected_amount, actual_amount, 
              transaction_date, is_paid, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              project.id,
              expense.description || expense.name || '',
              expense.category || 'Autre',
              parseFloat(expense.amount || expense.projectedAmount || 0),
              parseFloat(expense.actualAmount || 0),
              expense.date || expense.transactionDate || new Date(),
              expense.isPaid || false
            ]
          );
        }
      }
      
      // Même chose pour les revenus
      for (const revenue of revenues) {
        const existing = await client.query(
          `SELECT id, is_received FROM project_revenue_lines 
           WHERE project_id = $1 AND description = $2`,
          [project.id, revenue.description || revenue.name || '']
        );
        
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE project_revenue_lines 
             SET category = $1, 
                 projected_amount = $2, 
                 actual_amount = $3,
                 transaction_date = $4,
                 last_synced_at = NOW()
             WHERE id = $5`,
            [
              revenue.category || 'Autre',
              parseFloat(revenue.amount || revenue.projectedAmount || 0),
              parseFloat(revenue.actualAmount || 0),
              revenue.date || revenue.transactionDate || new Date(),
              existing.rows[0].id
            ]
          );
        } else {
          await client.query(
            `INSERT INTO project_revenue_lines 
             (project_id, description, category, projected_amount, actual_amount, 
              transaction_date, is_received, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              project.id,
              revenue.description || revenue.name || '',
              revenue.category || 'Autre',
              parseFloat(revenue.amount || revenue.projectedAmount || 0),
              parseFloat(revenue.actualAmount || 0),
              revenue.date || revenue.transactionDate || new Date(),
              revenue.isReceived || false
            ]
          );
        }
      }
      
      console.log(`   ✅ Lignes synchronisées (update ou insert)`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Synchronisation terminée avec succès');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

resyncProjectLines();
