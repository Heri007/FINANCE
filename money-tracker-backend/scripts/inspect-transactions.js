const pool = require('../config/database');

(async function(){
  const client = await pool.connect();
  try {
    const cols = await client.query("SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name='transactions' ORDER BY ordinal_position");
    console.log('Columns in transactions:');
    console.table(cols.rows);

    const constraints = await client.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE conrelid = 'transactions'::regclass
    `);
    console.log('Constraints on transactions:');
    console.table(constraints.rows);

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename='transactions'
    `);
    console.log('Indexes on transactions:');
    console.table(indexes.rows);

  } catch(e) { console.error(e); }
  finally { client.release(); await pool.end(); }
})();
