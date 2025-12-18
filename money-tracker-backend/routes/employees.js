const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');

/* =========================
   Multer configuration
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/employees/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Seules les images sont autorisées'));
  }
});

/* =========================
   Utils
========================= */
const toCamelCase = (obj) => {
  if (!obj) return null;
  const camel = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camel[camelKey] = obj[key];
  }
  return camel;
};

/* =========================
   GET - Tous les employés
========================= */
router.get('/', async (req, res) => {
  try {
    const { department, status, search } = req.query;

    let query = 'SELECT * FROM employees WHERE 1=1';
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
      query += `
        AND (
          first_name ILIKE $${params.length}
          OR last_name ILIKE $${params.length}
          OR position ILIKE $${params.length}
        )
      `;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(toCamelCase));
  } catch (error) {
    console.error('Erreur récupération employés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* =========================
   GET - Statistiques
========================= */
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'leave') AS on_leave,
        COUNT(*) FILTER (WHERE status = 'inactive') AS inactive,
        COALESCE(SUM(salary), 0) AS total_salary,
        AVG(salary) AS avg_salary
      FROM employees
    `);

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Erreur statistiques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* =========================
   GET - Employé par ID
========================= */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Erreur récupération employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* =========================
   POST - Créer un employé
========================= */
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const {
      firstName, lastName, position, department, email, phone,
      facebook, linkedin, location, salary, startDate, endDate,
      contractType, skills, emergencyContact
    } = req.body;

    const photoUrl = req.file ? `/uploads/employees/${req.file.filename}` : null;

    const parsedSkills = skills ? JSON.parse(skills) : [];
    const parsedEmergency = emergencyContact ? JSON.parse(emergencyContact) : {};

    const result = await pool.query(
      `
      INSERT INTO employees (
        first_name, last_name, photo, position, department,
        email, phone, facebook, linkedin, location,
        salary, start_date, end_date, contract_type,
        skills, emergency_contact, status, created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,'active',NOW(),NOW()
      )
      RETURNING *
      `,
      [
        firstName,
        lastName,
        photoUrl,
        position,
        department,
        email,
        phone || null,
        facebook || null,
        linkedin || null,
        location || null,
        salary || 0,
        startDate,
        endDate || null,
        contractType,
        JSON.stringify(parsedSkills),
        JSON.stringify(parsedEmergency)
      ]
    );

    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Erreur création employé:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/* =========================
   PUT - Mettre à jour
========================= */
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Parser les données de FormData
    let skills = [];
    let projects = [];
    let emergencyContact = {};

    // Gérer les différents formats d'envoi
    if (req.body.skills) {
      try {
        skills = typeof req.body.skills === 'string' 
          ? JSON.parse(req.body.skills) 
          : req.body.skills;
      } catch (e) {
        console.warn('Erreur parsing skills:', e.message);
        skills = [];
      }
    }

    if (req.body.projects) {
      try {
        projects = typeof req.body.projects === 'string' 
          ? JSON.parse(req.body.projects) 
          : req.body.projects;
      } catch (e) {
        console.warn('Erreur parsing projects:', e.message);
        projects = [];
      }
    }

    if (req.body.emergencyContact) {
      try {
        emergencyContact = typeof req.body.emergencyContact === 'string' 
          ? JSON.parse(req.body.emergencyContact) 
          : req.body.emergencyContact;
      } catch (e) {
        console.warn('Erreur parsing emergencyContact:', e.message);
        emergencyContact = {};
      }
    }

    const photoUrl = req.file ? `/uploads/employees/${req.file.filename}` : null;

    const result = await pool.query(
      `
      UPDATE employees SET
        first_name = $1,
        last_name = $2,
        position = $3,
        department = $4,
        email = $5,
        phone = $6,
        facebook = $7,
        linkedin = $8,
        location = $9,
        salary = $10,
        start_date = $11,
        end_date = $12,
        contract_type = $13,
        status = $14,
        skills = $15,
        projects = $16,
        emergency_contact = $17,
        photo = COALESCE($18, photo),
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
      `,
      [
        req.body.firstName || req.body.first_name,
        req.body.lastName || req.body.last_name,
        req.body.position,
        req.body.department,
        req.body.email,
        req.body.phone || null,
        req.body.facebook || null,
        req.body.linkedin || null,
        req.body.location || null,
        Number(req.body.salary) || 0,
        req.body.startDate || req.body.start_date,
        req.body.endDate || req.body.end_date || null,
        req.body.contractType || req.body.contract_type,
        req.body.status || 'active',
        JSON.stringify(skills),
        JSON.stringify(projects),
        JSON.stringify(emergencyContact),
        photoUrl,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
});

/* =========================
   DELETE - Supprimer
========================= */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM employees WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    res.json({ message: 'Employé supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
