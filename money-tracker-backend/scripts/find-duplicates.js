// scripts/find-duplicates.js
const { Pool } = require('pg');
const pool = new Pool({
  user: 'm1',      // REMPLACER par votre user
  host: 'localhost',
  database: 'moneytracker', // REMPLACER par votre nom de DB
  password: 'HRPIRATES007', // REMPLACER par votre password
  port: 5432,
});

const run = async () => {
  try {
    // Cette requête cherche les transactions identiques (même compte, date, montant, type)
    // qui apparaissent plus d'une fois.
    const query = `
      SELECT 
        account_id, 
        transaction_date, 
        amount, 
        type, 
        COUNT(*) as count,
        string_agg(description, ' | ') as descriptions,
        string_agg(id::text, ', ') as ids
      FROM transactions
      GROUP BY account_id, transaction_date, amount, type
      HAVING COUNT(*) > 1
      ORDER BY account_id, transaction_date DESC;
    `;

    const res = await pool.query(query);
    
    console.log(`\n🔍 ${res.rows.length} groupes de doublons potentiels trouvés :\n`);
    
    res.rows.forEach(row => {
      console.log(`🔴 Compte ${row.account_id} | ${row.amount} Ar | ${new Date(row.transaction_date).toLocaleDateString()}`);
      console.log(`   IDs: ${row.ids}`);
      console.log(`   Descriptifs: ${row.descriptions}`);
      console.log('---');
    });

    pool.end();
  } catch (e) {
    console.error(e);
  }
};

run();
