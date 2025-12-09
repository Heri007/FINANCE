// scripts/show-account-names.js
const pool = require('../config/database');

async function showAccountNames() {
  console.log('\n' + '═'.repeat(80));
  console.log('📋 NOMS DES COMPTES DANS LA BASE DE DONNÉES');
  console.log('═'.repeat(80) + '\n');

  try {
    const result = await pool.query(`
      SELECT id, name, type, balance 
      FROM accounts 
      ORDER BY id
    `);

    console.log(`Total : ${result.rows.length} compte(s)\n`);
    
    result.rows.forEach(account => {
      const balanceFormatted = parseFloat(account.balance).toLocaleString('fr-FR', { 
        minimumFractionDigits: 2 
      });
      
      console.log(`ID ${account.id}: ${account.name}`);
      console.log(`   Type: ${account.type}`);
      console.log(`   Solde: ${balanceFormatted} Ar`);
      console.log('');
    });

    console.log('═'.repeat(80));
    console.log('💡 MAPPING POUR CSV:\n');
    
    result.rows.forEach(account => {
      const csvName = account.name.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[éèê]/g, 'e')
        .replace(/[àâ]/g, 'a');
      console.log(`   ${csvName}_mga.csv → ${account.name} (ID ${account.id})`);
    });
    
    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

showAccountNames();
