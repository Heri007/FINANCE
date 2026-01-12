// src/controllers/notesController.js
const pool = require('../config/database');

// GET /api/notes - Récupérer toutes les notes
exports.getAllNotes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notes ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Erreur getAllNotes:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/notes - Créer une note
exports.createNote = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Le contenu est requis' });
    }
    
    const result = await pool.query(
      'INSERT INTO notes (content) VALUES ($1) RETURNING *',
      [content.trim()]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur createNote:', error);
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notes/:id - Mettre à jour une note
exports.updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    const result = await pool.query(
      'UPDATE notes SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [content, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note introuvable' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Erreur updateNote:', error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/notes/:id - Supprimer une note
exports.deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM notes WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note introuvable' });
    }
    
    res.json({ success: true, message: 'Note supprimée' });
  } catch (error) {
    console.error('❌ Erreur deleteNote:', error);
    res.status(500).json({ error: error.message });
  }
};
