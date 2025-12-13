// money-tracker-backend/routes/employees.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET - Récupérer tous les employés
router.get('/', async (req, res) => {
  try {
    const { department, status, search } = req.query;
    
    let query = `
      SELECT * FROM employees
      WHERE 1=1
    `;
    const params = [];
    
    if (department && department !== 'all') {
      params.push(department);
      query += ` AND department = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR position ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur récupération employés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Récupérer un employé par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur récupération employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST - Créer un nouvel employé
router.post('/', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      photo,
      position,
      department,
      email,
      phone,
      facebook,
      linkedin,
      location,
      salary,
      startDate,
      contractType,
      skills,
      emergencyContact
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO employees (
        first_name, last_name, photo, position, department, 
        email, phone, facebook, linkedin, location, 
        salary, start_date, contract_type, skills, 
        emergency_contact, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *`,
      [
        firstName, lastName, photo, position, department,
        email, phone, facebook, linkedin, location,
        salary, startDate, contractType, JSON.stringify(skills),
        JSON.stringify(emergencyContact), 'active'
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur création employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT - Mettre à jour un employé
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    });
    
    values.push(id);
    
    const query = `
      UPDATE employees 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur mise à jour employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE - Supprimer un employé
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }
    
    res.json({ message: 'Employé supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Statistiques RH
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'leave') as on_leave,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COALESCE(SUM(salary), 0) as total_salary,
        AVG(salary) as avg_salary
      FROM employees
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
