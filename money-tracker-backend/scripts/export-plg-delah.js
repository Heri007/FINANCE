// scripts/export-plg-delah.js
// Extraction des transactions PLG FLPT et @DELAH/@Delah depuis PostgreSQL

const pool = require('../config/database'); // ton pool Postgres

async function main() {
  try {
    console.log('🔎 Extraction des transactions PLG FLPT et @DELAH/@Delah...');

    const { rows } = await pool.query(
      `
      SELECT
        id,
        account_id,
        type,
        amount,
        category,
        description,
        transaction_date,
        is_planned,
        is_posted,
        project_id
      FROM transactions
      WHERE
        category = 'PLG FLPT'
        OR LOWER(description) LIKE '%@delah%'
      ORDER BY transaction_date ASC, id ASC
      `
    );

    console.log(`✅ ${rows.length} transactions trouvées`);

    // En‑tête CSV
    console.log(
      'id,account_id,type,amount,category,description,transaction_date,is_planned,is_posted,project_id'
    );

    for (const t of rows) {
      const line = [
        t.id,
        t.account_id,
        t.type,
        t.amount,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.transaction_date ? new Date(t.transaction_date).toISOString().split('T')[0] : '',
        t.is_planned ? 1 : 0,
        t.is_posted ? 1 : 0,
        t.project_id ?? ''
      ].join(',');
      console.log(line);
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de l’extraction:', err);
    try {
      await pool.end();
    } catch {}
    process.exit(1);
  }
}

main();
