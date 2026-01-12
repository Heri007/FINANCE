// test-controller.js
console.log('🔍 Test chargement du contrôleur...\n');

try {
  const controller = require('../controllers/transactionController');
  console.log('✅ Module chargé avec succès!');
  console.log('📋 Fonctions exportées:', Object.keys(controller));
  console.log('\n🔍 getTransactions:', controller.getTransactions);
  console.log('🔍 createTransaction:', controller.createTransaction);
  console.log('🔍 updateTransaction:', controller.updateTransaction);
  console.log('🔍 deleteTransaction:', controller.deleteTransaction);
  console.log('🔍 getLastDates:', controller.getLastDates);
  console.log('🔍 unpostTransaction:', controller.unpostTransaction);
} catch (error) {
  console.error('❌ ERREUR lors du chargement:', error.message);
  console.error('Stack:', error.stack);
}
