const db = require('../config/database');

exports.generateDistributions = async (req, res) => {
  const { projectId } = req.params;

  try {
    const projectResult = await db.query(
      'SELECT * FROM projects WHERE id = $1', [projectId]
    );
    const project = projectResult.rows[0];

    if (!project) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    // ✅ Noms de tables corrects
    const expenseLinesResult = await db.query(
      'SELECT * FROM projectexpenselines WHERE projectid = $1 ORDER BY transactiondate',
      [projectId]
    );

    const revenueLinesResult = await db.query(
      'SELECT * FROM projectrevenuelines WHERE projectid = $1 ORDER BY transactiondate',
      [projectId]
    );

    const expenses = expenseLinesResult.rows;
    const revenues = revenueLinesResult.rows;

    const bimesters = groupByBimester(expenses, revenues, project.startdate);

    // ✅ Nom de table corrigé
    const partnersResult = await db.query(
      'SELECT * FROM projectpartners WHERE projectid = $1 ORDER BY id',
      [projectId]
    );
    const partners = partnersResult.rows;

    if (partners.length === 0) {
      return res.status(400).json({ 
        error: 'Aucun associé défini. Ajoutez d\'abord les associés du projet.' 
      });
    }

    // ✅ Nom de table corrigé
    await db.query('DELETE FROM profitdistributions WHERE projectid = $1', [projectId]);

    const totalInvestment = parseFloat(project.totalcapitalinvestment || project.totalcost || 0);
    let cumulativeReimbursement = 0;
    const distributions = [];

    for (const bimester of bimesters) {
      const profit = bimester.totalrevenue - bimester.totalcosts;
      const isReimbursementPhase = cumulativeReimbursement < totalInvestment;
      const phase = isReimbursementPhase ? 'Remboursement' : 'Distribution normale';

      // ✅ Noms de colonnes corrects (sans underscores)
      const distResult = await db.query(
        `INSERT INTO profitdistributions 
         (projectid, distributionperiod, periodstartdate, periodenddate,
          totalrevenue, totalcosts, profittodistribute, distributionphase,
          capitalreimbursedcumulative, reimbursementpercentage)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          projectId, bimester.period, bimester.startdate, bimester.enddate,
          bimester.totalrevenue, bimester.totalcosts, profit, phase,
          cumulativeReimbursement,
          totalInvestment > 0 ? (cumulativeReimbursement / totalInvestment) * 100 : 0
        ]
      );

      const distribution = distResult.rows[0];

      for (const partner of partners) {
        const percentage = isReimbursementPhase 
          ? partner.phase1percentage 
          : partner.phase2percentage;

        const amount = (profit * percentage) / 100;

        // ✅ Noms de colonnes corrects
        await db.query(
          `INSERT INTO partnerpayments 
           (distributionid, partnerid, partnername, amountallocated, percentageapplied)
           VALUES ($1, $2, $3, $4, $5)`,
          [distribution.id, partner.id, partner.partnername, amount, percentage]
        );

        if (isReimbursementPhase && partner.iscapitalinvestor) {
          cumulativeReimbursement += amount;
        }
      }

      distributions.push(distribution);
    }

    if (cumulativeReimbursement >= totalInvestment) {
      await db.query(
        'UPDATE projects SET capitalfullyreimbursed = TRUE WHERE id = $1',
        [projectId]
      );
    }

    res.json({
      message: 'Distributions générées avec succès',
      distributions,
      totalinvestment: totalInvestment,
      totalreimbursed: cumulativeReimbursement,
      reimbursementcomplete: cumulativeReimbursement >= totalInvestment
    });

  } catch (err) {
    console.error('Erreur génération distributions:', err);
    res.status(500).json({ error: err.message });
  }
};

function groupByBimester(expenses, revenues, startDate) {
  const bimesters = [];
  const start = new Date(startDate);

  for (let i = 0; i < 6; i++) {
    const bimesterStart = new Date(start);
    bimesterStart.setMonth(start.getMonth() + (i * 2));

    const bimesterEnd = new Date(bimesterStart);
    bimesterEnd.setMonth(bimesterStart.getMonth() + 2);
    bimesterEnd.setDate(bimesterEnd.getDate() - 1);

    const bimesterExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.transactiondate);
      return expDate >= bimesterStart && expDate <= bimesterEnd;
    });

    const bimesterRevenues = revenues.filter(rev => {
      const revDate = new Date(rev.transactiondate);
      return revDate >= bimesterStart && revDate <= bimesterEnd;
    });

    const totalCosts = bimesterExpenses.reduce((sum, exp) => 
      sum + parseFloat(exp.projectedamount || 0), 0);

    const totalRevenue = bimesterRevenues.reduce((sum, rev) => 
      sum + parseFloat(rev.projectedamount || 0), 0);

    bimesters.push({
      period: `Bimestre ${i + 1}`,
      startdate: bimesterStart,
      enddate: bimesterEnd,
      totalcosts: totalCosts,
      totalrevenue: totalRevenue
    });
  }

  return bimesters;
}

exports.getDistributions = async (req, res) => {
  const { projectId } = req.params;

  try {
    const result = await db.query(
      `SELECT d.*, 
        (SELECT COUNT(*) FROM partnerpayments WHERE distributionid = d.id AND ispaid = TRUE) as paidcount,
        (SELECT COUNT(*) FROM partnerpayments WHERE distributionid = d.id) as totalpartners
       FROM profitdistributions d
       WHERE d.projectid = $1
       ORDER BY d.periodstartdate`,
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
    const distResult = await db.query(
      'SELECT * FROM profitdistributions WHERE id = $1',
      [distributionId]
    );

    if (distResult.rows.length === 0) {
      return res.status(404).json({ error: 'Distribution introuvable' });
    }

    const paymentsResult = await db.query(
      'SELECT * FROM partnerpayments WHERE distributionid = $1 ORDER BY id',
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
  const { accountid, paymentdate, notes } = req.body;

  try {
    const paymentResult = await db.query(
      'SELECT * FROM partnerpayments WHERE distributionid = $1 AND partnerid = $2',
      [distributionId, partnerId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable' });
    }

    const payment = paymentResult.rows[0];

    await db.query(
      `INSERT INTO transactions 
       (accountid, type, amount, category, description, transactiondate, isposted)
       VALUES ($1, 'expense', $2, 'Distribution Bénéfices', $3, $4, TRUE)`,
      [accountid, payment.amountallocated,
       `Paiement associé: ${payment.partnername}`,
       paymentdate || new Date()]
    );

    const updateResult = await db.query(
      `UPDATE partnerpayments 
       SET ispaid = TRUE, paymentdate = $1, paymentaccountid = $2, notes = $3,
           updatedat = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [paymentdate || new Date(), accountid, notes, payment.id]
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

// Partner Controller
exports.addPartner = async (req, res) => {
  const { projectId } = req.params;
  const {
    partnername, partnerrole, capitalcontribution, contributionpercentage,
    phase1percentage, phase2percentage, iscapitalinvestor
  } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO projectpartners 
       (projectid, partnername, partnerrole, capitalcontribution, 
        contributionpercentage, phase1percentage, phase2percentage, iscapitalinvestor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [projectId, partnername, partnerrole, capitalcontribution,
       contributionpercentage, phase1percentage, phase2percentage, iscapitalinvestor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPartners = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM projectpartners WHERE projectid = $1 ORDER BY id',
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePartner = async (req, res) => {
  const { partnerId } = req.params;
  const updates = req.body;

  const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
  const values = [...Object.values(updates), partnerId];

  try {
    const result = await db.query(
      `UPDATE projectpartners SET ${fields}, updatedat = CURRENT_TIMESTAMP 
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePartner = async (req, res) => {
  const { partnerId } = req.params;
  try {
    await db.query('DELETE FROM projectpartners WHERE id = $1', [partnerId]);
    res.json({ message: 'Associé supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
