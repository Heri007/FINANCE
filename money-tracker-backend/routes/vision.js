// routes/vision.js (NOUVEAU FICHIER)
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/vision/list - Liste toutes les visions
router.get('/list', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM visions ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/vision - Créer une nouvelle vision
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { content, mission, values } = req.body;
    const result = await pool.query(
      `INSERT INTO visions (content, mission, values)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [content, mission, JSON.stringify(values)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


// GET /api/vision - Récupérer vision et objectifs
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const [visionsRes, objectivesRes] = await Promise.all([
      pool.query('SELECT * FROM visions ORDER BY id DESC LIMIT 1'),
      pool.query('SELECT * FROM objectives ORDER BY deadline ASC, id ASC')
    ]);

    res.json({
      vision: visionsRes.rows[0] || null,
      objectives: objectivesRes.rows
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/vision - Mettre à jour vision
router.put('/', authenticateToken, async (req, res, next) => {
  try {
    const { content, mission, values } = req.body;

    const existing = await pool.query('SELECT id FROM visions LIMIT 1');
    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE visions
         SET content = $1, mission = $2, values = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [content, mission, JSON.stringify(values), existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO visions (content, mission, values)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [content, mission, JSON.stringify(values)]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


// POST /api/vision/objectives - Créer objectif
router.post('/objectives', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, category, deadline, budget } = req.body;
    
    const result = await pool.query(
      `INSERT INTO objectives (title, description, category, deadline, budget, progress)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING *`,
      [title, description, category, deadline, budget]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/vision/objectives/:id - Mettre à jour objectif
router.put('/objectives/:id', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, progress, completed, budget, deadline } = req.body;

    const result = await pool.query(
      `UPDATE objectives
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           progress = COALESCE($3, progress),
           completed = COALESCE($4, completed),
           budget = COALESCE($5, budget),
           deadline = COALESCE($6, deadline),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, progress, completed, budget, deadline, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objectif non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});


// DELETE /api/vision/objectives/:id - Supprimer objectif
router.delete('/objectives/:id', authenticateToken, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM objectives WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
