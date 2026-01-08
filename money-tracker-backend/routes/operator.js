// routes/operator.js - VERSION CORRIGÉE snake_case
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validate } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Middleware UTF-8
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ============================================================================
// ROUTES SOPs (Standardized Procedure)
// ============================================================================

// GET ALL
router.get('/sops', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sops ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /sops:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET ONE
router.get('/sops/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sops WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'SOP introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST
router.post('/sops', validate('sop'), async (req, res) => {
  const { 
    title, description, owner, steps, avg_time, 
    status, category, checklist, project_id, last_review 
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO sops (
        title, description, owner, steps, avg_time, 
        status, category, checklist, project_id, last_review
      ) 
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10) 
      RETURNING *`,
      [
        title, 
        description, 
        owner, 
        JSON.stringify(steps || []), 
        avg_time || 0, 
        status || 'draft', 
        category || 'Général', 
        JSON.stringify(checklist || []),
        project_id || null,
        last_review || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ POST /sops:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT (Mise à jour complète ou partielle)
router.put('/sops/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    title, description, owner, steps, avg_time, 
    status, category, checklist, project_id, last_review 
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE sops 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         owner = COALESCE($3, owner),
         steps = CASE WHEN $4 IS NOT NULL THEN $4::jsonb ELSE steps END,
         avg_time = COALESCE($5, avg_time),
         status = COALESCE($6, status),
         category = COALESCE($7, category),
         checklist = CASE WHEN $8 IS NOT NULL THEN $8::jsonb ELSE checklist END,
         project_id = COALESCE($9, project_id),
         last_review = COALESCE($10, last_review),
         updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        title, 
        description, 
        owner, 
        steps ? JSON.stringify(steps) : null, 
        avg_time, 
        status, 
        category, 
        checklist ? JSON.stringify(checklist) : null,
        project_id,
        last_review,
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SOP introuvable' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ PUT /sops:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/sops/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sops WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'SOP introuvable' });
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES TASKS (operator_tasks) - CORRIGÉ snake_case
// ============================================================================

router.get('/tasks', async (req, res) => {
  try {
    const { project_id, status, priority, sop_id } = req.query; // ✅ CORRIGÉ
    let query = `
      SELECT t.*, s.title as sop_title, p.name as project_name
      FROM operator_tasks t
      LEFT JOIN sops s ON t.sop_id = s.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (project_id) { query += ` AND t.project_id = $${idx++}`; params.push(project_id); } // ✅
    if (status) { query += ` AND t.status = $${idx++}`; params.push(status); }
    if (priority) { query += ` AND t.priority = $${idx++}`; params.push(priority); }
    if (sop_id) { query += ` AND t.sop_id = $${idx++}`; params.push(sop_id); } // ✅

    query += ' ORDER BY t.due_date ASC NULLS LAST, t.priority DESC'; // ✅

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ GET /tasks:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer une tâche par ID
router.get('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        s.title as sop_title,
        p.name as project_name
      FROM operator_tasks t
      LEFT JOIN sops s ON t.sop_id = s.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/tasks/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Créer une nouvelle tâche
router.post('/tasks', async (req, res) => {
  const { title, description, priority, due_date, assigned_to, status, sop_id, project_id, category } = req.body; // ✅
  
  try {
    const result = await pool.query(
      `INSERT INTO operator_tasks (title, description, priority, due_date, assigned_to, status, sop_id, project_id, category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        title,
        description || null,
        priority || 'medium',
        due_date, // ✅
        assigned_to || null, // ✅
        status || 'todo',
        sop_id || null, // ✅
        project_id || null, // ✅
        category || null
      ]
    );

    console.log('✅ Tâche créée:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST /api/operator/tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Mettre à jour une tâche
router.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, priority, due_date, assigned_to, status, sop_id, project_id, category } = req.body; // ✅
  
  try {
    const result = await pool.query(
      `UPDATE operator_tasks 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3, priority),
         due_date = COALESCE($4, due_date),
         assigned_to = COALESCE($5, assigned_to),
         status = COALESCE($6, status),
         sop_id = COALESCE($7, sop_id),
         project_id = COALESCE($8, project_id),
         category = COALESCE($9, category),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, priority, due_date, assigned_to, status, sop_id, project_id, category, id] // ✅
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }

    console.log('✅ Tâche mise à jour:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT /api/operator/tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH - Mettre à jour uniquement le statut
router.patch('/tasks/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE operator_tasks 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }

    console.log('✅ Statut tâche mis à jour:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PATCH /api/operator/tasks/:id/status:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une tâche
router.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM operator_tasks WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }
    console.log('✅ Tâche supprimée:', result.rows[0]);
    res.json({ message: 'Tâche supprimée', task: result.rows[0] });
  } catch (err) {
    console.error('❌ Erreur DELETE /api/operator/tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// STATISTIQUES & ANALYTICS
// ============================================================================

router.get('/stats/tasks-by-project', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.name as project_name,
        COUNT(t.id) as total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'todo') as todo,
        COUNT(t.id) FILTER (WHERE t.status = 'in-progress') as in_progress,
        COUNT(t.id) FILTER (WHERE t.status = 'done') as done,
        COUNT(t.id) FILTER (WHERE t.priority = 'critical') as critical
      FROM projects p
      LEFT JOIN operator_tasks t ON p.id = t.project_id
      GROUP BY p.id, p.name
      ORDER BY total_tasks DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/stats/tasks-by-project:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/operator/projects/:id - Mettre à jour un projet
router.put('/projects/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { start_date, end_date, progress, status } = req.body;

    const checkProject = await client.query(
      'SELECT id FROM projects WHERE id = $1',
      [id]
    );

    if (checkProject.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé ou non autorisé' });
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCounter}`);
      values.push(start_date);
      paramCounter++;
    }

    if (end_date !== undefined) {
      updates.push(`end_date = $${paramCounter}`);
      values.push(end_date);
      paramCounter++;
    }

    if (progress !== undefined) {
      updates.push(`progress = $${paramCounter}`);
      values.push(progress);
      paramCounter++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCounter}`);
      values.push(status);
      paramCounter++;
    }

    updates.push(`updated_at = $${paramCounter}`);
    values.push(new Date());
    paramCounter++;

    values.push(id);

    const query = `
      UPDATE projects 
      SET ${updates.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;

    const result = await client.query(query, values);

    res.json({
      message: 'Projet mis à jour avec succès',
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du projet:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du projet' });
  } finally {
    client.release();
  }
});

module.exports = router;
