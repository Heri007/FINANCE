// scripts/generate-financial-report.js
const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function generateFinancialReport() {
  const reportDate = new Date().toLocaleString('fr-FR');
  const fileName = `bilan_financier_${Date.now()}.txt`;
  const filePath = path.join(__dirname, '..', 'reports', fileName);

  // Créer le dossier reports s'il n'existe pas
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }

  let report = '';

  // En-tête
  report += '╔' + '═'.repeat(118) + '╗\n';
  report += '║' + ' '.repeat(40) + '💰 BILAN FINANCIER COMPLET' + ' '.repeat(52) + '║\n';
  report += '║' + ' '.repeat(45) + `Généré le: ${reportDate}` + ' '.repeat(118 - 45 - `Généré le: ${reportDate}`.length) + '║\n';
  report += '╚' + '═'.repeat(118) + '╝\n\n';

  try {
    console.log('✅ Connecté à PostgreSQL\n');

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 1: RÉSUMÉ GLOBAL
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📊 RÉSUMÉ GLOBAL' + ' '.repeat(101) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    const accountsResult = await pool.query(`
      SELECT 
        id, 
        name, 
        balance, 
        type,
        created_at,
        updated_at
      FROM accounts 
      ORDER BY id ASC
    `);

    const globalStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT account_id) as total_accounts,
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_transactions,
        COUNT(CASE WHEN is_planned = true AND is_posted = false THEN 1 END) as planned_transactions,
        COALESCE(SUM(CASE WHEN type = 'income' AND is_posted = true THEN amount ELSE 0 END), 0) as global_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND is_posted = true THEN amount ELSE 0 END), 0) as global_expense
      FROM transactions
    `);

    const global = globalStats.rows[0];
    const totalBalance = accountsResult.rows.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
    const netGlobal = parseFloat(global.global_income) - parseFloat(global.global_expense);

    report += `   💼 Nombre de comptes actifs: ${accountsResult.rows.length}\n`;
    report += `   📊 Total transactions: ${global.total_transactions} (${global.posted_transactions} postées, ${global.planned_transactions} planifiées)\n`;
    report += `   💰 Solde total de tous les comptes: ${totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;
    
    report += `   💵 Total des revenus: ${parseFloat(global.global_income).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
    report += `   💸 Total des dépenses: ${parseFloat(global.global_expense).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
    report += `   📈 Résultat net: ${netGlobal >= 0 ? '+' : ''}${netGlobal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;

    const diff = totalBalance - netGlobal;
    report += `   🔍 Vérification de cohérence: ${Math.abs(diff) < 0.01 ? '✅ Cohérent' : '❌ INCOHÉRENT'}\n`;
    if (Math.abs(diff) >= 0.01) {
      report += `      ⚠️ Écart détecté: ${diff.toFixed(2)} Ar\n`;
    }
    report += '\n\n';

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 2: DÉTAIL PAR TYPE DE COMPTE
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '┌' + '─'.repeat(118) + '┐\n';
    report += '│ 🏦 RÉPARTITION PAR TYPE DE COMPTE' + ' '.repeat(84) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    const typeStats = await pool.query(`
      SELECT 
        a.type,
        COUNT(a.id) as account_count,
        COALESCE(SUM(a.balance), 0) as total_balance,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.is_posted = true THEN t.amount ELSE 0 END), 0) as type_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.is_posted = true THEN t.amount ELSE 0 END), 0) as type_expense
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.type
      ORDER BY total_balance DESC
    `);

    const typeNames = {
      'cash': '💵 Argent Liquide',
      'mobile': '📱 Mobile Money',
      'bank': '🏦 Banque',
      'digital': '💳 Digital',
      'credit': '📋 Avoir/Crédit'
    };

    for (const type of typeStats.rows) {
      const typeName = typeNames[type.type] || type.type;
      const balance = parseFloat(type.total_balance);
      const income = parseFloat(type.type_income);
      const expense = parseFloat(type.type_expense);
      const net = income - expense;

      report += `   ${typeName}\n`;
      report += `      └─ Comptes: ${type.account_count}\n`;
      report += `      └─ Solde total: ${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `      └─ Transactions: ${type.transaction_count}\n`;
      report += `      └─ Revenus: ${income.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `      └─ Dépenses: ${expense.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `      └─ Net: ${net >= 0 ? '+' : ''}${net.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;
    }
    report += '\n';

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 3: DÉTAIL DE CHAQUE COMPTE
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📋 DÉTAIL DE CHAQUE COMPTE' + ' '.repeat(91) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    for (const account of accountsResult.rows) {
      report += '   ' + '━'.repeat(115) + '\n';
      report += `   🏦 ${account.name.toUpperCase()} (ID: ${account.id})\n`;
      report += '   ' + '━'.repeat(115) + '\n\n';
      
      report += `      Type: ${account.type}\n`;
      report += `      Créé le: ${new Date(account.created_at).toLocaleString('fr-FR')}\n`;
      report += `      Dernière mise à jour: ${new Date(account.updated_at).toLocaleString('fr-FR')}\n\n`;
      
      const currentBalance = parseFloat(account.balance);
      report += `      💰 Solde actuel: ${currentBalance >= 0 ? '✅' : '❌'} ${currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;

      // Statistiques des transactions
      const statsResult = await pool.query(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_transactions,
          COUNT(CASE WHEN is_planned = true AND is_posted = false THEN 1 END) as planned_transactions,
          COUNT(CASE WHEN type = 'income' AND is_posted = true THEN 1 END) as income_count,
          COUNT(CASE WHEN type = 'expense' AND is_posted = true THEN 1 END) as expense_count,
          COALESCE(SUM(CASE WHEN type = 'income' AND is_posted = true THEN amount ELSE 0 END), 0) as total_income,
          COALESCE(SUM(CASE WHEN type = 'expense' AND is_posted = true THEN amount ELSE 0 END), 0) as total_expense,
          MIN(transaction_date) as first_transaction,
          MAX(transaction_date) as last_transaction
        FROM transactions
        WHERE account_id = $1
      `, [account.id]);

      const stats = statsResult.rows[0];
      
      report += `      📊 STATISTIQUES:\n`;
      report += `         Total transactions: ${stats.total_transactions}\n`;
      report += `         ✅ Postées: ${stats.posted_transactions}\n`;
      report += `         ⏳ Planifiées: ${stats.planned_transactions}\n\n`;
      
      if (stats.total_transactions > 0) {
        report += `         💵 Revenus: ${stats.income_count} transactions → ${parseFloat(stats.total_income).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         💸 Dépenses: ${stats.expense_count} transactions → ${parseFloat(stats.total_expense).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        
        const netAmount = parseFloat(stats.total_income) - parseFloat(stats.total_expense);
        report += `         📈 Net: ${netAmount >= 0 ? '+' : ''}${netAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;
        
        if (stats.first_transaction && stats.last_transaction) {
          const firstDate = new Date(stats.first_transaction).toLocaleDateString('fr-FR');
          const lastDate = new Date(stats.last_transaction).toLocaleDateString('fr-FR');
          report += `         📅 Période: ${firstDate} → ${lastDate}\n`;
          
          const daysDiff = Math.floor((new Date(stats.last_transaction) - new Date(stats.first_transaction)) / (1000 * 60 * 60 * 24));
          report += `         ⏱️ Durée: ${daysDiff} jours\n`;
          
          if (daysDiff > 0) {
            const avgPerDay = netAmount / daysDiff;
            report += `         📊 Moyenne par jour: ${avgPerDay >= 0 ? '+' : ''}${avgPerDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar/jour\n`;
          }
        }
      }

      // Vérification de cohérence
      const recalcResult = await pool.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as calculated_balance
        FROM transactions
        WHERE account_id = $1 AND is_posted = true
      `, [account.id]);

      const calculatedBalance = parseFloat(recalcResult.rows[0].calculated_balance);
      const difference = currentBalance - calculatedBalance;

      report += `\n      🔍 VÉRIFICATION:\n`;
      report += `         Solde en base: ${currentBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `         Solde recalculé: ${calculatedBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      
      if (Math.abs(difference) < 0.01) {
        report += `         ✅ Cohérent (écart: ${difference.toFixed(2)} Ar)\n`;
      } else {
        report += `         ❌ INCOHÉRENT ! Écart: ${difference.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      }

      // Top 10 des transactions récentes
      const recentTransactions = await pool.query(`
        SELECT 
          id,
          type,
          amount,
          category,
          description,
          transaction_date,
          is_posted,
          is_planned,
          created_at
        FROM transactions
        WHERE account_id = $1
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT 10
      `, [account.id]);

      if (recentTransactions.rows.length > 0) {
        report += `\n      📝 TOP 10 DES TRANSACTIONS RÉCENTES:\n\n`;
        recentTransactions.rows.forEach((trx, index) => {
          const date = new Date(trx.transaction_date).toLocaleDateString('fr-FR');
          const sign = trx.type === 'income' ? '+' : '-';
          const status = trx.is_posted ? '✅' : (trx.is_planned ? '⏳' : '❓');
                    const amount = parseFloat(trx.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
          
          report += `         ${index + 1}. ${status} ${date} - ${trx.category}\n`;
          report += `            ${sign}${amount} Ar\n`;
          report += `            ${trx.description.substring(0, 80)}${trx.description.length > 80 ? '...' : ''}\n\n`;
        });
      }

      report += '\n';
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 4: ANALYSE PAR CATÉGORIE
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📊 ANALYSE PAR CATÉGORIE' + ' '.repeat(93) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    // Catégories de revenus
    const incomeCategoriesResult = await pool.query(`
      SELECT 
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE type = 'income' AND is_posted = true
      GROUP BY category
      ORDER BY total_amount DESC
    `);

    report += `   💵 CATÉGORIES DE REVENUS (Top 10):\n\n`;
    if (incomeCategoriesResult.rows.length === 0) {
      report += `      ℹ️ Aucune catégorie de revenus\n\n`;
    } else {
      incomeCategoriesResult.rows.slice(0, 10).forEach((cat, index) => {
        const total = parseFloat(cat.total_amount);
        const avg = parseFloat(cat.avg_amount);
        const percentage = (total / parseFloat(global.global_income) * 100).toFixed(2);
        
        report += `      ${index + 1}. ${cat.category}\n`;
        report += `         └─ Transactions: ${cat.transaction_count}\n`;
        report += `         └─ Total: ${total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${percentage}%)\n`;
        report += `         └─ Moyenne: ${avg.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         └─ Min/Max: ${parseFloat(cat.min_amount).toLocaleString('fr-FR')} / ${parseFloat(cat.max_amount).toLocaleString('fr-FR')} Ar\n\n`;
      });
    }

    // Catégories de dépenses
    const expenseCategoriesResult = await pool.query(`
      SELECT 
        category,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM transactions
      WHERE type = 'expense' AND is_posted = true
      GROUP BY category
      ORDER BY total_amount DESC
    `);

    report += `\n   💸 CATÉGORIES DE DÉPENSES (Top 10):\n\n`;
    if (expenseCategoriesResult.rows.length === 0) {
      report += `      ℹ️ Aucune catégorie de dépenses\n\n`;
    } else {
      expenseCategoriesResult.rows.slice(0, 10).forEach((cat, index) => {
        const total = parseFloat(cat.total_amount);
        const avg = parseFloat(cat.avg_amount);
        const percentage = (total / parseFloat(global.global_expense) * 100).toFixed(2);
        
        report += `      ${index + 1}. ${cat.category}\n`;
        report += `         └─ Transactions: ${cat.transaction_count}\n`;
        report += `         └─ Total: ${total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${percentage}%)\n`;
        report += `         └─ Moyenne: ${avg.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         └─ Min/Max: ${parseFloat(cat.min_amount).toLocaleString('fr-FR')} / ${parseFloat(cat.max_amount).toLocaleString('fr-FR')} Ar\n\n`;
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 5: PROJETS
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📁 PROJETS' + ' '.repeat(107) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    const projectsResult = await pool.query(`
      SELECT 
        id,
        name,
        type,
        status,
        start_date,
        end_date,
        created_at
      FROM projects
      ORDER BY created_at DESC
    `);

    if (projectsResult.rows.length === 0) {
      report += `   ℹ️ Aucun projet enregistré\n\n`;
    } else {
      report += `   📊 Total: ${projectsResult.rows.length} projet(s)\n\n`;

      for (const project of projectsResult.rows) {
        report += `   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `   📁 ${project.name.toUpperCase()} (ID: ${project.id})\n`;
        report += `   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        report += `      Type: ${project.type}\n`;
        report += `      Statut: ${project.status}\n`;
        
        if (project.start_date) {
          report += `      Date de début: ${new Date(project.start_date).toLocaleDateString('fr-FR')}\n`;
        }
        if (project.end_date) {
          report += `      Date de fin: ${new Date(project.end_date).toLocaleDateString('fr-FR')}\n`;
        }

        let expensesStats;
        let expensesByCategoryResult;
        try {
          const expensesStatsResult = await pool.query(`
            SELECT 
              COUNT(*) as total_lines,
              COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_lines,
              COALESCE(SUM(projected_amount), 0) as total_projected,
              COALESCE(SUM(actual_amount), 0) as total_actual,
              COALESCE(SUM(CASE WHEN is_paid = true THEN actual_amount ELSE 0 END), 0) as total_paid
            FROM project_expense_lines
            WHERE project_id = $1
          `, [project.id]);

          expensesByCategoryResult = await pool.query(`
            SELECT 
              category,
              COALESCE(SUM(projected_amount),0) as total_projected,
              COALESCE(SUM(actual_amount),0) as total_actual,
              COALESCE(SUM(CASE WHEN is_paid = true THEN actual_amount ELSE 0 END),0) as total_paid,
              COUNT(*) as line_count,
              COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_count
            FROM project_expense_lines
            WHERE project_id = $1
            GROUP BY category
            ORDER BY total_actual DESC
          `, [project.id]);

          expensesStats = expensesStatsResult.rows[0];
        } catch (err) {
          // Fallback when no dedicated expense lines table exists: parse `expenses` JSON from the `projects` row
          if (err && String(err.message).includes('does not exist')) {
            const projFull = await pool.query(`SELECT expenses FROM projects WHERE id = $1`, [project.id]);
            const rawExpenses = projFull.rows[0] ? (projFull.rows[0].expenses || projFull.rows[0].expenses_json || '[]') : '[]';
            let expenseLines = [];
            try {
              expenseLines = typeof rawExpenses === 'string' ? JSON.parse(rawExpenses) : rawExpenses || [];
            } catch (e) {
              expenseLines = [];
            }

            const total_lines = expenseLines.length;
            const paid_lines = expenseLines.filter(l => l && (l.isPaid === true || l.is_paid === true)).length;
            const total_actual = expenseLines.reduce((s, e) => s + (parseFloat(e?.amount) || 0), 0);
            const total_projected = total_actual;
            const total_paid = expenseLines.filter(l => l && (l.isPaid === true || l.is_paid === true)).reduce((s, e) => s + (parseFloat(e?.amount) || 0), 0);

            expensesStats = {
              total_lines,
              paid_lines,
              total_projected,
              total_actual,
              total_paid
            };

            const byCat = {};
            for (const e of expenseLines) {
              const cat = (e && (e.category || e.cat)) || 'Autre';
              const amt = parseFloat(e?.amount) || 0;
              if (!byCat[cat]) byCat[cat] = { category: cat, total_projected: 0, total_actual: 0, total_paid: 0, line_count: 0, paid_count: 0 };
              byCat[cat].total_actual += amt;
              byCat[cat].total_projected += amt;
              byCat[cat].line_count += 1;
              if (e && (e.isPaid === true || e.is_paid === true)) { byCat[cat].paid_count += 1; byCat[cat].total_paid += amt; }
            }

            expensesByCategoryResult = { rows: Object.values(byCat) };
          } else {
            throw err;
          }
        }

        // Récupérer les statistiques de revenus du projet
        let revenuesStats;
        let revenuesByCategoryResult;
        try {
          const revenuesStatsResult = await pool.query(`
            SELECT 
              COUNT(*) as total_lines,
              COUNT(CASE WHEN is_received = true THEN 1 END) as received_lines,
              COALESCE(SUM(projected_amount), 0) as total_projected,
              COALESCE(SUM(actual_amount), 0) as total_actual,
              COALESCE(SUM(CASE WHEN is_received = true THEN actual_amount ELSE 0 END), 0) as total_received
            FROM project_revenue_lines
            WHERE project_id = $1
          `, [project.id]);

          revenuesByCategoryResult = await pool.query(`
            SELECT 
              category,
              SUM(projected_amount) as total_projected,
              SUM(actual_amount) as total_actual,
              SUM(CASE WHEN is_received = true THEN actual_amount ELSE 0 END) as total_received,
              COUNT(*) as line_count,
              COUNT(CASE WHEN is_received = true THEN 1 END) as received_count
            FROM project_revenue_lines
            WHERE project_id = $1
            GROUP BY category
            ORDER BY total_actual DESC
          `, [project.id]);

          revenuesStats = revenuesStatsResult.rows[0];
        } catch (err) {
          if (err && String(err.message).includes('does not exist')) {
            const projFullRev = await pool.query(`SELECT revenues FROM projects WHERE id = $1`, [project.id]);
            const rawRevenues = projFullRev.rows[0] ? (projFullRev.rows[0].revenues || projFullRev.rows[0].revenues_json || '[]') : '[]';
            let revenueLines = [];
            try {
              revenueLines = typeof rawRevenues === 'string' ? JSON.parse(rawRevenues) : rawRevenues || [];
            } catch (e) { revenueLines = []; }

            const total_lines = revenueLines.length;
            const received_lines = revenueLines.filter(l => l && (l.isReceived === true || l.is_received === true)).length;
            const total_actual = revenueLines.reduce((s, r) => s + (parseFloat(r?.amount) || 0), 0);
            const total_projected = total_actual;
            const total_received = revenueLines.filter(l => l && (l.isReceived === true || l.is_received === true)).reduce((s, r) => s + (parseFloat(r?.amount) || 0), 0);

            revenuesStats = { total_lines, received_lines, total_projected, total_actual, total_received };

            const byCat = {};
            for (const r of revenueLines) {
              const cat = (r && (r.category || r.cat)) || 'Autre';
              const amt = parseFloat(r?.amount) || 0;
              if (!byCat[cat]) byCat[cat] = { category: cat, total_projected: 0, total_actual: 0, total_received: 0, line_count: 0, received_count: 0 };
              byCat[cat].total_actual += amt;
              byCat[cat].total_projected += amt;
              byCat[cat].line_count += 1;
              if (r && (r.isReceived === true || r.is_received === true)) { byCat[cat].received_count += 1; byCat[cat].total_received += amt; }
            }

            revenuesByCategoryResult = { rows: Object.values(byCat) };
          } else {
            throw err;
          }
        }

        const totalExpenses = parseFloat(expensesStats.total_actual);
        const totalRevenues = parseFloat(revenuesStats.total_actual);
        const netProject = totalRevenues - totalExpenses;

        report += `\n      💰 FINANCES:\n`;
        report += `         Dépenses: ${totalExpenses.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${expensesStats.paid_lines}/${expensesStats.total_lines} payées)\n`;
        report += `         Revenus: ${totalRevenues.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar (${revenuesStats.received_lines}/${revenuesStats.total_lines} reçues)\n`;
        report += `         Résultat net: ${netProject >= 0 ? '+' : ''}${netProject.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;

        
        if (expensesByCategoryResult.rows.length > 0) {
          report += `\n      📊 DÉPENSES PAR CATÉGORIE:\n`;
          expensesByCategoryResult.rows.forEach(exp => {
            const projected = parseFloat(exp.total_projected || 0);
            const actual = parseFloat(exp.total_actual || 0);
            const paid = parseFloat(exp.total_paid || 0);
            
            report += `         • ${exp.category}: ${actual.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
            report += `           (Projeté: ${projected.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar, `;
            report += `Payé: ${paid.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar, `;
            report += `${exp.paid_count}/${exp.line_count} lignes)\n`;
          });
        }

        // Revenus par catégorie (utilise revenuesByCategoryResult calculé ci-dessus)
        if (revenuesByCategoryResult && revenuesByCategoryResult.rows && revenuesByCategoryResult.rows.length > 0) {
          report += `\n      💵 REVENUS PAR CATÉGORIE:\n`;
          revenuesByCategoryResult.rows.forEach(rev => {
            const projected = parseFloat(rev.total_projected || 0);
            const actual = parseFloat(rev.total_actual || 0);
            const received = parseFloat(rev.total_received || 0);
            
            report += `         • ${rev.category}: ${actual.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
            report += `           (Projeté: ${projected.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar, `;
            report += `Reçu: ${received.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar, `;
            report += `${rev.received_count}/${rev.line_count} lignes)\n`;
          });
        }

        report += '\n';
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 6: ANALYSE TEMPORELLE
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📅 ANALYSE TEMPORELLE' + ' '.repeat(96) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    // Analyse par mois
    const monthlyAnalysis = await pool.query(`
      SELECT 
        TO_CHAR(transaction_date, 'YYYY-MM') as month,
        COUNT(*) as transaction_count,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
      FROM transactions
      WHERE is_posted = true
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    if (monthlyAnalysis.rows.length > 0) {
      report += `   📅 ÉVOLUTION MENSUELLE (12 derniers mois):\n\n`;
      
      monthlyAnalysis.rows.forEach(month => {
        const income = parseFloat(month.total_income);
        const expense = parseFloat(month.total_expense);
        const net = income - expense;
        const savingsRate = income > 0 ? ((net / income) * 100).toFixed(2) : 0;
        
        // Formater le nom du mois
        const [year, monthNum] = month.month.split('-');
        const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const monthName = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
        
        report += `      ${monthName}\n`;
        report += `         └─ Transactions: ${month.transaction_count} (${month.income_count} revenus, ${month.expense_count} dépenses)\n`;
        report += `         └─ Revenus: ${income.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         └─ Dépenses: ${expense.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         └─ Net: ${net >= 0 ? '+' : ''}${net.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `         └─ Taux d'épargne: ${savingsRate}%\n\n`;
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 7: INDICATEURS DE PERFORMANCE (KPI)
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n┌' + '─'.repeat(118) + '┐\n';
    report += '│ 📈 INDICATEURS DE PERFORMANCE (KPI)' + ' '.repeat(82) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    // Calcul des KPIs
    const firstTransactionResult = await pool.query(`
      SELECT MIN(transaction_date) as first_date
      FROM transactions
      WHERE is_posted = true
    `);

    const lastTransactionResult = await pool.query(`
      SELECT MAX(transaction_date) as last_date
      FROM transactions
      WHERE is_posted = true
    `);

    if (firstTransactionResult.rows[0].first_date && lastTransactionResult.rows[0].last_date) {
      const firstDate = new Date(firstTransactionResult.rows[0].first_date);
      const lastDate = new Date(lastTransactionResult.rows[0].last_date);
      const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const monthsDiff = daysDiff / 30.44; // Moyenne de jours par mois

      report += `   ⏱️  PÉRIODE D'ANALYSE:\n`;
      report += `      Première transaction: ${firstDate.toLocaleDateString('fr-FR')}\n`;
      report += `      Dernière transaction: ${lastDate.toLocaleDateString('fr-FR')}\n`;
      report += `      Durée totale: ${daysDiff} jours (${monthsDiff.toFixed(1)} mois)\n\n`;

      if (daysDiff > 0) {
        const avgIncomePerDay = parseFloat(global.global_income) / daysDiff;
        const avgExpensePerDay = parseFloat(global.global_expense) / daysDiff;
        const avgNetPerDay = netGlobal / daysDiff;

        report += `   💰 MOYENNES JOURNALIÈRES:\n`;
        report += `      Revenus moyens/jour: ${avgIncomePerDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `      Dépenses moyennes/jour: ${avgExpensePerDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
        report += `      Net moyen/jour: ${avgNetPerDay >= 0 ? '+' : ''}${avgNetPerDay.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;

        if (monthsDiff > 0) {
          const avgIncomePerMonth = parseFloat(global.global_income) / monthsDiff;
          const avgExpensePerMonth = parseFloat(global.global_expense) / monthsDiff;
          const avgNetPerMonth = netGlobal / monthsDiff;

          report += `   📊 MOYENNES MENSUELLES:\n`;
          report += `      Revenus moyens/mois: ${avgIncomePerMonth.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
          report += `      Dépenses moyennes/mois: ${avgExpensePerMonth.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
          report += `      Net moyen/mois: ${avgNetPerMonth >= 0 ? '+' : ''}${avgNetPerMonth.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n\n`;
        }
      }

      // Taux d'épargne global
      const globalSavingsRate = parseFloat(global.global_income) > 0 
        ? ((netGlobal / parseFloat(global.global_income)) * 100).toFixed(2)
        : 0;

      report += `   📈 RATIOS FINANCIERS:\n`;
      report += `      Taux d'épargne global: ${globalSavingsRate}%\n`;
      
      if (parseFloat(global.global_income) > 0) {
        report += `      Ratio dépenses/revenus: ${(parseFloat(global.global_expense) / parseFloat(global.global_income) * 100).toFixed(2)}%\n`;
      }
      
      report += `\n`;

      // Répartition des soldes
      const liquidityAccounts = accountsResult.rows.filter(a => ['cash', 'mobile', 'bank'].includes(a.type));
      const totalLiquidity = liquidityAccounts.reduce((sum, acc) => sum + parseFloat(acc.balance), 0);
      const liquidityRatio = totalBalance > 0 ? ((totalLiquidity / totalBalance) * 100).toFixed(2) : 0;

      report += `   💧 LIQUIDITÉ:\n`;
      report += `      Comptes liquides (Cash/Mobile/Bank): ${totalLiquidity.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `      Ratio de liquidité: ${liquidityRatio}%\n\n`;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECTION 8: ALERTES ET RECOMMANDATIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n┌' + '─'.repeat(118) + '┐\n';
    report += '│ ⚠️  ALERTES ET RECOMMANDATIONS' + ' '.repeat(87) + '│\n';
    report += '└' + '─'.repeat(118) + '┘\n\n';

    let hasAlerts = false;

    // Vérifier les comptes avec solde négatif
    const negativeAccounts = accountsResult.rows.filter(a => parseFloat(a.balance) < 0);
    if (negativeAccounts.length > 0) {
      hasAlerts = true;
      report += `   ⚠️  SOLDES NÉGATIFS:\n`;
      negativeAccounts.forEach(acc => {
        report += `      • ${acc.name}: ${parseFloat(acc.balance).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      });
      report += `      Recommandation: Rééquilibrer les comptes en déficit\n\n`;
    }

    // Vérifier les incohérences de solde
    const inconsistentAccounts = [];
    for (const account of accountsResult.rows) {
      const recalcResult = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as calculated_balance
        FROM transactions WHERE account_id = $1 AND is_posted = true
      `, [account.id]);
      
      const currentBalance = parseFloat(account.balance);
      const calculatedBalance = parseFloat(recalcResult.rows[0].calculated_balance);
      const diff = Math.abs(currentBalance - calculatedBalance);
      
      if (diff >= 0.01) {
        inconsistentAccounts.push({ ...account, diff });
      }
    }

    if (inconsistentAccounts.length > 0) {
      hasAlerts = true;
      report += `   ⚠️  INCOHÉRENCES DÉTECTÉES:\n`;
      inconsistentAccounts.forEach(acc => {
        report += `      • ${acc.name}: Écart de ${acc.diff.toFixed(2)} Ar\n`;
      });
      report += `      Recommandation: Vérifier et corriger les transactions\n\n`;
    }

    // Vérifier les transactions planifiées en retard
    const overdueResult = await pool.query(`
      SELECT COUNT(*) as overdue_count, COALESCE(SUM(amount), 0) as overdue_amount
      FROM transactions
      WHERE is_planned = true AND is_posted = false AND transaction_date < CURRENT_DATE
    `);

    const overdueCount = parseInt(overdueResult.rows[0].overdue_count);
    if (overdueCount > 0) {
      hasAlerts = true;
      const overdueAmount = parseFloat(overdueResult.rows[0].overdue_amount);
      report += `   ⚠️  TRANSACTIONS EN RETARD:\n`;
      report += `      • ${overdueCount} transaction(s) planifiée(s) non postée(s)\n`;
      report += `      • Montant total: ${overdueAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar\n`;
      report += `      Recommandation: Vérifier et poster ces transactions\n\n`;
    }

    // Vérifier le taux d'épargne
    const globalSavingsRate = parseFloat(global.global_income) > 0 
      ? ((netGlobal / parseFloat(global.global_income)) * 100)
      : 0;
    
    if (globalSavingsRate < 10 && parseFloat(global.global_income) > 0) {
      hasAlerts = true;
      report += `   ⚠️  TAUX D'ÉPARGNE FAIBLE:\n`;
      report += `      • Taux actuel: ${globalSavingsRate.toFixed(2)}%\n`;
      report += `      Recommandation: Viser un taux d'épargne d'au moins 20%\n\n`;
    }

    if (!hasAlerts) {
      report += `   ✅ Aucune alerte détectée\n`;
      report += `      Vos finances semblent en ordre!\n\n`;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PIED DE PAGE
    // ═══════════════════════════════════════════════════════════════════════════════
    report += '\n' + '╔' + '═'.repeat(118) + '╗\n';
    report += '║' + ' '.repeat(40) + 'FIN DU RAPPORT' + ' '.repeat(64) + '║\n';
    report += '║' + ' '.repeat(35) + `Généré par Money Tracker` + ' '.repeat(59) + '║\n';
    report += '╚' + '═'.repeat(118) + '╝\n';

    // Sauvegarder le rapport
    fs.writeFileSync(filePath, report, 'utf8');

    console.log('\n✅ Bilan financier généré avec succès!');
    console.log(`📁 Fichier: ${filePath}`);
    console.log(`📊 Taille: ${(Buffer.byteLength(report, 'utf8') / 1024).toFixed(2)} KB`);
    console.log('\n' + '═'.repeat(100) + '\n');

    // Afficher également dans la console
    console.log(report);

  } catch (error) {
    console.error('\n❌ Erreur lors de la génération du bilan:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Exécuter le script
generateFinancialReport();
