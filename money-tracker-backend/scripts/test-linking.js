// test-linking.js
const {
  linkTransactionToLine,
  getUnlinkedTransactions,
  getProjectLines,
  getProjectLinkingStats
} = require('../services/transactionLinkingService');

async function test() {
  console.log('🧪 Test du service de liaison\n');

  // Test 1 : Transactions non liées
  console.log('1️⃣ Récupération des transactions non liées...');
  const unlinked = await getUnlinkedTransactions(28); // Projet CARRIERE MAROVOAY
  console.log(`   Résultat: ${unlinked.length} transactions\n`);

  // Test 2 : Lignes du projet
  console.log('2️⃣ Récupération des lignes du projet 28...');
  const lines = await getProjectLines(28);
  console.log(`   Résultat: ${lines.expenses.length} dépenses, ${lines.revenues.length} revenus\n`);

  // Test 3 : Statistiques
  console.log('3️⃣ Statistiques de liaison...');
  const stats = await getProjectLinkingStats(28);
  console.log('   Résultat:', stats, '\n');

  // Test 4 : Lier une transaction (si unlinked > 0)
  if (unlinked.length > 0 && lines.expenses.length > 0) {
    console.log('4️⃣ Test de liaison...');
    const result = await linkTransactionToLine(
      unlinked[0].transaction_id,
      lines.expenses[0].id,
      'test-user'
    );
    console.log('   Résultat:', result);
  }

  process.exit(0);
}

test().catch(err => {
  console.error('❌ Erreur test:', err);
  process.exit(1);
});
