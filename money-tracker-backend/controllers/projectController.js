// controllers/projectController.js - VERSION FINALE CORRIGÉE
const pool = require('../config/database');
console.log('🔍 POOL IMPORT:', !!pool, typeof pool);

// ============================================================================
// HELPER : Sécuriser le format JSON pour la DB
// ============================================================================
// Pour expenses/revenues (peuvent être des arrays)
const safeJsonArray = (data) => {
  if (!data) return '[]';
  if (typeof data === 'string') {
    try {
      JSON.parse(data);
      return data;
    } catch {
      return '[]';
    }
  }
  try {
    return JSON.stringify(data);
  } catch {
    return '[]';
  }
};

// Pour metadata/allocation (doivent être des objets)
const safeJsonObject = (data) => {
  if (!data) return '{}';
  if (typeof data === 'string') {
    try {
      JSON.parse(data);
      return data;
    } catch {
      return '{}';
    }
  }
  try {
    return JSON.stringify(data);
  } catch {
    return '{}';
  }
};

// Fonction générique (utilise Object par défaut)
const safeJson = (data) => {
  return safeJsonObject(data);
};

// ============================================================================
// HELPER : Synchroniser project_*_lines depuis les JSON expenses/revenues
// ============================================================================
const syncProjectLinesFromJson = async (client, projectId, rawExpenses, rawRevenues) => {
  let expenses = [];
  let revenues = [];

  try {
    const expStr = safeJsonArray(rawExpenses);
    expenses = JSON.parse(expStr);
  } catch (e) {
    console.warn('⚠️ syncProjectLinesFromJson: parse expenses failed', e);
  }

  try {
    const revStr = safeJsonArray(rawRevenues);
    revenues = JSON.parse(revStr);
  } catch (e) {
    console.warn('⚠️ syncProjectLinesFromJson: parse revenues failed', e);
  }

  // CHARGES
  for (const exp of expenses) {
    if (!exp?.plannedDate) continue;

    await client.query(
      `
      INSERT INTO project_expense_lines (
        project_id,
        description,
        category,
        projected_amount,
        actual_amount,
        transaction_date,
        is_paid
      )
      VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, COALESCE($7, false))
      ON CONFLICT (project_id, description, projected_amount)
      DO UPDATE SET
        category = EXCLUDED.category,
        transaction_date = EXCLUDED.transaction_date,
        is_paid = EXCLUDED.is_paid
      `,
      [
        projectId,
        exp.description || '',
        exp.category || 'Projet - Charge',
        Number(exp.amount || 0),
        exp.actualAmount != null ? Number(exp.actualAmount) : null,
        exp.plannedDate,                 // "YYYY-MM-DD"
        exp.isPaid === true,
      ]
    );
  }

  // REVENUS
  for (const rev of revenues) {
    if (!rev?.plannedDate) continue;

    await client.query(
      `
      INSERT INTO project_revenue_lines (
        project_id,
        description,
        category,
        projected_amount,
        actual_amount,
        transaction_date,
        is_received
      )
      VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, COALESCE($7, false))
      ON CONFLICT (project_id, description, projected_amount)
      DO UPDATE SET
        category = EXCLUDED.category,
        transaction_date = EXCLUDED.transaction_date,
        is_received = EXCLUDED.is_received
      `,
      [
        projectId,
        rev.description || '',
        rev.category || 'Projet - Revenu',
        Number(rev.amount || 0),
        rev.actualAmount != null ? Number(rev.actualAmount) : null,
        rev.plannedDate,
        rev.isPaid === true,
      ]
    );
  }
};

