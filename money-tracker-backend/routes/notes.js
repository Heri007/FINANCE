// routes/notes.js (NOUVEAU FICHIER)
const express = require('express');
const router = express.Router();
const notesService = require('../services/notesService');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notes - Toutes les notes OU la dernière
// GET /api/notes - Toutes les notes
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const result = await notesService.getAll();
    res.json(result.rows); // ✅ Retourne directement (peut être vide [])
  } catch (err) {
    next(err);
  }
});


// PUT /api/notes/:id - Update note
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { content } = req.body;
    const result = await notesService.update(req.params.id, content);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/notes - Nouvelle note
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const result = await notesService.create();
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
