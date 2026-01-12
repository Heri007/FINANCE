// scripts/integrate-natiora-opex-capex.js
const pool = require('../config/database');

async function integrateNatioraOpexCapex() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Integration NATIORA - OPEX & CAPEX\n');
    console.log('='.repeat(60) + '\n');
    
    // 1. Recuperer le projet Natiora
    const projectResult = await client.query(`
      SELECT id, name, start_date, end_date
      FROM projects
      WHERE name ILIKE '%Natiora%' OR id = 24
      LIMIT 1
    `);
    
    if (projectResult.rows.length === 0) {
      throw new Error('Projet Natiora introuvable');
    }
    
    const project = projectResult.rows[0];
    console.log('Projet trouve:');
    console.log('   ID: ' + project.id);
    console.log('   Nom: "' + project.name + '"');
    console.log('   Debut: ' + (project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : 'N/A'));
    console.log('   Fin: ' + (project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : 'N/A') + '\n');
    
    // 2. MARQUER COMME PAYE les elements deja soustraits
    console.log('ETAPE 1: Marquage des depenses deja payees...\n');
    
    const paidItems = [
      { desc: 'Batiment Kuroiler', amount: 2000000 },
      { desc: 'Batiment Poulets locaux', amount: 1785000 },
      { desc: 'Equipements durables', amount: 1200000 },
      { desc: 'Cloture et securite site Bypass', amount: 300000 },
      { desc: 'Fonds de roulement initial', amount: 500000 }
    ];
    
    let totalMarked = 0;
    
    for (const item of paidItems) {
      const updateResult = await client.query(`
        UPDATE project_expense_lines
        SET 
          is_paid = true,
          actual_amount = projected_amount
        WHERE project_id = $1
          AND description ILIKE $2
          AND projected_amount = $3
        RETURNING id, description, projected_amount
      `, [project.id, '%' + item.desc + '%', item.amount]);
      
      if (updateResult.rows.length > 0) {
        const line = updateResult.rows[0];
        console.log('   Marque PAYE: ' + line.description);
        console.log('      ID: ' + line.id + ' | Montant: ' + parseFloat(line.projected_amount).toLocaleString() + ' Ar\n');
        totalMarked += parseFloat(line.projected_amount);
      } else {
        console.log('   Non trouve: ' + item.desc + ' (' + item.amount.toLocaleString() + ' Ar)\n');
      }
    }
    
    console.log('Total marque comme paye: ' + totalMarked.toLocaleString() + ' Ar\n');
    console.log('-'.repeat(60) + '\n');
    
    // 3. AJOUTER DES DATES AUX OPEX RECURRENTS
    console.log('ETAPE 2: Attribution de dates aux OPEX recurrents...\n');
    
    // A. Poulets de chair - 8 cycles/an (tous les 45 jours)
    console.log('Poulets de chair - 8 cycles:\n');
    
    const pouletCycles = [
      { date: '2026-02-15', cycle: 1 },
      { date: '2026-04-01', cycle: 2 },
      { date: '2026-05-16', cycle: 3 },
      { date: '2026-06-30', cycle: 4 },
      { date: '2026-08-14', cycle: 5 },
      { date: '2026-09-28', cycle: 6 },
      { date: '2026-11-12', cycle: 7 },
      { date: '2026-12-27', cycle: 8 }
    ];
    
    for (const cycle of pouletCycles) {
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
        project.id,
        'Poulets Chair Cycle ' + cycle.cycle + '/8 - Poussins + Provende',
        'OPEX Recurrent',
        7162800,
        0,
        cycle.date,
        false
      ]);
      
      console.log('   Cycle ' + cycle.cycle + ': ' + cycle.date + ' -> 7,162,800 Ar');
    }
    
    // B. Oies - 4 cycles/an
    console.log('\nOies - 4 cycles:\n');
    
    const oieCycles = [
      { date: '2026-03-15', cycle: 1 },
      { date: '2026-06-07', cycle: 2 },
      { date: '2026-08-30', cycle: 3 },
      { date: '2026-11-22', cycle: 4 }
    ];
    
    for (const cycle of oieCycles) {
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
        project.id,
        'Oies Cycle ' + cycle.cycle + '/4 - Oisons + Provende + Vitamines',
        'OPEX Recurrent',
        9710000,
        0,
        cycle.date,
        false
      ]);
      
      console.log('   Cycle ' + cycle.cycle + ': ' + cycle.date + ' -> 9,710,000 Ar');
    }
    
    // C. Salaires - Mensuels
    console.log('\nSalaires mensuels (300,000 Ar/mois):\n');
    
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const monthNames = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 
                        'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthName = monthNames[i];
      const salaryDate = '2026-' + String(month).padStart(2, '0') + '-28';
      
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
        project.id,
        'Salaires ' + monthName + ' 2026',
        'Salaires',
        300000,
        0,
        salaryDate,
        false
      ]);
      
      if (month <= 3 || month === 12) {
        console.log('   ' + monthName + ': ' + salaryDate + ' -> 300,000 Ar');
      }
    }
    console.log('   ... (12 mois au total)');
    
    // D. Loyer + Charges - Mensuels
    console.log('\nLoyer + Charges mensuels (166,667 Ar/mois):\n');
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthName = monthNames[i];
      const rentDate = '2026-' + String(month).padStart(2, '0') + '-05';
      
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
        project.id,
        'Loyer + Charges ' + monthName + ' 2026',
        'Loyer & frais',
        166667,
        0,
        rentDate,
        false
      ]);
      
      if (month <= 3 || month === 12) {
        console.log('   ' + monthName + ': ' + rentDate + ' -> 166,667 Ar');
      }
    }
    console.log('   ... (12 mois au total)');
    
    // 4. REVENUS PREVISIONNELS
    console.log('\n' + '-'.repeat(60));
    console.log('\nETAPE 3: Attribution de dates aux revenus...\n');
    
    // A. Ventes Poulets - 8 cycles
    console.log('Ventes Poulets de chair - 8 cycles:\n');
    
    const pouletSales = [
      { date: '2026-02-20', cycle: 1 },
      { date: '2026-04-06', cycle: 2 },
      { date: '2026-05-21', cycle: 3 },
      { date: '2026-07-05', cycle: 4 },
      { date: '2026-08-19', cycle: 5 },
      { date: '2026-10-03', cycle: 6 },
      { date: '2026-11-17', cycle: 7 },
      { date: '2026-12-31', cycle: 8 }
    ];
    
    for (const sale of pouletSales) {
      await client.query(`
        INSERT INTO project_revenue_lines (
          project_id,
          description,
          category,
          projected_amount,
          actual_amount,
          transaction_date,
          is_received,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        project.id,
        'Vente Poulets Cycle ' + sale.cycle + '/8',
        'Ventes Poulets',
        12000000,
        0,
        sale.date,
        false
      ]);
      
      console.log('   Cycle ' + sale.cycle + ': ' + sale.date + ' -> 12,000,000 Ar');
    }
    
    // B. Ventes Oies - 4 cycles
    console.log('\nVentes Oies - 4 cycles:\n');
    
    const oieSales = [
      { date: '2026-03-20', cycle: 1 },
      { date: '2026-06-12', cycle: 2 },
      { date: '2026-09-04', cycle: 3 },
      { date: '2026-11-27', cycle: 4 }
    ];
    
    for (const sale of oieSales) {
      await client.query(`
        INSERT INTO project_revenue_lines (
          project_id,
          description,
          category,
          projected_amount,
          actual_amount,
          transaction_date,
          is_received,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        project.id,
        'Vente Oies Cycle ' + sale.cycle + '/4',
        'Ventes Oies',
        14725000,
        0,
        sale.date,
        false
      ]);
      
      console.log('   Cycle ' + sale.cycle + ': ' + sale.date + ' -> 14,725,000 Ar');
    }
    
    // C. Kuroiler - Mensuel
    console.log('\nMarge Kuroiler - Mensuelle:\n');
    
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthName = monthNames[i];
      const kuroilerDate = '2026-' + String(month).padStart(2, '0') + '-15';
      
      await client.query(`
        INSERT INTO project_revenue_lines (
          project_id,
          description,
          category,
          projected_amount,
          actual_amount,
          transaction_date,
          is_received,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        project.id,
        'Vente Kuroiler ' + monthName + ' 2026',
        'Ventes Kuroiler',
        266250,
        0,
        kuroilerDate,
        false
      ]);
      
      if (month <= 3 || month === 12) {
        console.log('   ' + monthName + ': ' + kuroilerDate + ' -> 266,250 Ar');
      }
    }
    console.log('   ... (12 mois au total)');
    
    // 5. Recalculer les totaux du projet
    console.log('\n' + '-'.repeat(60));
    console.log('\nRECALCUL DES TOTAUX...\n');
    
    const expenseResult = await client.query(`
      SELECT 
        COALESCE(SUM(projected_amount), 0) as total_expenses,
        COALESCE(SUM(actual_amount), 0) as total_actual,
        COUNT(*) as expense_count,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_count
      FROM project_expense_lines
      WHERE project_id = $1
    `, [project.id]);
    
    const revenueResult = await client.query(`
      SELECT 
        COALESCE(SUM(projected_amount), 0) as total_revenues,
        COALESCE(SUM(actual_amount), 0) as total_actual,
        COUNT(*) as revenue_count,
        COUNT(*) FILTER (WHERE is_received = true) as received_count
      FROM project_revenue_lines
      WHERE project_id = $1
    `, [project.id]);
    
    const expenseTotals = expenseResult.rows[0];
    const revenueTotals = revenueResult.rows[0];
    
    const totalCost = parseFloat(expenseTotals.total_expenses) || 0;
    const totalRevenues = parseFloat(revenueTotals.total_revenues) || 0;
    const totalPaid = parseFloat(expenseTotals.total_actual) || 0;
    const netProfit = totalRevenues - totalCost;
    const roi = totalCost > 0 ? parseFloat(((netProfit / totalCost) * 100).toFixed(2)) : 0;
    const remainingBudget = totalCost - totalPaid;
    
    console.log('💰 Calculs:');
    console.log(`   Total dépenses: ${totalCost.toLocaleString()} Ar`);
    console.log(`   Total revenus: ${totalRevenues.toLocaleString()} Ar`);
    console.log(`   Déjà payé: ${totalPaid.toLocaleString()} Ar`);
    console.log(`   Budget restant: ${remainingBudget.toLocaleString()} Ar`);
    console.log(`   Profit net: ${netProfit.toLocaleString()} Ar`);
    console.log(`   ROI: ${roi}%`);
    
    // 6. Mettre à jour le projet
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
    `, [totalCost, totalRevenues, netProfit, roi, remainingBudget, project.id]);
    
    await client.query('COMMIT');
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ ✅ ✅ INTÉGRATION TERMINÉE AVEC SUCCÈS ! ✅ ✅ ✅\n');
    console.log('📊 RÉSUMÉ FINAL:\n');
    console.log(`   Projet: ${project.name}`);
    console.log(`   Total dépenses: ${expenseTotals.expense_count} lignes (${expenseTotals.paid_count} payées)`);
    console.log(`   Total revenus: ${revenueTotals.revenue_count} lignes`);
    console.log(`   Budget total: ${totalCost.toLocaleString()} Ar`);
    console.log(`   Revenus prévus: ${totalRevenues.toLocaleString()} Ar`);
    console.log(`   Profit net: ${netProfit.toLocaleString()} Ar`);
    console.log(`   ROI: ${roi}%`);
    console.log(`\n💡 Timeline mis à jour avec:`);
    console.log(`   • 8 cycles de poulets de chair`);
    console.log(`   • 4 cycles d'oies`);
    console.log(`   • 12 mois de salaires`);
    console.log(`   • 12 mois de loyer/charges`);
    console.log(`   • 12 mois de ventes Kuroiler`);
    console.log(`   • 5 CAPEX marqués comme payés`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
    console.error('\n🔍 Stack:', error.stack);
  } finally {
    client.release();
    process.exit(0);
  }
}

integrateNatioraOpexCapex();