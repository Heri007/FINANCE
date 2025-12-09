// config/accounts.js
const pool = require('../config/database');

let ACCOUNT_IDS = {
  AVOIR_ACCOUNT_ID: null,
  COFFRE_ACCOUNT_ID: null,
};

async function loadAccountIds() {
  const names = ['Avoir', 'Coffre'];
  const result = await pool.query(
    'SELECT id, name FROM accounts WHERE name = ANY($1)',
    [names]
  );

  result.rows.forEach(row => {
    if (row.name === 'Avoir') {
      ACCOUNT_IDS.AVOIR_ACCOUNT_ID = row.id;
    }
    if (row.name === 'Coffre') {
      ACCOUNT_IDS.COFFRE_ACCOUNT_ID = row.id;
    }
  });

  if (!ACCOUNT_IDS.AVOIR_ACCOUNT_ID || !ACCOUNT_IDS.COFFRE_ACCOUNT_ID) {
    console.warn('⚠️ AVOIR / COFFRE non trouvés en base, vérifiez vos comptes initiaux.');
  }

  console.log('✅ ACCOUNT IDS chargés:', ACCOUNT_IDS);
  return ACCOUNT_IDS;
}

function getAccountIds() {
  return ACCOUNT_IDS;
}

module.exports = {
  loadAccountIds,
  getAccountIds,
};
