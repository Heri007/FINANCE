const db = require('../config/database');

exports.generateDistributions = async (req, res) => {
  const { projectId } = req.params;

  try {
    // 1. Récupérer le projet et ses métadonnées
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1', [projectId]
    );
    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    // 2. Récupérer les revenus et charges du projet
    const expenseLinesResult = await db.query(
      'SELECT * FROM expense_lines WHERE project_id = $1 ORDER BY planned_date',
      [projectId]
    );

    const revenueLinesResult = await db.query(
      'SELECT * FROM revenue_lines WHERE project_id = $1 ORDER BY planned_date',
      [projectId]
    );

    const expenses = expenseLinesResult.rows;
    const revenues = revenueLinesResult.rows;

    // 3. Grouper par bimestre
    const bimesters = groupByBimester(expenses, revenues, project.start_date || project.startdate);

    // 4. Récupérer les associés
    const partnersResult = await db.query(
      'SELECT * FROM project_partners WHERE project_id = $1 ORDER BY id',
      [projectId]
    );
    const partners = partnersResult.rows;

    if (partners.length === 0) {
      return res.status(400).json({ 
        error: 'Aucun associé défini. Ajoutez d\'abord les associés du projet.' 
      });
    }

    // 5. Supprimer les anciennes distributions pour régénération
    await db.query('DELETE FROM profit_distributions WHERE project_id = $1', [projectId]);

    // 6. Calculer les distributions
    const totalInvestment = parseFloat(project.total_capital_investment || project.total_cost || project.totalcost || 0);
    let cumulativeReimbursement = 0;
    const distributions = [];

    for (const bimester of bimesters) {
      const profit = bimester.total_revenue - bimester.total_costs;

      // Déterminer la phase
      const isReimbursementPhase = cumulativeReimbursement < totalInvestment;
      const phase = isReimbursementPhase ? 'Remboursement' : 'Distribution normale';

      // Créer la distribution
      const distResult = await db.query(
        `INSERT INTO profit_distributions 
         (project_id, distribution_period, period_start_date, period_end_date,
          total_revenue, total_costs, profit_to_distribute, distribution_phase,
          capital_reimbursed_cumulative, reimbursement_percentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          projectId,
          bimester.period,
          bimester.start_date,
          bimester.end_date,
          bimester.total_revenue,
          bimester.total_costs,
          profit,
          phase,
          cumulativeReimbursement,
          totalInvestment > 0 ? (cumulativeReimbursement / totalInvestment) * 100 : 0
        ]
      );

      const distribution = distResult.rows[0];

      // Créer les paiements pour chaque associé
      for (const partner of partners) {
        const percentage = isReimbursementPhase 
          ? partner.phase1_percentage 
          : partner.phase2_percentage;

        const amount = (profit * percentage) / 100;

        await db.query(
          `INSERT INTO partner_payments 
           (distribution_id, partner_id, partner_name, amount_allocated, percentage_applied)
           VALUES ($1, $2, $3, $4, $5)`,
          [distribution.id, partner.id, partner.partner_name, amount, percentage]
        );

        // Mise à jour du remboursement cumulé (uniquement pour l'investisseur principal)
        if (isReimbursementPhase && partner.is_capital_investor) {
          cumulativeReimbursement += amount;
        }
      }

      distributions.push(distribution);
    }

    // 7. Mettre à jour le projet si remboursement complet
    if (cumulativeReimbursement >= totalInvestment) {
      await db.query(
        'UPDATE projects SET capital_fully_reimbursed = TRUE WHERE id = $1',
        [projectId]
      );
    }

    res.json({
      message: 'Distributions générées avec succès',
      distributions,
      total_investment: totalInvestment,
      total_reimbursed: cumulativeReimbursement,
      reimbursement_complete: cumulativeReimbursement >= totalInvestment
    });

  } catch (err) {
    console.error('Erreur génération distributions:', err);
    res.status(500).json({ error: err.message });
  }
};

// Fonction helper pour grouper par bimestre
function groupByBimester(expenses, revenues, startDate) {
  const bimesters = [];
  const start = new Date(startDate);

  for (let i = 0; i < 6; i++) {  // 6 bimestres dans l'année
    const bimesterStart = new Date(start);
    bimesterStart.setMonth(start.getMonth() + (i * 2));

    const bimesterEnd = new Date(bimesterStart);
    bimesterEnd.setMonth(bimesterStart.getMonth() + 2);
    bimesterEnd.setDate(bimesterEnd.getDate() - 1);

    // Filtrer les charges du bimestre
    const bimesterExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.planned_date || exp.planneddate);
      return expDate >= bimesterStart && expDate <= bimesterEnd;
    });

    // Filtrer les revenus du bimestre
    const bimesterRevenues = revenues.filter(rev => {
      const revDate = new Date(rev.planned_date || rev.planneddate);
      return revDate >= bimesterStart && revDate <= bimesterEnd;
    });

    const totalCosts = bimesterExpenses.reduce((sum, exp) => 
      sum + parseFloat(exp.projected_amount || exp.projectedamount || 0), 0);

    const totalRevenue = bimesterRevenues.reduce((sum, rev) => 
      sum + parseFloat(rev.projected_amount || rev.projectedamount || 0), 0);

    bimesters.push({
      period: `Bimestre ${i + 1}`,
      start_date: bimesterStart,
      end_date: bimesterEnd,
      total_costs: totalCosts,
      total_revenue: totalRevenue
    });
  }

  return bimesters;
}

exports.getDistributions = async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await db.query(
      `SELECT d.*, 
        (SELECT COUNT(*) FROM partner_payments WHERE distribution_id = d.id AND is_paid = TRUE) as paid_count,
        (SELECT COUNT(*) FROM partner_payments WHERE distribution_id = d.id) as total_partners
       FROM profit_distributions d
       WHERE d.project_id = $1
       ORDER BY d.period_start_date`,
      [projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur getDistributions:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getDistributionDetail = async (req, res) => {
  const { distributionId } = req.params;

  try {
    // Distribution
    const distResult = await db.query(
      'SELECT * FROM profit_distributions WHERE id = $1',
      [distributionId]
    );

    if (distResult.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution introuvable' });
    }

    // Paiements associés
    const paymentsResult = await db.query(
      'SELECT * FROM partner_payments WHERE distribution_id = $1 ORDER BY id',
      [distributionId]
    );

    res.json({
      distribution: distResult.rows[0],
      payments: paymentsResult.rows
    });
  } catch (err) {
    console.error('Erreur getDistributionDetail:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.payPartner = async (req, res) => {
  const { distributionId, partnerId } = req.params;
  const { payment_account_id, payment_date, notes } = req.body;

  try {
    // Récupérer le paiement
    const paymentResult = await db.query(
      'SELECT * FROM partner_payments WHERE distribution_id = $1 AND partner_id = $2',
      [distributionId, partnerId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const payment = paymentResult.rows[0];

    // Créer une transaction sortie dans le compte
    await db.query(
      `INSERT INTO transactions 
       (account_id, type, amount, category, description, transaction_date, is_posted)
       VALUES ($1, 'expense', $2, 'Distribution Bénéfices', $3, $4, TRUE)`,
      [
        payment_account_id,
        payment.amount_allocated,
        `Paiement associé: ${payment.partner_name}`,
        payment_date || new Date()
      ]
    );

    // Marquer le paiement comme payé
    const updateResult = await db.query(
      `UPDATE partner_payments 
       SET is_paid = TRUE, payment_date = $1, payment_account_id = $2, notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [payment_date || new Date(), payment_account_id, notes, payment.id]
    );

    res.json({
      message: 'Paiement effectué avec succès',
      payment: updateResult.rows[0]
    });

  } catch (err) {
    console.error('Erreur payPartner:', err);
    res.status(500).json({ error: err.message });
  }
};