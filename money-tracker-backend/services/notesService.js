// services/notesService.js (NOUVEAU FICHIER)
const pool = require('../config/database');

const notesService = {
  async getAll() {
    try {
      return await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
    } catch (err) {
      throw new Error(`Erreur notes: ${err.message}`);
    }
  },

  async getOrCreate() {
    try {
      const result = await pool.query('SELECT * FROM notes ORDER BY id DESC LIMIT 1');
      if (result.rows.length === 0) {
        const newNote = await pool.query("INSERT INTO notes (content) VALUES ('') RETURNING *");
        return newNote.rows[0];
      }
      return result.rows[0];
    } catch (err) {
      throw new Error(`Erreur note: ${err.message}`);
    }
  },

  async update(id, content) {
    try {
      return await pool.query(
        'UPDATE notes SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [content, id]
      );
    } catch (err) {
      throw new Error(`Erreur update: ${err.message}`);
    }
  },

  async create() {
    try {
      return await pool.query("INSERT INTO notes (content) VALUES ('') RETURNING *");
    } catch (err) {
      throw new Error(`Erreur create: ${err.message}`);
    }
  }
};

module.exports = notesService;
