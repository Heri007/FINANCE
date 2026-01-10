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
const syncProjectLinesFromJson = async (client, project_id, rawExpenses, rawRevenues) => {
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
        project_id,
        exp.description || '',
        exp.category || 'Projet - Charge',
        Number(exp.amount || 0),
        exp.actual_amount != null ? Number(exp.actual_amount) : null,
        exp.plannedDate,                 // "YYYY-MM-DD"
        exp.is_paid === true,
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
        project_id,
        rev.description || '',
        rev.category || 'Projet - Revenu',
        Number(rev.amount || 0),
        rev.actual_amount != null ? Number(rev.actual_amount) : null,
        rev.plannedDate,
        rev.is_paid === true,
      ]
    );
  }
};


// ============================================================================
// HELPER : Recalculer automatiquement les totaux d'un projet
// ============================================================================
const recalculateProjectTotals = async (client, project_id) => {
  try {
    console.log(`🔄 Recalcul des totaux pour le projet ${project_id}`);

    // 1. Calculer les totaux des dépenses
    const expensesResult = await client.query(
      `SELECT 
        COALESCE(SUM(projected_amount), 0) as total_projected,
        COALESCE(SUM(actual_amount), 0) as total_actual,
        COUNT(*) FILTER (WHERE is_paid = true) as paid_count,
        COUNT(*) as total_count
      FROM project_expense_lines 
      WHERE project_id = $1`,
      [project_id]
    );

    // 2. Calculer les totaux des revenus
    const revenuesResult = await client.query(
      `SELECT 
        COALESCE(SUM(projected_amount), 0) as total_projected,
        COALESCE(SUM(actual_amount), 0) as total_actual,
        COUNT(*) FILTER (WHERE is_received = true) as received_count,
        COUNT(*) as total_count
      FROM project_revenue_lines 
      WHERE project_id = $1`,
      [project_id]
    );

    const expData = expensesResult.rows[0];
    const revData = revenuesResult.rows[0];

    // 3. Calculs
    const totalCost = parseFloat(expData.total_projected || 0);
    const totalRevenues = parseFloat(revData.total_projected || 0);
    const netProfit = totalRevenues - totalCost;
    const roi = totalCost > 0 ? parseFloat(((netProfit / totalCost) * 100).toFixed(2)) : 0;
    const actualCost = parseFloat(expData.total_actual || 0);
    const remainingBudget = totalCost - actualCost;

    // 4. Mise à jour
    await client.query(
      `UPDATE projects 
       SET 
         total_cost = $1,
         total_revenues = $2,
         net_profit = $3,
         roi = $4,
         remaining_budget = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [totalCost, totalRevenues, netProfit, roi, remainingBudget, project_id]
    );

    console.log(`  ✅ Totaux: Coût=${totalCost} Ar, Revenus=${totalRevenues} Ar, ROI=${roi}%`);

    return {
      totalCost,
      totalRevenues,
      netProfit,
      roi,
      remainingBudget,
      expenseCount: parseInt(expData.total_count),
      revenueCount: parseInt(revData.total_count)
    };

  } catch (error) {
    console.error('❌ Erreur recalculateProjectTotals:', error);
    throw error;
  }
};

// ============================================================================
// 1. GET - Récupérer tous les projets avec synchronisation JSON/Lignes
// ============================================================================

/**
 * 🔄 HELPER: Synchronise le JSON avec les lignes normalisées
 */
const syncJsonWithNormalizedLines = (projectExpensesJson, projectRevenuesJson, expenseLines, revenueLines) => {
  // Parse expenses JSON
  let expenses = [];
  try {
    if (Array.isArray(projectExpensesJson)) {
      expenses = projectExpensesJson;
    } else if (typeof projectExpensesJson === 'string') {
      expenses = JSON.parse(projectExpensesJson);
    } else if (projectExpensesJson && typeof projectExpensesJson === 'object') {
      expenses = JSON.parse(JSON.stringify(projectExpensesJson));
    }
  } catch (e) {
    console.warn('⚠️ Erreur parsing expenses:', e.message);
    expenses = [];
  }
  
  // Parse revenues JSON
  let revenues = [];
  try {
    if (Array.isArray(projectRevenuesJson)) {
      revenues = projectRevenuesJson;
    } else if (typeof projectRevenuesJson === 'string') {
      revenues = JSON.parse(projectRevenuesJson);
    } else if (projectRevenuesJson && typeof projectRevenuesJson === 'object') {
      revenues = JSON.parse(JSON.stringify(projectRevenuesJson));
    }
  } catch (e) {
    console.warn('⚠️ Erreur parsing revenues:', e.message);
    revenues = [];
  }
  
  // Synchroniser expenses
  const syncedExpenses = expenses.map(exp => {
    const normalizedLine = expenseLines.find(
      line => line.id && exp.dbLineId && 
              line.id.toString() === exp.dbLineId.toString()
    );
    
    if (normalizedLine) {
      return {
        ...exp,
        is_paid: normalizedLine.is_paid,
        actual_amount: normalizedLine.actual_amount,
        transaction_date: normalizedLine.transaction_date
      };
    }
    return exp;
  });
  
  // Synchroniser revenues
  const syncedRevenues = revenues.map(rev => {
    const normalizedLine = revenueLines.find(
      line => line.id && rev.dbLineId &&
              line.id.toString() === rev.dbLineId.toString()
    );
    
    if (normalizedLine) {
      return {
        ...rev,
        isReceived: normalizedLine.isReceived,
        is_paid: normalizedLine.isReceived,
        actual_amount: normalizedLine.actual_amount,
        transaction_date: normalizedLine.transaction_date
      };
    }
    return rev;
  });
  
  return { expenses: syncedExpenses, revenues: syncedRevenues };
};


// ============================================================================
// 1. GET - Récupérer tous les projets avec mapping explicite
// ============================================================================
exports.getProjects = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, type, status, start_date, end_date, frequency,
              occurrences_count, total_cost, total_revenues, net_profit, roi,
              remaining_budget, total_available, expenses, revenues, allocation,
              revenue_allocation, metadata, created_at, updated_at
       FROM projects
       ORDER BY created_at DESC`
    );
    
    const projects = await Promise.all(result.rows.map(async (project) => {
      // Corriger metadata invalide
      let cleanMetadata = project.metadata;
      if (Array.isArray(cleanMetadata) && cleanMetadata.length === 0) {
        console.warn(`⚠️ Correction metadata pour projet ${project.id}`);
        cleanMetadata = {};
        await pool.query(
          `UPDATE projects SET metadata = $1 WHERE id = $2`,
          ['{}', project.id]
        );
      }
      
      // Charger les lignes normalisées
      const expLines = await pool.query(
        `SELECT id, description, category, projected_amount, actual_amount,
                transaction_date, is_paid
         FROM project_expense_lines
         WHERE project_id = $1 ORDER BY id ASC`,
        [project.id]
      );
      
      const revLines = await pool.query(
        `SELECT id, description, category, projected_amount, actual_amount,
                transaction_date, is_received
         FROM project_revenue_lines
         WHERE project_id = $1 ORDER BY id ASC`,
        [project.id]
      );
      
      // Mapper les lignes normalisées
      const expenseLines = expLines.rows.map(r => ({
        id: r.id,
        description: r.description,
        category: r.category,
        projectedAmount: parseFloat(r.projected_amount || 0),
        actual_amount: parseFloat(r.actual_amount || 0),
        transaction_date: r.transaction_date,
        is_paid: !!r.is_paid
      }));
      
      const revenueLines = revLines.rows.map(r => ({
        id: r.id,
        description: r.description,
        category: r.category,
        projectedAmount: parseFloat(r.projected_amount || 0),
        actual_amount: parseFloat(r.actual_amount || 0),
        transaction_date: r.transaction_date,
        isReceived: !!r.is_received
      }));
      
      // ✅ SYNCHRONISER le JSON avec les lignes
      const { expenses, revenues } = syncJsonWithNormalizedLines(
        project.expenses,
        project.revenues,
        expenseLines,
        revenueLines
      );
      
      // Log pour debug
      if (project.id === 24) {
        const paidCount = expenses.filter(e => e.is_paid).length;
        console.log(`🐔 Natiora (projet 24):`);
        console.log(`  - expenseLines: ${expenseLines.length} lignes`);
        console.log(`  - expenses JSON: ${expenses.length} items, ${paidCount} payés`);
      }
      
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
        totalCost: parseFloat(project.total_cost || 0),
        totalRevenues: parseFloat(project.total_revenues || 0),
        netProfit: parseFloat(project.net_profit || 0),
        roi: parseFloat(project.roi || 0),
        remainingBudget: parseFloat(project.remaining_budget || 0),
        totalAvailable: parseFloat(project.total_available || 0),
        
        // ✅ Exposer les lignes normalisées (OBLIGATOIRE!)
        expenseLines,
        revenueLines,
        
        // ✅ JSON synchronisé
        expenses,
        revenues,
        
        allocation: project.allocation,
        revenueAllocation: project.revenue_allocation,
        metadata: cleanMetadata,
        createdAt: project.created_at,
        updatedAt: project.updated_at
      };
    }));
    
    console.log(`✅ ${projects.length} projets récupérés avec JSON synchronisé`);
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
    
    const result = await pool.query(
      `SELECT id, name, description, type, status, start_date AS startDate,
              end_date AS endDate, frequency, occurrences_count AS occurrencesCount,
              CAST(total_cost AS DOUBLE PRECISION) AS totalCost,
              CAST(total_revenues AS DOUBLE PRECISION) AS totalRevenues,
              net_profit AS netProfit, roi, remaining_budget AS remainingBudget,
              total_available AS totalAvailable, expenses, revenues, allocation,
              revenue_allocation AS revenueAllocation, metadata,
              created_at AS createdAt, updated_at AS updatedAt
       FROM projects WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    const project = result.rows[0];
    
    // Charger les lignes normalisées
    try {
      const expLines = await pool.query(
        `SELECT id, description, category, projected_amount, actual_amount,
                transaction_date, is_paid, created_at
         FROM project_expense_lines
         WHERE project_id = $1 ORDER BY id ASC`,
        [id]
      );
      
      const revLines = await pool.query(
        `SELECT id, description, category, projected_amount, actual_amount,
                transaction_date, is_received, created_at
         FROM project_revenue_lines
         WHERE project_id = $1 ORDER BY id ASC`,
        [id]
      );
      
      if (expLines.rows && expLines.rows.length > 0) {
        project.expenseLines = expLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actual_amount: parseFloat(r.actual_amount || 0),
          transaction_date: r.transaction_date,
          is_paid: !!r.is_paid,
          createdAt: r.created_at
        }));
      }
      
      if (revLines.rows && revLines.rows.length > 0) {
        project.revenueLines = revLines.rows.map(r => ({
          id: r.id,
          description: r.description,
          category: r.category,
          projectedAmount: parseFloat(r.projected_amount || 0),
          actual_amount: parseFloat(r.actual_amount || 0),
          transaction_date: r.transaction_date,
          isReceived: !!r.is_received,
          createdAt: r.created_at
        }));
      }
      
      // ✅ AJOUT: Synchroniser le JSON
      if (project.expenseLines || project.revenueLines) {
        const { expenses, revenues } = syncJsonWithNormalizedLines(
          project.expenses,
          project.revenues,
          project.expenseLines || [],
          project.revenueLines || []
        );
        
        project.expenses = expenses;
        project.revenues = revenues;
        
        console.log(`✅ Projet ${id} synchronisé: ${expenses.filter(e => e.is_paid).length} dépenses payées`);
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
    
    const project_id = projectResult.rows[0].id;
    
    // 2. Insérer les lignes normalisées si elles existent
    const expensesArray = Array.isArray(expenses) ? expenses : (expenses ? JSON.parse(expenses) : []);
    const revenuesArray = Array.isArray(revenues) ? revenues : (revenues ? JSON.parse(revenues) : []);
    
    for (const expense of expensesArray) {
      await client.query(`
    INSERT INTO project_expense_lines (
      project_id, description, category, projected_amount, 
      actual_amount, transaction_date, is_paid
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (project_id, description, projected_amount) 
    DO UPDATE SET 
      category = EXCLUDED.category,
      transaction_date = EXCLUDED.transaction_date
  `,
        [
          project_id,
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
          project_id,
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
    
    const metadataJson = safeJson(metadata); 
    const finalStatus = status || 'active';
    const occCount = parseInt(occurrencesCount || 1, 10);
    const finalRevenueAllocation = revenue_allocation || revenueAllocation || {};
    
    const expensesJson = safeJsonArray(expenses);
    const revenuesJson = safeJsonArray(revenues);
    const allocationJson = safeJson(allocation);
    const revAllocationJson = safeJson(finalRevenueAllocation);
    
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
        expensesJson,
        revenuesJson,
        allocationJson, revAllocationJson,
        metadataJson,
        id
      ]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Projet non trouvé' });
    }
    
    // 2. GESTION INTELLIGENTE DES LIGNES AVEC AUTO-CRÉATION
    const expensesList = Array.isArray(expenses) ? expenses : JSON.parse(expenses || '[]');
    const revenuesList = Array.isArray(revenues) ? revenues : JSON.parse(revenues || '[]');
    
    // ============================================================================
// A. EXPENSES - Créer/Mettre à jour/Supprimer (CORRECTION FINALE)
// ============================================================================
const validExpenseIds = expensesList
  .map(e => e.dbLineId)
  .filter(dbId => dbId && (Number.isInteger(dbId) || /^\d+$/.test(dbId)))
  .map(dbId => parseInt(dbId, 10));

console.log(`🔍 Projet ${id}: ${validExpenseIds.length} expenses avec dbLineId valides sur ${expensesList.length}`);

if (validExpenseIds.length > 0) {
  await client.query(
    `DELETE FROM project_expense_lines 
     WHERE project_id = $1 AND id != ALL($2::int[])`,
    [id, validExpenseIds]
  );
  console.log(`🗑️ Lignes obsolètes supprimées (hors ${validExpenseIds.length} IDs)`);
}

const updatedExpenses = [];
for (const item of expensesList) {
  const hasValidDbLineId = item.dbLineId && 
    (Number.isInteger(item.dbLineId) || /^\d+$/.test(item.dbLineId));
  
  if (hasValidDbLineId) {
    try {
      // ✅ CORRECTION 1: Vérifier l'état actuel dans la DB
      const currentLine = await client.query(
        `SELECT is_paid, actual_amount FROM project_expense_lines WHERE id = $1`,
        [parseInt(item.dbLineId, 10)]
      );
      
      // ✅ Vérifier que la ligne existe
      if (currentLine.rows.length === 0) {
        console.warn(`⚠️ Ligne ${item.dbLineId} introuvable, passage en INSERT`);
        // Continuer avec INSERT ci-dessous
      } else {
        const isAlreadyPaid = currentLine.rows[0]?.is_paid;
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(item.description);
        
        updateFields.push(`category = $${paramIndex++}`);
        updateValues.push(item.category || 'Autre');
        
        updateFields.push(`projected_amount = $${paramIndex++}`);
        updateValues.push(parseFloat(item.amount) || 0);
        
        updateFields.push(`actual_amount = $${paramIndex++}`);
        updateValues.push(parseFloat(item.actualAmount) || 0);
        
        updateFields.push(`transaction_date = $${paramIndex++}`);
        updateValues.push(item.transaction_date || item.plannedDate || null);
        
        // ✅ NE METTRE À JOUR is_paid QUE si la ligne n'est PAS déjà payée
        if (!isAlreadyPaid && item.isPaid !== undefined && item.isPaid !== null) {
          updateFields.push(`is_paid = $${paramIndex++}`);
          updateValues.push(!!item.isPaid);
        }
        
        updateValues.push(parseInt(item.dbLineId, 10));
        
        await client.query(
          `UPDATE project_expense_lines 
           SET ${updateFields.join(', ')} 
           WHERE id = $${paramIndex}`,
          updateValues
        );
        
        updatedExpenses.push(item);
        continue; // ✅ Passer à l'itération suivante
      }
    } catch (err) {
      console.error(`❌ Erreur UPDATE ligne ${item.dbLineId}:`, err);
      // Continuer avec INSERT
    }
  }
  
  // ✅ INSERT nouvelle ligne (si pas de dbLineId OU si UPDATE a échoué)
  try {
    const insertResult = await client.query(`
      INSERT INTO project_expense_lines (
        project_id, description, category, projected_amount, 
        actual_amount, is_paid, transaction_date
      )
      VALUES ($1, $2, $3, $4, 0, false, $5)
      RETURNING *
    `, [
      id,
      item.description,
      item.category || 'Autre',
      parseFloat(item.amount || 0),
      item.transaction_date || item.plannedDate || null
    ]);
    
    // ✅ CORRECTION 2: Vérifier que insertResult.rows[0] existe
    if (!insertResult.rows || insertResult.rows.length === 0) {
      throw new Error(`Impossible de créer la ligne: ${item.description}`);
    }
    
    const newLine = insertResult.rows[0];
    const newDbLineId = newLine.id;
    
    console.log(`✅ Ligne expense créée: ${newDbLineId} - ${item.description}`);
    
    updatedExpenses.push({ 
      ...item, 
      dbLineId: newDbLineId.toString() 
    });
  } catch (insertErr) {
    console.error(`❌ Erreur INSERT ligne:`, insertErr);
    throw insertErr; // Arrêter la transaction
  }
}

// ============================================================================
// B. REVENUES - Créer/Mettre à jour
// ============================================================================
const validRevenueIds = revenuesList
  .map(r => r.dbLineId)
  .filter(dbId => dbId && (Number.isInteger(dbId) || /^\d+$/.test(dbId)))
  .map(dbId => parseInt(dbId, 10));

console.log(`🔍 Projet ${id}: ${validRevenueIds.length} revenues avec dbLineId valides sur ${revenuesList.length}`);

if (validRevenueIds.length > 0) {
  await client.query(
    `DELETE FROM project_revenue_lines 
     WHERE project_id = $1 AND id != ALL($2::int[])`,
    [id, validRevenueIds]
  );
  console.log(`🗑️ Lignes obsolètes supprimées (hors ${validRevenueIds.length} IDs)`);
}

const updatedRevenues = [];
for (const item of revenuesList) {
  const hasValidDbLineId = item.dbLineId && 
    (Number.isInteger(item.dbLineId) || /^\d+$/.test(item.dbLineId));

  if (hasValidDbLineId) {
    // ✅ UPDATE sans modifier is_received ni actual_amount
    await client.query(
      `UPDATE project_revenue_lines 
       SET description = $1, 
           category = $2, 
           projected_amount = $3, 
           transaction_date = $4
       WHERE id = $5`,
      [
        item.description || '',
        item.category || 'Autre',
        parseFloat(item.amount || 0),
        item.transaction_date || item.plannedDate || null,
        parseInt(item.dbLineId, 10)
      ]
    );
    
    console.log(`🔄 Ligne revenue ${item.dbLineId} mise à jour: "${item.description}"`);
    updatedRevenues.push(item);
    
  } else {
    // ✅ INSERT nouvelle ligne
    const insertResult = await client.query(
      `INSERT INTO project_revenue_lines 
       (project_id, description, category, projected_amount, actual_amount, is_received, transaction_date)
       VALUES ($1, $2, $3, $4, 0, false, $5)
       RETURNING id`,
      [
        id,
        item.description || '',
        item.category || 'Autre',
        parseFloat(item.amount || 0),
        item.transaction_date || item.plannedDate || null
      ]
    );
    
    // ✅ CORRECTION 3: Accès correct avec [0]
    if (!insertResult.rows || insertResult.rows.length === 0) {
      throw new Error(`Impossible de créer la ligne revenue: ${item.description}`);
    }
    
    const newDbLineId = insertResult.rows[0].id; // ✅ [0] ajouté
    
    if (!newDbLineId) {
      throw new Error(`ID de ligne revenue manquant pour: ${item.description}`);
    }
    
    console.log(`✅ Ligne revenue créée: ${newDbLineId} - ${item.description}`);
    
    updatedRevenues.push({
      ...item,
      dbLineId: newDbLineId.toString()
    });
  }
}
    
    // ✅ MISE À JOUR FINALE DU JSON AVEC LES NOUVEAUX dbLineId
    await client.query(
      `UPDATE projects 
       SET expenses = $1::jsonb, revenues = $2::jsonb 
       WHERE id = $3`,
      [JSON.stringify(updatedExpenses), JSON.stringify(updatedRevenues), id]
    );
    
    await client.query('COMMIT');
    
    // Renvoyer le projet mis à jour
    const updatedProject = await client.query('SELECT * FROM projects WHERE id = $1', [id]);
    res.json(updatedProject.rows);
    
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

    // ✅ Vérifier que toutes les lignes sont payées/reçues
  const unpaidExpenses = await pool.query(`
    SELECT COUNT(*) as count FROM project_expense_lines
    WHERE project_id = $1 AND is_paid = false
  `, [id]);
  
  if (unpaidExpenses.rows[0].count > 0) {
    return res.status(400).json({
      error: 'Impossible de compléter: ' + unpaidExpenses.rows[0].count + ' dépenses non payées'
    });
  }
    
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
    const result = await pool.query(
  `SELECT pel.id, pel.project_id as projectId, pel.description, pel.category,
          pel.projected_amount as projectedAmount, pel.actual_amount as actualAmount,
          pel.transaction_date as transactionDate, pel.is_paid as isPaid,
          pel.created_at as createdAt, p.name as projectName
   FROM project_expense_lines pel
   JOIN projects p ON p.id = pel.project_id
   WHERE pel.is_paid = false
   AND p.status = 'active'
   ORDER BY COALESCE(pel.transaction_date, '9999-12-31'::date) ASC, pel.created_at ASC`
);
    
    console.log('📊 Unpaid expenses récupérées:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getUnpaidExpenses:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// POST /api/projects/:project_id/expense-lines - Créer une nouvelle ligne de dépense
exports.createExpenseLine = async (req, res) => {
  try {
    // ✅ CORRECTION: Utiliser req.params.id au lieu de req.params.project_id
    const project_id = parseInt(req.params.id, 10);
    
    if (!project_id || isNaN(project_id)) {
      return res.status(400).json({ error: 'ID projet invalide' });
    }

    const { description, category, projectedamount, actual_amount, transaction_date, is_paid } = req.body;

    console.log('📝 Création expense line:', {
      project_id,  // ✅ Maintenant défini
      description,
      projectedamount
    });

    const result = await pool.query(
      `INSERT INTO project_expense_lines (
        project_id, description, category, projected_amount, 
        actual_amount, transaction_date, is_paid, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING *`,
      [
        project_id,  // ✅ Toujours un integer valide
        description,
        category || 'Administratif',
        projectedamount,
        actual_amount || 0,
        transaction_date || new Date(),
        is_paid || false
      ]
    );

    const createdLine = result.rows[0];
    console.log('✅ Expense line créée:', createdLine.id, '-', createdLine.description);
    
    res.status(201).json(createdLine);  // ✅ Retourne l'objet complet
    
  } catch (error) {
    console.error('❌ Erreur création expense line:', error);
    res.status(500).json({ error: error.message });
  }
};

// Créer une ligne de revenu
exports.createRevenueLine = async (req, res) => {
  try {
    // ✅ CORRECTION: Même fix
    const project_id = parseInt(req.params.id, 10);
    
    if (!project_id || isNaN(project_id)) {
      return res.status(400).json({ error: 'ID projet invalide' });
    }

    const { description, category, projectedamount, actual_amount, transaction_date, isreceived } = req.body;

    console.log('📝 Création revenue line:', {
      project_id,
      description,
      projectedamount
    });

    const result = await pool.query(
      `INSERT INTO project_revenue_lines (
        project_id, description, category, projected_amount, 
        actual_amount, transaction_date, is_received, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
      RETURNING *`,
      [
        project_id,
        description,
        category || 'Non catégorisé',
        projectedamount,
        actual_amount || 0,
        transaction_date || new Date(),
        isreceived || false
      ]
    );

    const createdLine = result.rows[0];
    console.log('✅ Revenue line créée:', createdLine.id, '-', createdLine.description);
    
    res.status(201).json(createdLine);
    
  } catch (error) {
    console.error('❌ Erreur création revenue line:', error);
    res.status(500).json({ error: error.message });
  }
};

/// Marquer une ligne de dépense comme payée
exports.markExpenseLinePaid = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const projectId = parseInt(req.params.id, 10);
    const lineId = parseInt(req.params.lineId, 10);
    const { paid_externally, create_transaction, amount, paid_date, account_id } = req.body;

    console.log('📥 markExpenseLinePaid - Payload:', {
      projectId,
      lineId,
      paid_externally,
      create_transaction,
      amount,
      paid_date,
      account_id
    });

    // ✅ Validations
    if (!projectId || isNaN(projectId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'projectId invalide ou manquant'
      });
    }

    if (!lineId || isNaN(lineId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'lineId invalide ou manquant'
      });
    }

    if (!amount || isNaN(parseFloat(amount))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'amount invalide ou manquant'
      });
    }

    // Vérifier la ligne
    const lineRes = await client.query(
      `SELECT * FROM project_expense_lines WHERE id = $1 AND project_id = $2`,
      [lineId, projectId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne introuvable' });
    }

    const line = lineRes.rows[0];

    // ✅ IDEMPOTENCE: Si déjà payée, mettre à jour quand même
    if (line.is_paid) { // ✅ CORRECTION: is_paid
      console.warn(`⚠️ Ligne ${lineId} déjà payée - mise à jour forcée`);
      
      if (paid_externally === true) {
        await client.query(
          `UPDATE project_expense_lines 
           SET actual_amount = $1, 
               transaction_date = $2,
               last_synced_at = NOW()
           WHERE id = $3`,
          [parseFloat(amount), paid_date || new Date().toISOString().split('T')[0], lineId]
        );
        await client.query('COMMIT');
        return res.json({ 
          success: true, 
          message: 'Dépense mise à jour',
          alreadyPaid: true 
        });
      }
    }

    // CAS 1: Paiement externe
    if (paid_externally === true) {
      await client.query(
        `UPDATE project_expense_lines 
         SET is_paid = true, 
             actual_amount = $1, 
             transaction_date = $2,
             last_synced_at = NOW()
         WHERE id = $3`,
        [parseFloat(amount), paid_date || new Date().toISOString().split('T')[0], lineId]
      );
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Dépense payée' });
    }

    // CAS 2: Créer une transaction
    if (create_transaction === true) {
      if (!account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Paramètres invalides',
          details: 'account_id requis pour create_transaction' 
        });
      }

      // ✅ VÉRIFIER SI UNE TRANSACTION EXISTE DÉJÀ
  const existingTx = await client.query(
    `SELECT id FROM transactions 
     WHERE account_id = $1 
     AND transaction_date = $2 
     AND amount = $3 
     AND description = $4 
     AND type = 'expense'`,
    [parseInt(account_id), paid_date || new Date().toISOString().split('T')[0],
     parseFloat(amount), line.description]
  );

  if (existingTx.rows.length > 0) {
    // Transaction existe déjà, juste mettre à jour la ligne
    await client.query(
      `UPDATE projectexpenselines 
       SET ispaid = true, actualamount = $1, transaction_date = $2, 
           transactionid = $3
       WHERE id = $4`,
      [parseFloat(amount), paid_date || new Date().toISOString().split('T')[0], 
       existingTx.rows[0].id, lineId]
    );

    await client.query('COMMIT');
    return res.json({ 
      success: true, 
      message: '✅ Ligne mise à jour avec transaction existante' 
    });
  }
      // Créer la transaction
      const txResult = await client.query(
        `INSERT INTO transactions 
         (account_id, type, amount, category, description, transaction_date, is_planned, is_posted, project_id, project_line_id)
         VALUES ($1, 'expense', $2, $3, $4, $5, false, true, $6, $7)
         RETURNING *`,
        [
          parseInt(account_id),
          -Math.abs(parseFloat(amount)), // ✅ Négatif pour expense
          line.category || 'Projet',
          line.description,
          paid_date || new Date().toISOString().split('T')[0],
          projectId,
          lineId.toString()
        ]
      );

      // Débiter le compte
      await client.query(
        `UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2`,
        [Math.abs(parseFloat(amount)), parseInt(account_id)]
      );

      // Mettre à jour la ligne
      await client.query(
        `UPDATE project_expense_lines 
         SET is_paid = true, 
             actual_amount = $1, 
             transaction_date = $2, 
             transaction_id = $3,
             last_synced_at = NOW()
         WHERE id = $4`,
        [parseFloat(amount), paid_date || new Date().toISOString().split('T')[0], txResult.rows[0].id, lineId]
      );

      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'Transaction créée',
        transactionId: txResult.rows[0].id 
      });
    }

    // Aucune action valide
    await client.query('ROLLBACK');
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      details: 'Spécifiez paid_externally=true OU create_transaction=true'
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur markExpenseLinePaid:', error);
    next(error);
  } finally {
    client.release();
  }
};

// Marquer une ligne de revenu comme reçue
exports.markRevenueLineReceived = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const projectid = parseInt(req.params.id, 10);
    const lineId = parseInt(req.params.lineId, 10); // ✅ INTEGER pour revenue_lines aussi
    const { receivedexternally, create_transaction, amount, receiveddate, account_id } = req.body;

    console.log('📥 markRevenueLineReceived - Payload:', {
      projectid,
      lineId,
      receivedexternally,
      create_transaction,
      amount,
      receiveddate,
      account_id
    });

    // Validations
    if (!projectid || isNaN(projectid)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'projectid invalide' 
      });
    }

    if (!lineId || isNaN(lineId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'lineId manquant ou invalide' 
      });
    }

    if (!amount || isNaN(parseFloat(amount))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Paramètres invalides',
        details: 'amount invalide' 
      });
    }

    // Vérifier la ligne (✅ INTEGER, pas UUID)
    const lineRes = await client.query(
      `SELECT * FROM project_revenue_lines WHERE id = $1 AND project_id = $2`,
      [lineId, projectid]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ligne de revenu introuvable' });
    }

    const line = lineRes.rows[0];

    // ✅ IDEMPOTENCE
    if (line.is_received) {
      console.warn(`⚠️ Ligne ${lineId} déjà reçue - mise à jour forcée`);
      
      if (receivedexternally === true) {
        await client.query(
          `UPDATE project_revenue_lines 
           SET actual_amount = $1, 
               transaction_date = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [parseFloat(amount), receiveddate || new Date().toISOString().split('T')[0], lineId]
        );
        await client.query('COMMIT');
        return res.json({ 
          success: true, 
          message: 'Revenu mis à jour',
          alreadyReceived: true,
          lineid: lineId 
        });
      }
    }

    // CAS 1: Encaissement externe
    if (receivedexternally === true) {
      await client.query(
        `UPDATE project_revenue_lines 
         SET is_received = true, 
             actual_amount = $1, 
             transaction_date = $2, 
             updated_at = NOW()
         WHERE id = $3`,
        [parseFloat(amount), receiveddate || new Date().toISOString().split('T')[0], lineId]
      );
      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'Revenu marqué comme reçu externe',
        lineid: lineId 
      });
    }

    // CAS 2: Créer une transaction
    if (create_transaction === true) {
      if (!account_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Paramètres invalides',
          details: 'account_id requis' 
        });
      }

      const txResult = await client.query(
        `INSERT INTO transactions 
         (account_id, type, amount, category, description, transaction_date, is_planned, is_posted, project_id, project_line_id)
         VALUES ($1, 'income', $2, $3, $4, $5, false, true, $6, $7)
         RETURNING *`,
        [
          parseInt(account_id),
          parseFloat(amount), // ✅ Positif pour income
          line.category || 'Projet - Revenu',
          line.description || 'Encaissement revenu projet',
          receiveddate || new Date().toISOString().split('T')[0],
          projectid,
          lineId.toString()
        ]
      );

      const transaction = txResult.rows[0];

      // Créditer le compte
      await client.query(
        `UPDATE accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
        [parseFloat(amount), parseInt(account_id)]
      );

      // Mettre à jour la ligne
      await client.query(
        `UPDATE project_revenue_lines 
         SET is_received = true, 
             actual_amount = $1, 
             transaction_date = $2, 
             transaction_id = $3, 
             updated_at = NOW()
         WHERE id = $4`,
        [parseFloat(amount), receiveddate || new Date().toISOString().split('T')[0], transaction.id, lineId]
      );

      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'Transaction créée et revenu marqué comme reçu',
        transactionid: transaction.id,
        lineid: lineId 
      });
    }

    await client.query('ROLLBACK');
    return res.status(400).json({ 
      error: 'Paramètres invalides',
      details: 'Spécifiez receivedexternally=true OU create_transaction=true' 
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Erreur markRevenueLineReceived:', error);
    next(error);
  } finally {
    client.release();
  }
};

// Annuler le paiement d'une ligne de dépense
exports.cancelExpenseLinePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    const projectid = parseInt(req.params.id, 10);
    const lineId = parseInt(req.params.lineId, 10);

    console.log('📥 cancelExpenseLinePayment appelé:', { projectid, lineId });

    await client.query('BEGIN');

    const lineRes = await client.query(
      `SELECT * FROM project_expense_lines WHERE id = $1 AND project_id = $2`,
      [lineId, projectid]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ligne de dépense introuvable' });
    }

    const line = lineRes.rows[0];
    console.log('✅ Ligne trouvée:', line.description);

    // Si une transaction existe, la supprimer et recréditer le compte
    if (line.transaction_id) {
      console.log('🔄 Suppression transaction et recrédit compte...');
      
      const txRes = await client.query(
        `SELECT * FROM transactions WHERE id = $1`,
        [line.transaction_id]
      );

      if (txRes.rows.length > 0) {
        const transaction = txRes.rows[0];
        
        // Annuler l'impact sur le solde
        if (transaction.is_posted) {
          await client.query(
            `UPDATE accounts 
             SET balance = balance + $1, updated_at = NOW() 
             WHERE id = $2`,
            [Math.abs(transaction.amount), transaction.account_id]
          );
          console.log('✅ Compte recrédité:', transaction.account_id, Math.abs(transaction.amount));
        }

        // Supprimer la transaction
        await client.query(`DELETE FROM transactions WHERE id = $1`, [line.transaction_id]);
        console.log('✅ Transaction supprimée:', line.transaction_id);
      }
    }

    // Remettre la ligne en état non payé
    await client.query(
      `UPDATE project_expense_lines 
       SET is_paid = FALSE, 
           actual_amount = 0, 
           transaction_date = NULL, 
           transaction_id = NULL, 
           last_synced_at = NOW()
       WHERE id = $1`,
      [lineId]
    );

    console.log('✅ Ligne remise à zéro');

    await client.query('COMMIT');
    console.log('✅ COMMIT');

    res.json({ 
      success: true, 
      message: 'Paiement annulé avec succès',
      transactionDeleted: !!line.transaction_id 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur cancelExpenseLinePayment:', error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// Annuler la réception d'une ligne de revenu
exports.cancelRevenueLineReceipt = async (req, res) => {
  const client = await pool.connect();
  try {
    const project_id = parseInt(req.params.id, 10);
    const lineId = parseInt(req.params.lineId, 10); // ✅ INTEGER
    
    console.log('🔵 cancelRevenueLineReceipt appelé');
    console.log('📦 Données:', { project_id, lineId });

    await client.query('BEGIN');

    // ✅ INTEGER, pas UUID
    const lineRes = await client.query(
      'SELECT * FROM project_revenue_lines WHERE id = $1 AND project_id = $2',
      [lineId, project_id]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Ligne de revenu introuvable' });
    }

    const line = lineRes.rows[0];
    console.log('✅ Ligne trouvée:', line.description);

    // Si une transaction existe, la supprimer et débiter le compte
    if (line.transaction_id) {
      console.log('🔄 Suppression transaction et débit compte...');
      
      const txRes = await client.query(
        'SELECT * FROM transactions WHERE id = $1',
        [line.transaction_id]
      );

      if (txRes.rows.length > 0) {
        const transaction = txRes.rows[0];
        
        // Annuler l'impact sur le solde (income = crédit, donc on débite)
        if (transaction.is_posted) {
          await client.query(
            'UPDATE accounts SET balance = balance - $1, updated_at = NOW() WHERE id = $2',
            [transaction.amount, transaction.account_id]
          );
          console.log('✅ Compte débité:', transaction.account_id, transaction.amount);
        }

        // Supprimer la transaction
        await client.query('DELETE FROM transactions WHERE id = $1', [line.transaction_id]);
        console.log('✅ Transaction supprimée:', line.transaction_id);
      }
    }

    // ✅ Remettre la ligne en état "non reçu"
    await client.query(
      `UPDATE project_revenue_lines 
       SET 
         is_received = FALSE, 
         actual_amount = 0, 
         transaction_date = NULL, 
         transaction_id = NULL,
         last_synced_at = NOW()
       WHERE id = $1`,
      [lineId]
    );

    console.log('✅ Ligne remise à zéro');

    await client.query('COMMIT');
    console.log('✅ COMMIT');

    res.json({
      success: true,
      message: 'Encaissement annulé avec succès',
      transactionDeleted: !!line.transaction_id
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur cancelRevenueLineReceipt:', error);
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
};

// ✅ NOUVEAU dans projectController.js
exports.cancelExpensePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    // ✅ CORRECTION: Extraire correctement les paramètres
    const project_id = parseInt(req.params.id, 10);
    const lineId = req.params.lineId; // ✅ UUID, pas parseInt
    
    await client.query('BEGIN');
    
    // ✅ Réinitialiser le statut de paiement (avec cast UUID)
    const result = await client.query(
      `UPDATE project_expense_lines
       SET is_paid = FALSE,
           actual_amount = 0,
           transaction_id = NULL,
           transaction_date = NULL,
           last_synced_at = NOW()
       WHERE id = $1::uuid AND project_id = $2
       RETURNING *`,
      [lineId, project_id]
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
        prl.project_id as "projectId",           -- ✅ CORRIGÉ
        prl.description,
        prl.category,
        prl.projected_amount as "projectedAmount",
        prl.actual_amount as "actualAmount",      -- ✅ CORRIGÉ
        prl.transaction_date as "transactionDate", -- ✅ CORRIGÉ
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
    const project_id = Number(req.params.id);
    
    const result = await pool.query(`
      SELECT 
        id,
        project_id as "project_id",
        description,
        category,
        projected_amount as "projectedAmount",
        actual_amount as "actual_amount",
        transaction_date as "transaction_date",
        is_paid as "is_paid",
        created_at as "createdAt",
        last_synced_at as "lastSyncedAt"
      FROM project_expense_lines
      WHERE project_id = $1
      ORDER BY id ASC
    `, [project_id]);
    
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
    const project_id = Number(req.params.id);
    
    const result = await pool.query(`
      SELECT 
        id,
        project_id as "project_id",
        description,
        category,
        projected_amount as "projectedAmount",
        actual_amount as "actual_amount",
        transaction_date as "transaction_date",
        is_received as "isReceived",
        created_at as "createdAt",
        last_synced_at as "lastSyncedAt"
      FROM project_revenue_lines
      WHERE project_id = $1
      ORDER BY id ASC
    `, [project_id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('❌ getProjectRevenueLines:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// ============================================================================
// RECALCUL DES TOTAUX (endpoints publics)
// ============================================================================
exports.recalculateTotals = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const projectCheck = await client.query(
      'SELECT id, name, total_cost, total_revenues FROM projects WHERE id = $1',
      [id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Projet introuvable' });
    }

    const project = projectCheck.rows[0];
    await client.query('BEGIN');
    
    const newTotals = await recalculateProjectTotals(client, id);
    
    await client.query('COMMIT');

    res.json({
      success: true,
      project_id: id,
      projectName: project.name,
      newTotals
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur recalculateTotals:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.recalculateAllTotals = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔄 Recalcul de tous les totaux de projets...');

    const projectsResult = await client.query(
      'SELECT id, name FROM projects ORDER BY id ASC'
    );

    await client.query('BEGIN');

    const results = [];

    for (const project of projectsResult.rows) {
      const newTotals = await recalculateProjectTotals(client, project.id);
      results.push({
        project_id: project.id,
        projectName: project.name,
        newTotals
      });
    }

    await client.query('COMMIT');

    console.log(`✅ ${results.length} projets recalculés`);

    res.json({ 
      success: true, 
      results, 
      totalProjects: results.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur recalculateAllTotals:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};