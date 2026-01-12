// scripts/integrate-tx-632-to-nemo.js
const pool = require('../config/database');

async function integrateTx632ToNemo() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🔍 Recherche de la transaction #632...\n');
    
    // 1. Récupérer la transaction #632
    const txResult = await client.query(
      'SELECT * FROM transactions WHERE id = 632'
    );
    
    if (txResult.rows.length === 0) {
      throw new Error('Transaction #632 introuvable');
    }
    
    const tx = txResult.rows[0];
    console.log('✅ Transaction trouvée:');
    console.log(`   ID: ${tx.id}`);
    console.log(`   Description: "${tx.description}"`);
    console.log(`   Montant: ${parseFloat(tx.amount).toLocaleString()} Ar`);
    console.log(`   Date: ${tx.transaction_date.toISOString().split('T')[0]}`);
    console.log(`   Compte: ${tx.account_id} (Argent Liquide)`);
    
    // 2. Rechercher le projet NEMO EXPORT
    const projectResult = await client.query(`
      SELECT id, name, type, status
      FROM projects
      WHERE name ILIKE '%NEMO%EXPORT%' OR id = 27
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (projectResult.rows.length === 0) {
      throw new Error('Projet NEMO EXPORT introuvable');
    }
    
    const project = projectResult.rows[0];
    console.log('\n✅ Projet trouvé:');
    console.log(`   ID: ${project.id}`);
    console.log(`   Nom: "${project.name}"`);
    console.log(`   Type: ${project.type}`);
    console.log(`   Statut: ${project.status}`);
    
    // 3. Vérifier si une ligne existe déjà
    const existingLineResult = await client.query(`
      SELECT id FROM project_expense_lines
      WHERE project_id = $1 
        AND transaction_id = $2
    `, [project.id, tx.id]);
    
    let lineId;
    
    if (existingLineResult.rows.length > 0) {
      // Ligne existe déjà
      lineId = existingLineResult.rows[0].id;
      console.log(`\n⚠️  Ligne existante trouvée: ID ${lineId}, mise à jour...`);
      
      await client.query(`
        UPDATE project_expense_lines
        SET 
          description = $1,
          category = $2,
          projected_amount = $3,
          actual_amount = $4,
          transaction_date = $5,
          is_paid = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        tx.description,
        tx.category || 'Projet - Dépense',
        parseFloat(tx.amount),
        parseFloat(tx.amount),
        tx.transaction_date,
        true,
        lineId
      ]);
      
      console.log('✅ Ligne de dépense mise à jour');
      
    } else {
      // Créer nouvelle ligne
      const lineResult = await client.query(`
        INSERT INTO project_expense_lines (
          project_id,
          description,
          category,
          projected_amount,
          actual_amount,
          transaction_date,
          is_paid,
          transaction_id,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `, [
        project.id,
        tx.description,
        tx.category || 'Projet - Dépense',
        parseFloat(tx.amount),
        parseFloat(tx.amount),
        tx.transaction_date,
        true,
        tx.id
      ]);
      
      lineId = lineResult.rows[0].id;
      console.log(`\n✅ Ligne de dépense créée: ID ${lineId}`);
    }
    
    console.log(`   Description: "${tx.description}"`);
    console.log(`   Montant projeté: ${parseFloat(tx.amount).toLocaleString()} Ar`);
    console.log(`   Montant réel: ${parseFloat(tx.amount).toLocaleString()} Ar`);
    console.log(`   Statut: PAYÉ ✓`);
    
    // 4. Mettre à jour la transaction pour lier au projet
    await client.query(
      `UPDATE transactions 
       SET project_id = $1, 
           project_line_id = $2::text,
           updated_at = NOW()
       WHERE id = $3`,
      [project.id, lineId, tx.id]
    );
    
    console.log(`\n✅ Transaction #632 liée au projet NEMO EXPORT`);
    console.log(`   project_id: ${project.id}`);
    console.log(`   project_line_id: ${lineId}`);
    
    // 5. Recalculer les totaux du projet (CORRIGÉ)
    const totalsResult = await client.query(`
      SELECT 
        COALESCE(SUM(projected_amount), 0)::numeric as total_expenses,
        COALESCE(SUM(actual_amount), 0)::numeric as total_actual,
        COUNT(*) as expense_count,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_count
      FROM project_expense_lines
      WHERE project_id = $1
    `, [project.id]);
    
    const expenseTotals = totalsResult.rows[0];
    
    // Calculer les revenus
    const revenuesResult = await client.query(`
      SELECT COALESCE(SUM(projected_amount), 0)::numeric as total_revenues
      FROM project_revenue_lines
      WHERE project_id = $1
    `, [project.id]);
    
    const totalRevenues = parseFloat(revenuesResult.rows[0].total_revenues) || 0;
    const totalCost = parseFloat(expenseTotals.total_expenses) || 0;
    const totalActual = parseFloat(expenseTotals.total_actual) || 0;
    const netProfit = totalRevenues - totalCost;
    const roi = totalCost > 0 ? parseFloat(((netProfit / totalCost) * 100).toFixed(2)) : 0;
    const remainingBudget = totalCost - totalActual;
    
    await client.query(`
      UPDATE projects
      SET 
        total_cost = $1,
        total_revenues = $2,
        net_profit = $3,
        roi = $4,
        remaining_budget = $5,
        updated_at = NOW()
      WHERE id = $6
    `, [
      totalCost,
      totalRevenues,
      netProfit,
      roi,
      remainingBudget,
      project.id
    ]);
    
    console.log(`\n📊 Totaux du projet mis à jour:`);
    console.log(`   Total coût: ${totalCost.toLocaleString()} Ar`);
    console.log(`   Total revenus: ${totalRevenues.toLocaleString()} Ar`);
    console.log(`   Profit net: ${netProfit.toLocaleString()} Ar`);
    console.log(`   ROI: ${roi}%`);
    console.log(`   Budget restant: ${remainingBudget.toLocaleString()} Ar`);
    console.log(`   Dépenses: ${expenseTotals.expense_count} (${expenseTotals.paid_count} payées)`);
    
    await client.query('COMMIT');
    
    console.log('\n✅ ✅ ✅ INTÉGRATION TERMINÉE AVEC SUCCÈS ! ✅ ✅ ✅');
    console.log('\n📝 Résumé:');
    console.log(`   • Transaction #632 → Projet "${project.name}" (ID: ${project.id})`);
    console.log(`   • Ligne de dépense: ${lineId}`);
    console.log(`   • Statut: PAYÉ (déjà déduit du compte Argent Liquide)`);
    console.log(`   • Montant: ${parseFloat(tx.amount).toLocaleString()} Ar`);
    console.log('\n💡 La transaction apparaît maintenant dans le projet NEMO EXPORT #001');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
    console.error('\n🔍 Détails:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

integrateTx632ToNemo();
