// scripts/sync-natiora-expenses.js
const pool = require('../config/database');

async function syncNatioraExpenses() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Synchronisation Natiora - JSON vers Tables\n');
    
    // 1. Récupérer le JSON expenses
    const projectResult = await client.query(
      'SELECT id, name, expenses FROM projects WHERE id = 24'
    );
    
    const project = projectResult.rows[0];
    let expenses = [];
    
    if (project.expenses) {
      expenses = typeof project.expenses === 'string' 
        ? JSON.parse(project.expenses) 
        : project.expenses;
    }
    
    console.log('Projet: ' + project.name);
    console.log('Expenses dans JSON: ' + expenses.length + '\n');
    
    if (expenses.length === 0) {
      console.log('Aucune expense dans le JSON. Arret.');
      await client.query('ROLLBACK');
      return;
    }
    
    // 2. Liste des CAPEX à marquer comme payés
    const paidKeywords = ['kuroiler', 'poulets locaux', 'equipements', 'cloture', 'fonds de roulement'];
    
    let created = 0;
    let marked = 0;
    
    for (const exp of expenses) {
      const desc = exp.description || '';
      const amount = parseFloat(exp.amount || 0);
      const category = exp.category || 'Autre';
      
      // Vérifier si doit être marqué comme payé
      const shouldBePaid = paidKeywords.some(keyword => 
        desc.toLowerCase().includes(keyword)
      );
      
      // Insérer
      await client.query(`
        INSERT INTO project_expense_lines (
          project_id,
          description,
          category,
          projected_amount,
          actual_amount,
          transaction_date,
          is_paid,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        24,
        desc,
        category,
        amount,
        shouldBePaid ? amount : 0,
        null,
        shouldBePaid
      ]);
      
      created++;
      if (shouldBePaid) {
        marked++;
        console.log('[PAYE] ' + desc + ' - ' + amount.toLocaleString() + ' Ar');
      } else {
        console.log('[A PAYER] ' + desc + ' - ' + amount.toLocaleString() + ' Ar');
      }
    }
    
    // 3. Recalculer
    const totalResult = await client.query(`
      SELECT 
        SUM(projected_amount) as total,
        SUM(actual_amount) as paid
      FROM project_expense_lines
      WHERE project_id = 24
    `);
    
    const total = parseFloat(totalResult.rows[0].total);
    const paid = parseFloat(totalResult.rows[0].paid);
    const remaining = total - paid;
    
    await client.query(
      'UPDATE projects SET remaining_budget = $1 WHERE id = 24',
      [remaining]
    );
    
    await client.query('COMMIT');
    
    console.log('\n='.repeat(60));
    console.log('\nSUCCES !');
    console.log('\nLignes creees: ' + created);
    console.log('Marquees comme payees: ' + marked);
    console.log('\nBudget total: ' + total.toLocaleString() + ' Ar');
    console.log('Deja paye: ' + paid.toLocaleString() + ' Ar');
    console.log('Restant: ' + remaining.toLocaleString() + ' Ar');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

syncNatioraExpenses();
