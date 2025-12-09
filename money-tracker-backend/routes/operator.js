// routes/operator.js - VERSION CORRIGÉE UTF-8
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validate } = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ============================================================================
// MIDDLEWARE UTF-8 POUR TOUTES LES RÉPONSES
// ============================================================================
router.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ============================================================================
// ROUTES SOPs
// ============================================================================

// GET - Récupérer toutes les SOPs
router.get('/sops', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sops ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/sops:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer une SOP par ID
router.get('/sops/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM sops WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SOP introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/sops/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST - Créer une nouvelle SOP
router.post('/sops', validate('sop'), async (req, res) => {
  const { title, description, owner, steps, avg_time, status, category, checklist } = req.body;
  
  try {
    const stepsJSON = Array.isArray(steps) ? steps : [];
    const checklistJSON = Array.isArray(checklist) ? checklist : [];

    const result = await pool.query(
      `INSERT INTO sops (title, description, owner, steps, avg_time, status, category, checklist) 
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb) 
       RETURNING *`,
      [
        title,
        description || null,
        owner || null,
        JSON.stringify(stepsJSON),
        avg_time || null,
        status || 'draft',
        category || null,
        JSON.stringify(checklistJSON)
      ]
    );

    console.log('✅ SOP créée:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur POST /api/operator/sops:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Mettre à jour une SOP
router.put('/sops/:id', validate('sop'), async (req, res) => {
  const { id } = req.params;
  const { title, description, owner, steps, avg_time, status, category, checklist } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM sops WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'SOP introuvable' });
    }

    const currentSOP = existing.rows[0];
    const stepsJSON = steps !== undefined ? (Array.isArray(steps) ? steps : []) : currentSOP.steps;
    const checklistJSON = checklist !== undefined ? (Array.isArray(checklist) ? checklist : []) : currentSOP.checklist;

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
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        title,
        description,
        owner,
        JSON.stringify(stepsJSON),
        avg_time,
        status,
        category,
        JSON.stringify(checklistJSON),
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SOP introuvable' });
    }

    console.log('✅ SOP mise à jour:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Erreur PUT /api/operator/sops:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une SOP
router.delete('/sops/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM sops WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'SOP introuvable' });
    }
    console.log('✅ SOP supprimée:', result.rows[0]);
    res.json({ message: 'SOP supprimée', sop: result.rows[0] });
  } catch (err) {
    console.error('❌ Erreur DELETE /api/operator/sops:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES TASKS
// ============================================================================

// GET - Récupérer toutes les tâches avec jointures
router.get('/tasks', async (req, res) => {
  try {
    const { projectid, status, priority, sopid } = req.query;
    
    let query = `
      SELECT 
        t.*,
        s.title as sop_title,
        p.name as project_name
      FROM operator_tasks t
      LEFT JOIN operator_sops s ON t.sopid = s.id
      LEFT JOIN projects p ON t.projectid = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (projectid) {
      query += ` AND t.projectid = $${paramCount}`;
      params.push(projectid);
      paramCount++;
    }
    
    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (priority) {
      query += ` AND t.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }
    
    if (sopid) {
      query += ` AND t.sopid = $${paramCount}`;
      params.push(sopid);
      paramCount++;
    }

    query += ' ORDER BY t.duedate ASC, t.priority DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erreur GET /api/operator/tasks:', err);
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
      LEFT JOIN operator_sops s ON t.sopid = s.id
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