// ============================================================================
// 1. GET - Récupérer tous les projets avec mapping explicite
// ============================================================================
exports.getProjects = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, description, type, status,
        start_date, end_date, frequency, occurrences_count,
        total_cost, total_revenues, net_profit, roi,
        remaining_budget, total_available,
        expenses, revenues, allocation, revenue_allocation,
        metadata, 
        created_at, updated_at
      FROM projects 
      ORDER BY created_at DESC
    `);
    
    const projects = await Promise.all(result.rows.map(async (project) => {
      // ✅ Corriger metadata invalide automatiquement
      let cleanMetadata = project.metadata;
      
      // Si metadata est un tableau vide, le remplacer par un objet vide
      if (Array.isArray(cleanMetadata) && cleanMetadata.length === 0) {
        console.warn(`⚠️ Correction metadata pour projet ${project.id}`);
        cleanMetadata = {};
        
        // Mettre à jour en base pour la prochaine fois
        await pool.query(
          'UPDATE projects SET metadata = $1 WHERE id = $2',
          ['{}', project.id]
        );
      }

      // Charger les lignes normalisées pour chaque projet
      const expLines = await pool.query(`
        SELECT id, description, category, projected_amount, actual_amount, 
               transaction_date, is_paid
        FROM project_expense_lines
        WHERE project_id = $1
        ORDER BY id ASC
      `, [project.id]);

      const revLines = await pool.query(`
        SELECT id, description, category, projected_amount, actual_amount, 
               transaction_date, is_received
        FROM project_revenue_lines
        WHERE project_id = $1
        ORDER BY id ASC
      `, [project.id]);

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        type: project.type,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        frequency: project.frequency,
        occurrencesCount: project.occurrences_count,
        
        totalCost: parseFloat(project.total_cost) || 0,
        totalRevenues: parseFloat(project.total_revenues) || 0,
        netProfit: parseFloat(project.net_profit) || 0,
        roi: parseFloat(project.roi) || 0,
        remainingBudget: parseFloat(project.remaining_budget) || 0,
        totalAvailable: parseFloat(project.total_available) || 0,

        // ✅ Exposer les lignes normalisées
        expenseLines: expLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isPaid: !!r.is_paid
        })),
        
        revenueLines: revLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isReceived: !!r.is_received
        })),
        
        // ✅ Utiliser le metadata corrigé
        expenses: project.expenses,
        revenues: project.revenues,
        allocation: project.allocation,
        revenueAllocation: project.revenue_allocation,
        metadata: cleanMetadata, // ✅ Metadata corrigé
        
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };
    }));
    
    console.log('📊 Projets récupérés avec lignes:', projects.length);
    
    // Debug projet 29
    const project29 = projects.find(p => p.id === 29);
    if (project29) {
      console.log('📦 Projet 29 expenses:', 
                  project29.expenses ? JSON.stringify(project29.expenses).substring(0, 100) : 'null');
      console.log('📦 Projet 29 revenues:', 
                  project29.revenues ? JSON.stringify(project29.revenues).substring(0, 100) : 'null');
      console.log('📦 Projet 29 metadata:', 
                  project29.metadata ? JSON.stringify(project29.metadata).substring(0, 100) : 'null');
    }
    
    res.json(projects);
  } catch (error) {
    console.error('❌ getProjects:', error.message);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 2. GET - Récupérer un projet par ID
// ============================================================================
exports.getProjectById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await pool.query(`
      SELECT 
        id, name, description, type, status,
        start_date AS "startDate",
        end_date AS "endDate",
        frequency,
        occurrences_count AS "occurrencesCount",
        CAST(total_cost AS DOUBLE PRECISION) AS "totalCost",
        CAST(total_revenues AS DOUBLE PRECISION) AS "totalRevenues",
        net_profit AS "netProfit",
        roi,
        remaining_budget AS "remainingBudget",
        total_available AS "totalAvailable",
        expenses,
        revenues,
        allocation,
        revenue_allocation AS "revenueAllocation",
        metadata, 
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM projects WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = result.rows[0];

    // Charger les lignes normalisées si les tables existent
    try {
      const expLines = await pool.query(`
        SELECT id, description, category, projected_amount, actual_amount, 
               transaction_date, is_paid, created_at
        FROM project_expense_lines
        WHERE project_id = $1
        ORDER BY id ASC
      `, [id]);

      if (expLines.rows && expLines.rows.length > 0) {
        project.expenseLines = expLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isPaid: !!r.is_paid,
          createdAt: r.created_at
        }));
      }

      const revLines = await pool.query(`
        SELECT id, description, category, projected_amount, actual_amount, 
               transaction_date, is_received, created_at
        FROM project_revenue_lines
        WHERE project_id = $1
        ORDER BY id ASC
      `, [id]);

      if (revLines.rows && revLines.rows.length > 0) {
        project.revenueLines = revLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isReceived: !!r.is_received,
          createdAt: r.created_at
        }));
      }
    } catch (e) {
      console.warn('⚠️ Normalized project lines not available:', e.message);
    }

    res.json(project);
  } catch (error) {
    console.error('❌ getProjectById:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// 3. POST - Créer un nouveau projet
// ============================================================================
exports.createProject = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      name, description, type, status, startDate, endDate, frequency, occurrencesCount,
      totalCost, totalRevenues, netProfit, roi,
      expenses, revenues, allocation, revenueAllocation, revenue_allocation,
      remainingBudget, totalAvailable, metadata 
    } = req.body;

    const metadataJson = safeJson(metadata); 
    const finalStatus = status || 'draft';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};

