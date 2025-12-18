// config/accounts.js

const pool = require('./database');

let ACCOUNT_IDS = {
  RECEIVABLES_ACCOUNT_ID: null,
  COFFRE_ACCOUNT_ID: null,
};

async function loadAccountIds() {
  try {
    const names = ['Receivables', 'Coffre'];
    const result = await pool.query(
      'SELECT id, name FROM accounts WHERE name = ANY($1)',
      [names]
    );

    result.rows.forEach(row => {
      if (row.name === 'Receivables') {
        ACCOUNT_IDS.RECEIVABLES_ACCOUNT_ID = row.id;
      }
      if (row.name === 'Coffre') {
        ACCOUNT_IDS.COFFRE_ACCOUNT_ID = row.id;
      }
    });

    if (!ACCOUNT_IDS.RECEIVABLES_ACCOUNT_ID || !ACCOUNT_IDS.COFFRE_ACCOUNT_ID) {
      console.warn('⚠️ RECEIVABLES / COFFRE non trouvés en base, vérifiez vos comptes initiaux.');
    }

    console.log('✅ ACCOUNT IDS chargés:', ACCOUNT_IDS);
    return ACCOUNT_IDS;
  } catch (error) {
    console.error('❌ Erreur loadAccountIds:', error);
    throw error;
  }
}

function getAccountIds() {
  return ACCOUNT_IDS;
}

module.exports = {
  loadAccountIds,
  getAccountIds,
};
