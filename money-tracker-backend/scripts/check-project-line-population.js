const pool = require('../config/database');

(async function(){
  const client = await pool.connect();
  try {
    const total = await client.query('SELECT COUNT(*)::int AS c FROM transactions');
    const withLine = await client.query("SELECT COUNT(*)::int AS c FROM transactions WHERE project_line_id IS NOT NULL AND project_line_id <> ''");
    console.log(`Transactions total: ${total.rows[0].c}`);
    console.log(`Transactions with project_line_id: ${withLine.rows[0].c}`);

    const samples = await client.query(`SELECT id, project_id, type, amount, project_line_id FROM transactions WHERE project_line_id IS NOT NULL AND project_line_id <> '' LIMIT 20`);
    console.table(samples.rows);
  } catch (e) { console.error(e); }
  finally { client.release(); await pool.end(); }
})();