const expensesJson = safeJsonArray(expenses);  // ✅ Plus explicite
const revenuesJson = safeJsonArray(revenues);  // ✅ Plus explicite

    const allocationJson = safeJson(allocation);
    const revAllocationJson = safeJson(finalRevenueAllocation);

    // 1. Créer le projet
    const projectResult = await client.query(
      `INSERT INTO projects
       (name, description, type, status,
        start_date, end_date, frequency, occurrences_count,
        total_cost, total_revenues, net_profit, roi,
        remaining_budget, total_available,
        expenses, revenues, allocation, revenue_allocation, metadata)
       VALUES
       ($1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb)
       RETURNING *`,
      [
        name, description, type || 'ponctuel', finalStatus,
        startDate || null, endDate || null, frequency || null, occCount,
        parseFloat(totalCost || 0), parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0), parseFloat(roi || 0),
        parseFloat(remainingBudget || 0), parseFloat(totalAvailable || 0),
        expensesJson, revenuesJson, allocationJson, revAllocationJson,
        metadataJson
      ]
    );
    
    const projectId = projectResult.rows[0].id;
    
    // 2. Insérer les lignes normalisées si elles existent
    const expensesArray = Array.isArray(expenses) ? expenses : (expenses ? JSON.parse(expenses) : []);
    const revenuesArray = Array.isArray(revenues) ? revenues : (revenues ? JSON.parse(revenues) : []);
    
    for (const expense of expensesArray) {
      await client.query(
        `INSERT INTO project_expense_lines 
         (project_id, description, category, projected_amount, actual_amount, 
          transaction_date, is_paid)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          projectId,
          expense.description || '',
          expense.category || 'Autre',
          parseFloat(expense.amount || 0),
          0, // actual_amount initial
          expense.plannedDate || null,  // Utiliser la date fournie
          false // is_paid
        ]
      );
    }
    
    for (const revenue of revenuesArray) {
      await client.query(
        `INSERT INTO project_revenue_lines 
         (project_id, description, category, projected_amount, actual_amount, 
          transaction_date, is_received)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          projectId,
          revenue.description || '',
          revenue.category || 'Autre',
          parseFloat(revenue.amount || 0),
          0, // actual_amount initial
          null, // transaction_date
          false // is_received
        ]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(projectResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ CREATE project:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    client.release();
  }
};

// ============================================================================
// 4. PUT - Mettre à jour un projet
// ============================================================================
exports.updateProject = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const id = Number(req.params.id);
    const {
      name, description, type, status, startDate, endDate, frequency, occurrencesCount,
      totalCost, totalRevenues, netProfit, roi,
      expenses, revenues, allocation, revenueAllocation, revenue_allocation,
      remainingBudget, totalAvailable, metadata
    } = req.body;

    // ✅ LOGS DE DEBUG
    console.log('📝 UPDATE project ID:', id);
    console.log('📦 expenses reçu:', typeof expenses, expenses ? expenses.substring(0, 100) : 'null');
    console.log('📦 revenues reçu:', typeof revenues, revenues ? revenues.substring(0, 100) : 'null');

    const metadataJson = safeJson(metadata); 
    const finalStatus = status || 'active';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};

  const expensesJson = safeJsonArray(expenses);  // ✅ Plus explicite
