const pool = require('../config/database');

(async function(){
  const client = await pool.connect();
  try {
    // pick an existing account
    const acc = await client.query('SELECT id FROM accounts LIMIT 1');
    if (acc.rows.length === 0) { console.log('No accounts found'); return; }
    const accountId = acc.rows[0].id;

    const res = await client.query(
      `INSERT INTO transactions (account_id, type, amount, category, description, transaction_date, is_planned, is_posted, project_id, project_line_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,true,$7,$8,NOW()) RETURNING id`,
      [accountId, 'expense', 12345.67, 'Test', 'Test insert project_line', new Date().toISOString().split('T')[0], 24, '1']
    );

    console.log('Inserted tx id', res.rows[0].id);
    const sel = await client.query('SELECT id, project_line_id FROM transactions WHERE id = $1', [res.rows[0].id]);
    console.log('Selected:', sel.rows[0]);

    await client.query('DELETE FROM transactions WHERE id = $1', [res.rows[0].id]);
    console.log('Deleted test tx');
  } catch (e) { console.error(e); }
  finally { client.release(); await pool.end(); }
})();
