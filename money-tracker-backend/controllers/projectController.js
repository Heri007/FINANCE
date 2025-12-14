// controllers/projectController.js - VERSION FINALE CORRIGÉE
const pool = require('../config/database');
console.log('🔍 POOL IMPORT:', !!pool, typeof pool);

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
        created_at, updated_at
      FROM projects 
      ORDER BY created_at DESC
    `);
    
    const projects = await Promise.all(result.rows.map(async (project) => {
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
          id: r.id,  // Ce `id` sera utilisé comme `project_line_id`
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isPaid: !!r.is_paid
        })),
        
        revenueLines: revLines.rows.map(r => ({
          id: r.id,  // Ce `id` sera utilisé comme `project_line_id`
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actualAmount: parseFloat(r.actual_amount || 0),
          transactionDate: r.transaction_date,
          isReceived: !!r.is_received
        })),
        
        // Garder les JSON pour compatibilité
        expenses: project.expenses,
        revenues: project.revenues,
        allocation: project.allocation,
        revenueAllocation: project.revenue_allocation,
        
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };
    }));
    
    console.log('📊 Projets récupérés avec lignes:', projects.length);
    res.json(projects);
  } catch (error) {
    console.error('❌ getProjects:', error.message);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// GET - Récupérer un projet par ID
// ============================================================================
exports.getProjectById = async (req, res) => {
  try {
    const id = Number(req.params.id);
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
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM projects WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = result.rows[0];

    // Attempt to load normalized project lines if tables exist
    try {
      const expLines = await pool.query(`
        SELECT id, description, category, projected_amount, actual_amount, transaction_date, is_paid, created_at
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
        SELECT id, description, category, projected_amount, actual_amount, transaction_date, is_received, created_at
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
      // If tables don't exist or any error occurs, ignore and fall back to JSON fields
      console.warn('⚠️ Normalized project lines not available or failed to load:', e.message);
    }

    res.json(project);
  } catch (error) {
    console.error('❌ getProjectById:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================================================
// HELPER : Sécuriser le format JSON pour la DB
// ============================================================================
const safeJson = (data) => {
  if (!data) return '[]'; // Défaut
  if (typeof data === 'string') return data; // Déjà stringifié
  try {
    return JSON.stringify(data); // Convertir Array/Object -> String
  } catch {
    return '[]';
  }
};

// ============================================================================
// 2. POST - Créer un nouveau projet
// ============================================================================
exports.createProject = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      name, description, type, status, startDate, endDate, frequency, occurrencesCount,
      totalCost, totalRevenues, netProfit, roi,
      expenses, revenues, allocation, revenueAllocation, revenue_allocation,
      remainingBudget, totalAvailable
    } = req.body;

    const finalStatus = status || 'draft';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};

    const expensesJson = safeJson(expenses);
    const revenuesJson = safeJson(revenues);
    const allocationJson = safeJson(allocation);
    const revAllocationJson = safeJson(finalRevenueAllocation);

    // 1. Créer le projet
    const projectResult = await client.query(
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
       RETURNING id, name, description, type, status,
         start_date AS "startDate", end_date AS "endDate",
         frequency, occurrences_count AS "occurrencesCount",
         total_cost AS "totalCost", total_revenues AS "totalRevenues",
         net_profit AS "netProfit", roi,
         remaining_budget AS "remainingBudget", total_available AS "totalAvailable",
         expenses, revenues, allocation, revenue_allocation AS "revenueAllocation",
         created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        name, description, type || 'ponctuel', finalStatus,
        startDate || null, endDate || null, frequency || null, occCount,
        parseFloat(totalCost || 0), parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0), parseFloat(roi || 0),
        parseFloat(remainingBudget || 0), parseFloat(totalAvailable || 0),
        expensesJson, revenuesJson, allocationJson, revAllocationJson
      ]
    );
    
    const projectId = projectResult.rows[0].id;
    
    // ✅ 2. Insérer les lignes normalisées si elles existent
    const expensesArray = Array.isArray(expenses) ? expenses : [];
    const revenuesArray = Array.isArray(revenues) ? revenues : [];
    
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
          null, // transaction_date
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
    
    // Recharger le projet avec les lignes
    const fullProject = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [projectId]
    );
    
    res.status(201).json(fullProject.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ CREATE project:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  } finally {
    client.release();
  }
};

// ============================================================================
// 3. PUT - Mettre à jour un projet
// ============================================================================
// controllers/projectController.js

// ... (le début du fichier reste identique)

// ============================================================================
// 3. PUT - Mettre à jour un projet (AVEC SUPPRESSION DES LIGNES SUPPRIMÉES)
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
      remainingBudget, totalAvailable
    } = req.body;

    const finalStatus = status || 'active';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};

    const expensesJson = safeJson(expenses);
    const revenuesJson = safeJson(revenues);
    const allocationJson = safeJson(allocation);
    const revAllocationJson = safeJson(finalRevenueAllocation);

    // 1. Mise à jour Projet principal
    const result = await client.query(
      `UPDATE projects 
       SET name=$1, description=$2, type=$3, status=$4, start_date=$5, end_date=$6,
           frequency=$7, occurrences_count=$8, total_cost=$9, total_revenues=$10,
           net_profit=$11, roi=$12, remaining_budget=$13, total_available=$14,
           expenses=$15::jsonb, revenues=$16::jsonb, allocation=$17::jsonb, 
           revenue_allocation=$18::jsonb, updated_at=NOW()
       WHERE id=$19
       RETURNING *`,
      [
        name, description, type, finalStatus, startDate || null, endDate || null,
        frequency || null, occCount, parseFloat(totalCost || 0), parseFloat(totalRevenues || 0),
        parseFloat(netProfit || 0), parseFloat(roi || 0), parseFloat(remainingBudget || 0),
        parseFloat(totalAvailable || 0), expensesJson, revenuesJson, allocationJson, revAllocationJson, id
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

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
           SET description=$1, category=$2, projected_amount=$3, is_paid=$4
           WHERE id=$5`,
          [
            item.description || '', 
            item.category || 'Autre', 
            parseFloat(item.amount || 0), 
            item.isPaid || false,
            parseInt(item.id)
          ]
        );
      } else {
        // Si l'ID est un UUID (nouveau du frontend)
        await client.query(
          `INSERT INTO project_expense_lines 
           (project_id, description, category, projected_amount, actual_amount, is_paid)
           VALUES ($1, $2, $3, $4, 0, $5)`,
          [
            id, 
            item.description || '', 
            item.category || 'Autre', 
            parseFloat(item.amount || 0),
            item.isPaid || false
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
           SET description=$1, category=$2, projected_amount=$3, is_received=$4
           WHERE id=$5`,
          [
            item.description || '', 
            item.category || 'Autre', 
            parseFloat(item.amount || 0), 
            item.isPaid || item.isReceived || false,
            parseInt(item.id)
          ]
        );
      } else {
        await client.query(
          `INSERT INTO project_revenue_lines 
           (project_id, description, category, projected_amount, actual_amount, is_received)
           VALUES ($1, $2, $3, $4, 0, $5)`,
          [
            id, 
            item.description || '', 
            item.category || 'Autre', 
            parseFloat(item.amount || 0),
            item.isPaid || item.isReceived || false
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
    // Mise à jour simple du statut uniquement
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