const revenuesJson = safeJsonArray(revenues);  // ✅ Plus explicite

    const allocationJson = safeJson(allocation);
    const revAllocationJson = safeJson(finalRevenueAllocation);

    // ✅ LOGS APRÈS CONVERSION
    console.log('📦 expensesJson APRÈS safeJson:', typeof expensesJson, expensesJson ? expensesJson.substring(0, 100) : 'null');
    console.log('📦 revenuesJson APRÈS safeJson:', typeof revenuesJson, revenuesJson ? revenuesJson.substring(0, 100) : 'null');

    // 1. Mise à jour Projet principal
    const result = await client.query(
      `UPDATE projects
       SET name=$1, description=$2, type=$3, status=$4, start_date=$5, end_date=$6,
           frequency=$7, occurrences_count=$8, total_cost=$9, total_revenues=$10,
           net_profit=$11, roi=$12, remaining_budget=$13, total_available=$14,
           expenses=$15::jsonb, revenues=$16::jsonb, allocation=$17::jsonb,
           revenue_allocation=$18::jsonb, metadata=$19::jsonb, updated_at=NOW()
       WHERE id=$20
       RETURNING *`,
      [
        name, description, type, finalStatus, startDate || null, endDate || null,
        frequency || null, occCount, parseFloat(totalCost || 0), parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0), parseFloat(roi || 0), parseFloat(remainingBudget || 0),
        parseFloat(totalAvailable || 0), 
        expensesJson,  // ✅ Position $15
        revenuesJson,  // ✅ Position $16
        allocationJson, revAllocationJson,
        metadataJson,
        id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // ✅ LOG DU RÉSULTAT
    console.log('✅ Projet updated:', result.rows[0].id);
    console.log('📦 expenses EN BASE:', typeof result.rows[0].expenses, 
                result.rows[0].expenses ? JSON.stringify(result.rows[0].expenses).substring(0, 100) : 'null');
    console.log('📦 revenues EN BASE:', typeof result.rows[0].revenues,
                result.rows[0].revenues ? JSON.stringify(result.rows[0].revenues).substring(0, 100) : 'null');

    // --- GESTION DES LIGNES (CRUD INTELLIGENT) ---

    // A. DÉPENSES
    const expensesList = Array.isArray(expenses) ? expenses : JSON.parse(expenses || '[]');
    
    // Récupérer les IDs valides (entiers) qu'on veut GARDER
    const validExpenseIds = expensesList
      .map(e => e.id)
      .filter(id => Number.isInteger(id) || (typeof id === 'string' && /^\d+$/.test(id)));

    // 🗑️ SUPPRESSION : On efface tout ce qui n'est pas dans la liste des IDs valides
    if (validExpenseIds.length > 0) {
      await client.query(
        `DELETE FROM project_expense_lines 
         WHERE project_id = $1 AND id != ALL($2::int[])`,
        [id, validExpenseIds]
      );
    } else {
      // Si la liste est vide (ou ne contient que des nouveaux UUIDs), on supprime tout l'ancien
      await client.query('DELETE FROM project_expense_lines WHERE project_id = $1', [id]);
    }

    // UPSERT (Mise à jour ou Création)
for (const item of expensesList) {
  // Si l'ID est un entier (existant en base)
  if (Number.isInteger(item.id) || (typeof item.id === 'string' && /^\d+$/.test(item.id))) {
    await client.query(
      `UPDATE project_expense_lines 
       SET description=$1, category=$2, projected_amount=$3, actual_amount=$4, is_paid=$5, transaction_date=$6
       WHERE id=$7`, 
      [
        item.description || '', 
        item.category || 'Autre', 
        parseFloat(item.amount || 0),
        parseFloat(item.actualAmount || 0),
        item.isPaid || false,
        item.transactionDate || item.plannedDate,
        parseInt(item.id, 10)
      ]
    );
  } else {
    // Si l'ID est un UUID (nouveau du frontend)
    await client.query(
      `INSERT INTO project_expense_lines 
       (project_id, description, category, projected_amount, actual_amount, is_paid, transaction_date)
       VALUES ($1, $2, $3, $4, 0, $5, $6)`,
      [
        id,
        item.description || '',
        item.category || 'Autre',
        parseFloat(item.amount || 0),
        item.isPaid || false,
        item.transactionDate || item.plannedDate || (item.date ? item.date.split('T')[0] : null),
      ]
    );
  }
}


    // B. REVENUS (Même logique)
    const revenuesList = Array.isArray(revenues) ? revenues : JSON.parse(revenues || '[]');
    
    const validRevenueIds = revenuesList
      .map(r => r.id)
      .filter(id => Number.isInteger(id) || (typeof id === 'string' && /^\d+$/.test(id)));

    if (validRevenueIds.length > 0) {
      await client.query(
        `DELETE FROM project_revenue_lines 
         WHERE project_id = $1 AND id != ALL($2::int[])`,
        [id, validRevenueIds]
      );
    } else {
      await client.query('DELETE FROM project_revenue_lines WHERE project_id = $1', [id]);
    }

    for (const item of revenuesList) {
      if (Number.isInteger(item.id) || (typeof item.id === 'string' && /^\d+$/.test(item.id))) {
        await client.query(
  `UPDATE project_revenue_lines 
   SET description=$1, category=$2, projected_amount=$3, is_received=$4, transaction_date=$5
   WHERE id=$6`,
  [
    item.description || '',
    item.category || 'Autre',
    parseFloat(item.amount || 0),
    item.isPaid || item.isReceived || false,
    item.transactionDate || item.plannedDate || (item.date ? item.date.split('T')[0] : null),
    parseInt(item.id, 10),
  ]
);

      } else {
       await client.query(
  `INSERT INTO project_revenue_lines 
   (project_id, description, category, projected_amount, actual_amount, is_received, transaction_date)
   VALUES ($1, $2, $3, $4, 0, $5, $6)`,
  [
    id,
    item.description || '',
    item.category || 'Autre',
    parseFloat(item.amount || 0),
    item.isPaid || item.isReceived || false,
    item.transactionDate || item.plannedDate || (item.date ? item.date.split('T')[0] : null),
  ]
);

      }
    }

    await client.query('COMMIT');
    
    // On renvoie le projet mis à jour
    const updatedProject = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    res.json(updatedProject.rows[0]);


  } catch (error) {
    await client.query('ROLLBACK');
    console.error('💥 UPDATE project:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    client.release();
  }
};

