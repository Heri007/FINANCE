// scripts/create-project-lines.js
// Create normalized project_expense_lines and project_revenue_lines tables
// and backfill from projects.expenses / projects.revenues JSON fields when present.

const pool = require('../config/database');

async function createAndBackfill() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create expense lines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_expense_lines (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        description TEXT,
        category VARCHAR(150),
        projected_amount DECIMAL(15,2) DEFAULT 0,
        actual_amount DECIMAL(15,2) DEFAULT 0,
        transaction_date DATE,
        is_paid BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create revenue lines table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_revenue_lines (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        description TEXT,
        category VARCHAR(150),
        projected_amount DECIMAL(15,2) DEFAULT 0,
        actual_amount DECIMAL(15,2) DEFAULT 0,
        transaction_date DATE,
        is_received BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_exp_project_id ON project_expense_lines(project_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_proj_rev_project_id ON project_revenue_lines(project_id);`);

    // Backfill expense lines if table empty
    const expCountRes = await client.query('SELECT COUNT(*)::int AS c FROM project_expense_lines');
    const expCount = expCountRes.rows[0].c;
    if (expCount === 0) {
      const projects = await client.query('SELECT id, expenses FROM projects');
      for (const p of projects.rows) {
        let expenseLines = [];
        try {
          expenseLines = typeof p.expenses === 'string' ? JSON.parse(p.expenses) : (p.expenses || []);
        } catch (e) {
          expenseLines = [];
        }

        for (const e of expenseLines) {
          const desc = e?.description || e?.label || null;
          const cat = e?.category || e?.cat || null;
          const projected = (e?.projectedAmount ?? e?.projected_amount ?? e?.amount ?? 0) || 0;
          const actual = (e?.actualAmount ?? e?.actual_amount ?? e?.amount ?? 0) || 0;
          const date = e?.date || null;
          const is_paid = (e?.isPaid === true || e?.is_paid === true) ? true : false;

          await client.query(
            `INSERT INTO project_expense_lines (project_id, description, category, projected_amount, actual_amount, transaction_date, is_paid, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
            [p.id, desc, cat, projected, actual, date, is_paid]
          );
        }
      }
      console.log('✅ Backfilled project_expense_lines from projects.expenses');
    } else {
      console.log('ℹ️ project_expense_lines already contains data, skipping backfill');
    }

    // Backfill revenue lines if table empty
    const revCountRes = await client.query('SELECT COUNT(*)::int AS c FROM project_revenue_lines');
    const revCount = revCountRes.rows[0].c;
    if (revCount === 0) {
      const projects = await client.query('SELECT id, revenues FROM projects');
      for (const p of projects.rows) {
        let revenueLines = [];
        try {
          revenueLines = typeof p.revenues === 'string' ? JSON.parse(p.revenues) : (p.revenues || []);
        } catch (e) {
          revenueLines = [];
        }

        for (const r of revenueLines) {
          const desc = r?.description || r?.label || null;
          const cat = r?.category || r?.cat || null;
          const projected = (r?.projectedAmount ?? r?.projected_amount ?? r?.amount ?? 0) || 0;
          const actual = (r?.actualAmount ?? r?.actual_amount ?? r?.amount ?? 0) || 0;
          const date = r?.date || null;
          const is_received = (r?.isReceived === true || r?.is_received === true) ? true : false;

          await client.query(
            `INSERT INTO project_revenue_lines (project_id, description, category, projected_amount, actual_amount, transaction_date, is_received, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
            [p.id, desc, cat, projected, actual, date, is_received]
          );
        }
      }
      console.log('✅ Backfilled project_revenue_lines from projects.revenues');
    } else {
      console.log('ℹ️ project_revenue_lines already contains data, skipping backfill');
    }

    await client.query('COMMIT');
    console.log('✅ project lines tables created/ensured and backfill complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating/backfilling project lines:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  createAndBackfill()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createAndBackfill;
