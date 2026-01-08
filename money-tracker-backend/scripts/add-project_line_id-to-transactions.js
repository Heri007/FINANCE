// scripts/add-project_line_id-to-transactions.js
// Adds `project_line_id` column to `transactions` (text) and attempts to backfill
// by matching transactions to project_expense_lines / project_revenue_lines.

const pool = require('../config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔧 Starting migration: add project_line_id to transactions');
    await client.query('BEGIN');

    // Add column if missing, otherwise ensure it's TEXT so we can backfill with non-UUID ids
    const col = await client.query("SELECT udt_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='project_line_id'");
    if (col.rows.length === 0) {
      await client.query("ALTER TABLE transactions ADD COLUMN project_line_id TEXT;");
      console.log('Added transactions.project_line_id as TEXT');
    } else {
      const udt = col.rows[0].udt_name;
      if (udt === 'uuid') {
        // convert uuid -> text to allow storing integer/string ids created from line tables
        await client.query("ALTER TABLE transactions ALTER COLUMN project_line_id TYPE TEXT USING project_line_id::text;");
        console.log('Converted transactions.project_line_id from uuid to TEXT');
      }
    }

    // Create index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_project_line_id ON transactions(project_line_id);`);

    // Backfill: for transactions missing project_line_id, try to match by project_id, amount, and type
    // Expenses -> project_expense_lines, Incomes -> project_revenue_lines

    // Update expenses
    const expTxRes = await client.query(`
      SELECT id, project_id, amount, description, type, transaction_date
      FROM transactions
      WHERE project_id IS NOT NULL AND (project_line_id IS NULL OR project_line_id = '') AND type = 'expense'
    `);

    for (const tx of expTxRes.rows) {
      try {
        const match = await client.query(`
          SELECT id FROM project_expense_lines
          WHERE project_id = $1
            AND (COALESCE(actual_amount,0) = $2 OR COALESCE(projected_amount,0) = $2)
          ORDER BY id ASC
          LIMIT 1
        `, [tx.project_id, tx.amount]);

        if (match.rows[0]) {
          await client.query('UPDATE transactions SET project_line_id = $1 WHERE id = $2', [String(match.rows[0].id), tx.id]);
        }
      } catch (e) {
        // ignore per-row errors
        console.warn('Row match error for tx', tx.id, e.message);
      }
    }

    // Update incomes
    const incTxRes = await client.query(`
      SELECT id, project_id, amount, description, type, transaction_date
      FROM transactions
      WHERE project_id IS NOT NULL AND (project_line_id IS NULL OR project_line_id = '') AND type = 'income'
    `);

    for (const tx of incTxRes.rows) {
      try {
        const match = await client.query(`
          SELECT id FROM project_revenue_lines
          WHERE project_id = $1
            AND (COALESCE(actual_amount,0) = $2 OR COALESCE(projected_amount,0) = $2)
          ORDER BY id ASC
          LIMIT 1
        `, [tx.project_id, tx.amount]);

        if (match.rows[0]) {
          await client.query('UPDATE transactions SET project_line_id = $1 WHERE id = $2', [String(match.rows[0].id), tx.id]);
        }
      } catch (e) {
        console.warn('Row match error for tx', tx.id, e.message);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed: project_line_id added and backfill attempted');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runMigration;