// ============================================================================
// 5. PATCH - Changer uniquement le statut
// ============================================================================
exports.updateProjectStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const validStatuses = ['draft', 'active', 'completed', 'archived', 'Inactif'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Statut invalide', 
        validStatuses 
      });
    }

    const result = await pool.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
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
// 6. DELETE - Supprimer un projet
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
// 7. POST - Mettre à jour le statut automatiquement
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
// 8. PATCH - Toggle statut manuel
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
// 9. POST - Archiver un projet
// ============================================================================
exports.archiveProject = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
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
        proj.name, proj.description, proj.type, 'completed',
        proj.start_date, proj.end_date,
        proj.total_cost, proj.total_revenues, proj.net_profit, proj.roi,
        proj.expenses, proj.revenues, proj.allocation, proj.revenue_allocation,
        proj.occurrences_count, proj.frequency,
        proj.id,
      ]
    );

    await client.query('UPDATE projects SET status = $1 WHERE id = $2', ['completed', id]);

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

// ============================================================================
// 10. POST - Compléter un projet
// ============================================================================
exports.completeProject = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const result = await pool.query(
      `UPDATE projects 
       SET status = 'completed', 
           end_date = COALESCE(end_date, NOW()), 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ completeProject:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 11. POST - Réactiver un projet
// ============================================================================
exports.reactivateProject = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    const result = await pool.query(
      `UPDATE projects 
       SET status = 'active', 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ reactivateProject:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 12. GET - Lignes de dépenses non payées (toutes projets actifs)
// ============================================================================
exports.getUnpaidExpenses = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pel.id,
        pel.project_id as "projectId",
        pel.description,
        pel.category,
        pel.projected_amount as "projectedAmount",
        pel.actual_amount as "actualAmount",
        pel.transaction_date as "transactionDate",
        pel.is_paid as "isPaid",
        pel.created_at as "createdAt",
        p.name as "projectName"
      FROM project_expense_lines pel
      JOIN projects p ON p.id = pel.project_id
      WHERE pel.is_paid = false
        AND p.status = 'active'
      ORDER BY 
        COALESCE(pel.transaction_date, '9999-12-31'::date) ASC,
        pel.created_at ASC
    `);
    
    console.log('📊 Unpaid expenses récupérées:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getUnpaidExpenses:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// POST /api/projects/:projectId/expense-lines - Créer une nouvelle ligne de dépense
exports.createExpenseLine = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { 
      description, 
      category, 
      projectedamount, 
      actualamount, 
      transactiondate, 
      ispaid 
    } = req.body;

    console.log('📝 Création expense line:', { projectId, description, projectedamount });

    // ✅ Utiliser project_id, projected_amount, etc. (snake_case)
    const result = await pool.query(
      `INSERT INTO project_expense_lines 
       (project_id, description, category, projected_amount, actual_amount, transaction_date, is_paid, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        projectId,  // sera mis dans project_id
        description, 
        category || 'Non catégorisé', 
        projectedamount,  // sera mis dans projected_amount
        actualamount || 0, 
        transactiondate || new Date(), 
        ispaid || false
      ]
    );

    console.log('✅ Expense line créée:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur création expense line:', error);
    res.status(500).json({ error: error.message });
  }
};

