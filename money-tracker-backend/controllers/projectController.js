const pool = require('../config/database');
console.log('🔍 POOL IMPORT:', !!pool, typeof pool);

// ============================================================================
// 1. GET - Récupérer tous les projets
// ============================================================================
exports.getProjects = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        name,
        description,
        type,
        status,
        start_date AS "startDate",
        end_date AS "endDate",
        frequency,
        occurrences_count AS "occurrencesCount",
        CAST(total_cost AS DOUBLE PRECISION) AS "totalCost",              -- ✅ Convertir en nombre
        CAST(total_revenues AS DOUBLE PRECISION) AS "totalRevenues",      -- ✅ Convertir en nombre
        net_profit AS "netProfit",
        roi,
        remaining_budget AS "remainingBudget",
        total_available AS "totalAvailable",
        expenses,
        revenues,
        allocation,
        revenue_allocation AS "revenueAllocation",
        accounts_snapshot AS "accountsSnapshot",
        activated_at AS "activatedAt",
        activated_transactions AS "activatedTransactions",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM projects 
      ORDER BY created_at DESC
    `);
    
    // ✅ Log pour debugging
    console.log('📊 Projets récupérés:', result.rows.length);
    if (result.rows.length > 0) {
    }
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getProjects:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// 2. POST - Créer un nouveau projet
// ============================================================================
exports.createProject = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      status,
      startDate,
      endDate,
      frequency,
      occurrencesCount,
      totalCost,
      totalRevenues,
      netProfit,
      roi,
      expenses,
      revenues,
      allocation,
      revenueAllocation,
      revenue_allocation,
      remainingBudget,
      totalAvailable,
    } = req.body;

    const finalStatus = status || 'draft';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};
    const result = await pool.query(
      `INSERT INTO projects 
        (name, description, type, status,
         start_date, end_date, frequency, occurrences_count,
         total_cost, total_revenues, net_profit, roi,
         remaining_budget, total_available,
         expenses, revenues, allocation, revenue_allocation)
       VALUES
        ($1,  $2,  $3,  $4,
         $5,  $6,  $7,  $8,
         $9,  $10, $11, $12,
         $13, $14,
         $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb)
       RETURNING 
         id,
         name,
         description,
         type,
         status,
         start_date AS "startDate",
         end_date AS "endDate",
         frequency,
         occurrences_count AS "occurrencesCount",
         total_cost AS "totalCost",
         total_revenues AS "totalRevenues",
         net_profit AS "netProfit",
         roi,
         remaining_budget AS "remainingBudget",
         total_available AS "totalAvailable",
         expenses,
         revenues,
         allocation,
         revenue_allocation AS "revenueAllocation",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        name,
        description,
        type || 'ponctuel',
        finalStatus,
        startDate || null,
        endDate || null,
        frequency || null,
        occCount,
        parseFloat(totalCost || 0),
        parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0),
        parseFloat(roi || 0),
        parseFloat(remainingBudget || 0),
        parseFloat(totalAvailable || 0),
        JSON.stringify(expenses || []),
        JSON.stringify(revenues || []),
        JSON.stringify(allocation || {}),
        JSON.stringify(finalRevenueAllocation || {}),
      ]
    );
  } catch (error) {
    console.error('❌ CREATE project:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 3. PUT - Mettre à jour un projet complet (avec validation)
// ============================================================================
exports.updateProject = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      description,
      type,
      status,
      startDate,
      endDate,
      frequency,
      occurrencesCount,
      totalCost,
      totalRevenues,
      netProfit,
      roi,
      expenses,
      revenues,
      allocation,
      revenueAllocation,
      revenue_allocation,
      remainingBudget,
      totalAvailable,
    } = req.body;

    const finalStatus = status || 'active';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};

    const result = await pool.query(
      `UPDATE projects 
       SET 
         name               = $1,
         description        = $2,
         type               = $3,
         status             = $4,
         start_date         = $5,
         end_date           = $6,
         frequency          = $7,
         occurrences_count  = $8,
         total_cost         = $9,
         total_revenues     = $10,
         net_profit         = $11,
         roi                = $12,
         remaining_budget   = $13,
         total_available    = $14,
         expenses           = $15::jsonb,
         revenues           = $16::jsonb,
         allocation         = $17::jsonb,
         revenue_allocation = $18::jsonb,
         updated_at         = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        name,
        description,
        type,
        finalStatus,
        startDate || null,
        endDate || null,
        frequency || null,
        occCount,
        parseFloat(totalCost || 0),
        parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0),
        parseFloat(roi || 0),
        parseFloat(remainingBudget || 0),
        parseFloat(totalAvailable || 0),
        JSON.stringify(expenses || []),
        JSON.stringify(revenues || []),
        JSON.stringify(allocation || {}),
        JSON.stringify(finalRevenueAllocation || {}),
        id,
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('💥 UPDATE project:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 4. PATCH - Changer uniquement le statut (sans validation complète)
// ============================================================================
exports.updateProjectStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    // Validation manuelle du statut
    const validStatuses = ['draft', 'active', 'completed', 'archived', 'Inactif'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Statut invalide', 
        validStatuses 
      });
    }

    const result = await pool.query(
  `UPDATE projects 
   SET 
     name               = $1,
     description        = $2,
     type               = $3,
     status             = $4,
     start_date         = $5,
     end_date           = $6,
     frequency          = $7,
     occurrences_count  = $8,
     total_cost         = $9,
     total_revenues     = $10,
     net_profit         = $11,
     roi                = $12,
     remaining_budget   = $13,
     total_available    = $14,
     expenses           = $15::jsonb,
     revenues           = $16::jsonb,
     allocation         = $17::jsonb,
     revenue_allocation = $18::jsonb,
     updated_at         = NOW()
   WHERE id = $19
   RETURNING 
     id,
     name,
     description,
     type,
     status,
     start_date AS "startDate",
     end_date AS "endDate",
     frequency,
     occurrences_count AS "occurrencesCount",
     total_cost AS "totalCost",
     total_revenues AS "totalRevenues",
     net_profit AS "netProfit",
     roi,
     remaining_budget AS "remainingBudget",
     total_available AS "totalAvailable",
     expenses,
     revenues,
     allocation,
     revenue_allocation AS "revenueAllocation",
     created_at AS "createdAt",
     updated_at AS "updatedAt"`,
  [
    name,
    description,
    type,
    finalStatus,
    startDate || null,
    endDate || null,
    frequency || null,
    occCount,
    parseFloat(totalCost || 0),
    parseFloat(totalRevenues || 0),
    parseFloat(netProfit || 0),
    parseFloat(roi || 0),
    parseFloat(remainingBudget || 0),
    parseFloat(totalAvailable || 0),
    JSON.stringify(expenses || []),
    JSON.stringify(revenues || []),
    JSON.stringify(allocation || {}),
    JSON.stringify(finalRevenueAllocation || {}),
    id,
  ]
);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ updateProjectStatus:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 5. DELETE - Supprimer un projet
// ============================================================================
exports.deleteProject = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// 6. POST - Mettre à jour le statut automatiquement (basé sur transactions)
// ============================================================================
exports.autoUpdateProjectStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      'SELECT * FROM transactions WHERE project_id = $1',
      [id]
    );

    const total = result.rows.length;
    const posted = result.rows.filter((t) => t.is_planned === false).length;
    const status =
      total === 0 ? 'Planifié' : posted === total ? 'Terminé' : 'En cours';

    await pool.query(
      'UPDATE projects SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json({ success: true, status });
  } catch (error) {
    console.error('❌ autoUpdateProjectStatus:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// 7. PATCH - Toggle statut manuel
// ============================================================================
exports.toggleProjectActive = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const result = await pool.query(
      'UPDATE projects SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ TOGGLE:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// 8. POST - Archiver un projet
// ============================================================================
exports.archiveProject = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM projects WHERE id = $1', [
      id,
    ]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projet introuvable' });
    }
    const proj = rows[0];

    await client.query(
      `INSERT INTO archived_projects
       (name, description, type, status, start_date, end_date,
        total_cost, total_revenues, net_profit, roi,
        expenses, revenues, allocation, revenue_allocation,
        occurrences_count, frequency, archived_at, original_project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, NOW(), $17)`,
      [
        proj.name,
        proj.description,
        proj.type,
        'completed',
        proj.start_date,
        proj.end_date,
        proj.total_cost,
        proj.total_revenues,
        proj.net_profit,
        proj.roi,
        proj.expenses,
        proj.revenues,
        proj.allocation,
        proj.revenue_allocation,
        proj.occurrences_count,
        proj.frequency,
        proj.id,
      ]
    );

    await client.query('UPDATE projects SET status = $1 WHERE id = $2', [
      'completed',
      id,
    ]);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur archiveProject:', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
};
