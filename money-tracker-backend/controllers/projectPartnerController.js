const db = require('../config/database');

exports.addPartner = async (req, res) => {
  const { projectId } = req.params;
  const {
    partner_name,
    partner_role,
    capital_contribution,
    contribution_percentage,
    phase1_percentage,
    phase2_percentage,
    is_capital_investor
  } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO project_partners 
       (project_id, partner_name, partner_role, capital_contribution, 
        contribution_percentage, phase1_percentage, phase2_percentage, is_capital_investor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [projectId, partner_name, partner_role, capital_contribution,
       contribution_percentage, phase1_percentage, phase2_percentage, is_capital_investor]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPartners = async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM project_partners WHERE project_id = $1 ORDER BY id',
      [projectId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePartner = async (req, res) => {
  const { partnerId } = req.params;
  const updates = req.body;

  const fields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
  const values = [...Object.values(updates), partnerId];

  try {
    const result = await db.query(
      `UPDATE project_partners SET ${fields}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePartner = async (req, res) => {
  const { partnerId } = req.params;
  try {
    await db.query('DELETE FROM project_partners WHERE id = $1', [partnerId]);
    res.json({ message: 'Associé supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};