// Créer une ligne de revenu
exports.createRevenueLine = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { 
      description, 
      category, 
      projectedamount, 
      actualamount, 
      transactiondate, 
      isreceived 
    } = req.body;

    console.log('📝 Création revenue line:', { projectId, description, projectedamount });

    const result = await pool.query(
      `INSERT INTO project_revenue_lines 
       (projectid, description, category, projectedamount, actualamount, transactiondate, isreceived, createdat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        projectId, 
        description, 
        category || 'Non catégorisé', 
        projectedamount, 
        actualamount || 0, 
        transactiondate || new Date(), 
        isreceived || false
      ]
    );

    console.log('✅ Revenue line créée:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur création revenue line:', error);
    res.status(500).json({ error: error.message });
  }
};


// Marquer une ligne de dépense comme payée
// Marquer une ligne de dépense comme payée
exports.markExpenseLinePaid = async (req, res) => {
  console.log('🔵 markExpenseLinePaid appelé');
  console.log('📦 Body:', req.body);
  console.log('📦 Params:', req.params);
  
  const client = await pool.connect();
  
  try {
    const { projectId, lineId } = req.params;
    const { 
      paidexternally, // true = paiement depuis Coffre (compte externe)
      amount, // Montant réel payé
      paiddate, // Date du paiement (format YYYY-MM-DD)
      accountid // ID du compte à débiter (optionnel si paidexternally)
    } = req.body;
    
    console.log('🔍 Données:', { projectId, lineId, paidexternally, amount, paiddate, accountid });
    
    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant invalide' });
    }
    
    if (!paiddate) {
      return res.status(400).json({ message: 'Date de paiement requise' });
    }
    
    await client.query('BEGIN');
    console.log('✅ BEGIN');
    
    // 1. Vérifier que la ligne existe
    const lineRes = await client.query(
      `SELECT * FROM project_expense_lines WHERE id = $1 AND project_id = $2`,
      [lineId, projectId]
    );
    
    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ligne de dépense introuvable' });
    }
    
    const line = lineRes.rows[0];
    console.log('✅ Ligne trouvée:', line.description);
    
    // 2. Vérifier si déjà payée
    if (line.is_paid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Ligne déjà payée' });
    }
    
    let transactionId = null;
    
    // 3. ✅ CORRECTION: Si paidexternally = true, créer transaction depuis Coffre
   // 3. ✅ CORRECTION: Si paidexternally = true, créer transaction depuis Coffre
if (paidexternally) {
  console.log('💳 Création transaction depuis Coffre...');
  
  const coffreAccountId = 5; // ID du compte Coffre
  
  const txResult = await client.query(
    `INSERT INTO transactions (
      account_id, type, amount, category, description, 
      transaction_date, is_planned, is_posted, project_id, project_line_id, user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      coffreAccountId,
      'expense',
      amount,
      line.category || 'Projet - Dépense',
      line.description || 'Paiement projet',
      paiddate,
      false, // is_planned
      true,  // is_posted
      projectId,
      lineId.toString(), // project_line_id (text)
      req.user?.user_id || 1
    ]
  );
  
  transactionId = txResult.rows[0].id;
  console.log('✅ Transaction créée depuis Coffre:', transactionId);
  
} else if (accountid) {
  // Si un compte spécifique est fourni
  console.log('💳 Création transaction depuis compte:', accountid);
  
  const txResult = await client.query(
    `INSERT INTO transactions (
      account_id, type, amount, category, description, 
      transaction_date, is_planned, is_posted, project_id, project_line_id, user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id`,
    [
      accountid,
      'expense',
      amount,
      line.category || 'Projet - Dépense',
      line.description || 'Paiement projet',
      paiddate,
      false, // is_planned
      true,  // is_posted
      projectId,
      lineId.toString(),
      req.user?.user_id || 1
    ]
  );
  
  transactionId = txResult.rows[0].id;
  console.log('✅ Transaction créée:', transactionId);
} else {
  console.log('⚠️ Aucun compte spécifié, pas de transaction créée');
}
    
    // 4. Mettre à jour la ligne
    console.log('📝 Mise à jour ligne...');
    const updateResult = await client.query(
      `UPDATE project_expense_lines
      SET is_paid = TRUE,
          actual_amount = $1,
          transaction_date = $2,
          last_synced_at = NOW()
      WHERE id = $3
      RETURNING *`,
      [amount, paiddate, lineId]
    );
    
    console.log('✅ Ligne mise à jour');
    
    await client.query('COMMIT');
    console.log('✅ COMMIT');
    
    res.json({
      success: true,
      message: 'Paiement enregistré',
      line: updateResult.rows[0],
      transactionId,
      paidExternally: !!paidexternally
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};


// Marquer une ligne de revenu comme reçue
exports.markRevenueLineReceived = async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, lineId } = req.params;
    const { 
      received_externally,
      transaction_id,
      amount,
      transaction_date,
      create_transaction
    } = req.body;

    await client.query('BEGIN');

    const lineRes = await client.query(
      `SELECT * FROM project_revenue_lines 
       WHERE id = $1 AND project_id = $2`,
      [lineId, projectId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne de revenu introuvable' });
    }

    const line = lineRes.rows[0];

    if (line.is_received && line.transaction_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cette ligne est déjà reçue et liée à la transaction ' + line.transaction_id 
      });
    }

    let finalTransactionId = null;

    if (received_externally) {
      await client.query(
        `UPDATE project_revenue_lines
         SET is_received = TRUE,
             actual_amount = $1,
             transaction_date = $2,
             transaction_id = NULL
         WHERE id = $3`,
        [amount || line.projected_amount, transaction_date || new Date(), lineId]
      );

      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'Ligne marquée comme reçue (encaissement externe)',
        received_externally: true
      });

    } else if (transaction_id) {
      const txRes = await client.query(
        'SELECT id, amount, transaction_date FROM transactions WHERE id = $1',
        [transaction_id]
      );

      if (txRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Transaction introuvable' });
      }

      finalTransactionId = transaction_id;

      await client.query(
        `UPDATE project_revenue_lines
         SET is_received = TRUE,
             actual_amount = $1,
             transaction_date = $2,
             transaction_id = $3
         WHERE id = $4`,
        [txRes.rows[0].amount, txRes.rows[0].transaction_date, transaction_id, lineId]
      );

    } else if (create_transaction) {
      const newTxRes = await client.query(
        `INSERT INTO transactions 
         (account_id, type, amount, category, description, transaction_date, project_id, project_line_id, user_id)
         VALUES ($1, 'income', $2, $3, $4, $5, $6, $7, 1)
         RETURNING id`,
        [
          5, // Coffre
          amount || line.projected_amount,
          line.category,
          line.description,
          transaction_date || new Date(),
          projectId,
          lineId
        ]
      );

      finalTransactionId = newTxRes.rows[0].id;

      await client.query(
        `UPDATE project_revenue_lines
         SET is_received = TRUE,
             actual_amount = $1,
             transaction_date = $2,
             transaction_id = $3
         WHERE id = $4`,
        [amount || line.projected_amount, transaction_date || new Date(), finalTransactionId, lineId]
      );

    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres manquants : précisez received_externally, transaction_id ou create_transaction' 
      });
    }

    await client.query('COMMIT');

    res.json({ 
      success: true,
      message: 'Ligne de revenu marquée comme reçue',
      transaction_id: finalTransactionId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur markRevenueLineReceived:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Annuler le paiement d'une ligne de dépense
exports.cancelExpenseLinePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, lineId } = req.params;

    await client.query('BEGIN');

    const lineRes = await client.query(
      'SELECT * FROM project_expense_lines WHERE id = $1 AND project_id = $2',
      [lineId, projectId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne de dépense introuvable' });
    }

    const line = lineRes.rows[0];

    // Si transaction liée, la supprimer
    if (line.transaction_id) {
      await client.query('DELETE FROM transactions WHERE id = $1', [line.transaction_id]);
    }

    // Remettre la ligne en état "non payé"
    await client.query(
      `UPDATE project_expense_lines
       SET is_paid = FALSE,
           actual_amount = 0,
           transaction_date = NULL,
           transaction_id = NULL
       WHERE id = $1`,
      [lineId]
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Paiement annulé avec succès',
      transaction_deleted: !!line.transaction_id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur cancelExpenseLinePayment:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// Annuler la réception d'une ligne de revenu
exports.cancelRevenueLineReceipt = async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, lineId } = req.params;

    await client.query('BEGIN');

    const lineRes = await client.query(
      'SELECT * FROM project_revenue_lines WHERE id = $1 AND project_id = $2',
      [lineId, projectId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne de revenu introuvable' });
    }

    const line = lineRes.rows[0];

    if (line.transaction_id) {
      await client.query('DELETE FROM transactions WHERE id = $1', [line.transaction_id]);
    }

    await client.query(
      `UPDATE project_revenue_lines
       SET is_received = FALSE,
           actual_amount = 0,
           transaction_date = NULL,
           transaction_id = NULL
       WHERE id = $1`,
      [lineId]
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Encaissement annulé avec succès',
      transaction_deleted: !!line.transaction_id
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur cancelRevenueLineReceipt:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ✅ NOUVEAU dans projectController.js
exports.cancelExpensePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const { projectId, lineId } = req.params;
    
    await client.query('BEGIN');
    
    // Réinitialiser le statut de paiement
    const result = await client.query(
      `UPDATE project_expense_lines
       SET is_paid = FALSE,
           actual_amount = 0,
           transaction_id = NULL,
           transaction_date = NULL
       WHERE id = $1 AND project_id = $2
       RETURNING *`,
      [lineId, projectId]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne introuvable' });
    }
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ cancelExpensePayment:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

// ============================================================================
// 13. GET - Lignes de revenus non reçus (toutes projets actifs)
// ============================================================================
exports.getPendingRevenues = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        prl.id,
        prl.project_id as "projectId",
        prl.description,
        prl.category,
        prl.projected_amount as "projectedAmount",
        prl.actual_amount as "actualAmount",
        prl.transaction_date as "transactionDate",
        prl.is_received as "isReceived",
        prl.created_at as "createdAt",
        p.name as "projectName"
      FROM project_revenue_lines prl
      JOIN projects p ON p.id = prl.project_id
      WHERE prl.is_received = false
        AND p.status = 'active'
      ORDER BY 
        COALESCE(prl.transaction_date, '9999-12-31'::date) ASC,
        prl.created_at ASC
    `);
    
    console.log('📊 Pending revenues récupérées:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getPendingRevenues:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 14. GET - Lignes de dépenses pour un projet spécifique
// ============================================================================
exports.getProjectExpenseLines = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    
    const result = await pool.query(`
      SELECT 
        id,
        project_id as "projectId",
        description,
        category,
        projected_amount as "projectedAmount",
        actual_amount as "actualAmount",
        transaction_date as "transactionDate",
        is_paid as "isPaid",
        created_at as "createdAt",
        last_synced_at as "lastSyncedAt"
      FROM project_expense_lines
      WHERE project_id = $1
      ORDER BY id ASC
    `, [projectId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getProjectExpenseLines:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// 15. GET - Lignes de revenus pour un projet spécifique
// ============================================================================
exports.getProjectRevenueLines = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    
    const result = await pool.query(`
      SELECT 
        id,
        project_id as "projectId",
        description,
        category,
        projected_amount as "projectedAmount",
        actual_amount as "actualAmount",
        transaction_date as "transactionDate",
        is_received as "isReceived",
        created_at as "createdAt",
        last_synced_at as "lastSyncedAt"
      FROM project_revenue_lines
      WHERE project_id = $1
      ORDER BY id ASC
    `, [projectId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getProjectRevenueLines:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

