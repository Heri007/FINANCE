// routes/content.js - VERSION COMPLÈTE + JOI + AUTH
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validate } = require('../middleware/validate'); // ✅ JOI
const authMiddleware = require('../middleware/auth');   // ✅ AUTH

router.use(authMiddleware); // ✅ TOUTES LES ROUTES PROTÉGÉES

// ============================================================================
// SCHEMAS JOI pour Content
// ============================================================================

// Content maître (POST/PUT /)
router.post('/', validate('contentMaster'), async (req, res) => {
  const { title, type, duration, reach, engagement } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO content_master (title, type, duration, reach, engagement) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, type, duration, reach || 0, engagement || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur POST /api/content:', err);
    res.status(500).json({ error: err.message });
  }
});

// Content maître mise à jour (PUT /:id)
router.put('/:id', validate('contentMaster'), async (req, res) => {
  const { id } = req.params;
  const { title, type, duration, reach, engagement } = req.body;
  try {
    const result = await pool.query(
      'UPDATE content_master SET title = COALESCE($1, title), type = COALESCE($2, type), duration = COALESCE($3, duration), reach = COALESCE($4, reach), engagement = COALESCE($5, engagement) WHERE id = $6 RETURNING *',
      [title, type, duration, reach, engagement, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contenu introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur PUT /api/content:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES CONTENT MASTER (GET/DELETE sans body = OK)
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const masters = await pool.query('SELECT * FROM content_master ORDER BY created_date DESC');
    const derivatives = await pool.query('SELECT * FROM content_derivatives');
    
    const content = masters.rows.map(m => ({
      ...m,
      derivatives: derivatives.rows.filter(d => d.master_id === m.id)
    }));
    
    res.json(content);
  } catch (err) {
    console.error('Erreur GET /api/content:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM content_master WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contenu introuvable' });
    }
    res.json({ message: 'Contenu supprimé', content: result.rows[0] });
  } catch (err) {
    console.error('Erreur DELETE /api/content:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// ROUTES DERIVATIVES
// ============================================================================

// Ajouter dérivé (POST /:masterId/derivatives)
router.post('/:masterId/derivatives', validate('contentDerivative'), async (req, res) => {
  const { masterId } = req.params;
  const { platform, type, status, reach } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO content_derivatives (master_id, platform, type, status, reach) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [masterId, platform, type, status || 'draft', reach || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur POST /api/content/:masterId/derivatives:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mettre à jour dérivé (PUT /derivatives/:id)
router.put('/derivatives/:id', validate('contentDerivative'), async (req, res) => {
  const { id } = req.params;
  const { platform, type, status, reach } = req.body;
  try {
    const result = await pool.query(
      'UPDATE content_derivatives SET platform = COALESCE($1, platform), type = COALESCE($2, type), status = COALESCE($3, status), reach = COALESCE($4, reach) WHERE id = $5 RETURNING *',
      [platform, type, status, reach, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dérivé introuvable' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur PUT /api/content/derivatives:', err);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer dérivé (DELETE sans body = OK)
router.delete('/derivatives/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM content_derivatives WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dérivé introuvable' });
    }
    res.json({ message: 'Dérivé supprimé', derivative: result.rows[0] });
  } catch (err) {
    console.error('Erreur DELETE /api/content/derivatives:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
