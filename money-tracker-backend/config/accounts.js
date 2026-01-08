// config/accounts.js - VERSION ROBUSTE ET EXPLICITE
const pool = require('./database');

let ACCOUNT_IDS = {
  RECEIVABLES_ACCOUNT_ID: null,
  COFFRE_ACCOUNT_ID: null,
};

let isLoaded = false;

async function loadAccountIds() {
  try {
    // Vérifier que le pool est prêt
    if (!pool || typeof pool.query !== 'function') {
      throw new Error('Pool de connexion DB non initialisé');
    }

    const names = ['Receivables', 'Coffre'];
    
    console.log('🔍 Recherche des comptes spéciaux:', names);
    
    const result = await pool.query(
      'SELECT id, name FROM accounts WHERE name = ANY($1)',
      [names]
    );

    console.log(`📊 Résultat requête: ${result.rows.length} compte(s) trouvé(s)`);

    if (result.rows.length === 0) {
      console.warn('⚠️  Aucun compte spécial trouvé dans la base');
      return ACCOUNT_IDS;
    }

    // Afficher les comptes trouvés
    result.rows.forEach(row => {
      console.log(`  - Trouvé: ${row.name} (ID: ${row.id})`);
      
      if (row.name === 'Receivables') {
        ACCOUNT_IDS.RECEIVABLES_ACCOUNT_ID = row.id;
      }
      if (row.name === 'Coffre') {
        ACCOUNT_IDS.COFFRE_ACCOUNT_ID = row.id;
      }
    });

    // Vérifier les comptes manquants
    const missing = [];
    if (!ACCOUNT_IDS.RECEIVABLES_ACCOUNT_ID) missing.push('Receivables');
    if (!ACCOUNT_IDS.COFFRE_ACCOUNT_ID) missing.push('Coffre');

    if (missing.length > 0) {
      console.warn(`⚠️  Comptes manquants: ${missing.join(', ')}`);
      console.warn('   Créez-les avec:');
      console.warn('   INSERT INTO accounts (name, type, balance) VALUES');
      console.warn('     (\'Receivables\', \'receivables\', 0),');
      console.warn('     (\'Coffre\', \'cash\', 0);');
    } else {
      console.log(`✅ Tous les comptes spéciaux sont présents`);
      console.log(`   RECEIVABLES_ACCOUNT_ID: ${ACCOUNT_IDS.RECEIVABLES_ACCOUNT_ID}`);
      console.log(`   COFFRE_ACCOUNT_ID: ${ACCOUNT_IDS.COFFRE_ACCOUNT_ID}`);
      isLoaded = true;
    }

    return ACCOUNT_IDS;
  } catch (error) {
    console.error('❌ Erreur lors du chargement des comptes spéciaux');
    console.error('   Type:', error.constructor.name);
    console.error('   Message:', error.message || '(pas de message)');
    console.error('   Code:', error.code || '(pas de code)');
    console.error('   Stack:', error.stack);
    
    // Re-throw pour que server.js puisse catcher
    throw new Error(`Échec loadAccountIds: ${error.message || 'erreur inconnue'}`);
  }
}

function getAccountIds() {
  if (!isLoaded) {
    console.warn('⚠️  getAccountIds() appelé avant loadAccountIds()');
  }
  return ACCOUNT_IDS;
}

module.exports = {
  loadAccountIds,
  getAccountIds,
};
