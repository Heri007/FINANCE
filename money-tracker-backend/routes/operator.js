// routes/operator.js - VERSION OPTIMISÉE
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
    // Utilisation de sops pour la cohérence
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
  const { title, description, owner, steps, avg_time, status, category, checklist } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO sops (title, description, owner, steps, avg_time, status, category, checklist) 
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb) 
       RETURNING *`,
      [
        title, 
        description, 
        owner, 
        JSON.stringify(steps || []), 
        avg_time, 
        status || 'draft', 
        category, 
        JSON.stringify(checklist || [])
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
  const { title, description, owner, steps, avg_time, status, category, checklist } = req.body;

  try {
    // On récupère d'abord l'existant pour faire un COALESCE intelligent
    const existing = await pool.query('SELECT * FROM sops WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'SOP introuvable' });
    
    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE sops 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         owner = COALESCE($3, owner),
         steps = COALESCE($4::jsonb, steps),
         avg_time = COALESCE($5, avg_time),
         status = COALESCE($6, status),
         category = COALESCE($7, category),
         checklist = COALESCE($8::jsonb, checklist),
         updated_at = NOW()
       WHERE id = $9
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
        id
      ]
    );
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
// ROUTES TASKS (operator_tasks)
// ============================================================================

router.get('/tasks', async (req, res) => {
  try {
    const { projectid, status, priority, sopid } = req.query;
    let query = `
      SELECT t.*, s.title as sop_title, p.name as project_name
      FROM operator_tasks t
      LEFT JOIN sops s ON t.sopid = s.id
      LEFT JOIN projects p ON t.projectid = p.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (projectid) { query += ` AND t.projectid = $${idx++}`; params.push(projectid); }
    if (status) { query += ` AND t.status = $${idx++}`; params.push(status); }
    if (priority) { query += ` AND t.priority = $${idx++}`; params.push(priority); }
    if (sopid) { query += ` AND t.sopid = $${idx++}`; params.push(sopid); }

    query += ' ORDER BY t.duedate ASC NULLS LAST, t.priority DESC'; // NULLS LAST pour mettre les dates vides à la fin

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
      LEFT JOIN sops s ON t.sopid = s.id
      LEFT JOIN projects p ON t.projectid = p.id
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
  const { title, description, priority, duedate, assignedto, status, sopid, projectid, category } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO operator_tasks (title, description, priority, duedate, assignedto, status, sopid, projectid, category) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [
        title,
        description || null,
        priority || 'medium',
        duedate,
        assignedto || null,
        status || 'todo',
        sopid || null,
        projectid || null,
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
  const { title, description, priority, duedate, assignedto, status, sopid, projectid, category } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE operator_tasks 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         priority = COALESCE($3, priority),
         duedate = COALESCE($4, duedate),
         assignedto = COALESCE($5, assignedto),
         status = COALESCE($6, status),
         sopid = COALESCE($7, sopid),
         projectid = COALESCE($8, projectid),
         category = COALESCE($9, category),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, priority, duedate, assignedto, status, sopid, projectid, category, id]
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
      LEFT JOIN operator_tasks t ON p.id = t.projectid
      GROUP BY p.id, p.name
      ORDER BY total_tasks DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/stats/tasks-by-project:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
