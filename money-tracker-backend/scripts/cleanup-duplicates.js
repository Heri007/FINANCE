const pool = require('../config/database');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * 1) Trouver les groupes de doublons :
 *    même compte, même montant, même date (sans l'heure)
 */
async function findDuplicates() {
  const query = `
    SELECT 
      t.accountid,
      a.name AS account_name,
      t.amount,
      DATE(t.transactiondate) AS date,
      ARRAY_AGG(t.id ORDER BY t.id)          AS ids,
      ARRAY_AGG(t.description ORDER BY t.id) AS descriptions,
      COUNT(*) AS count
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.accountid
    GROUP BY t.accountid, a.name, t.amount, DATE(t.transactiondate)
    HAVING COUNT(*) > 1
    ORDER BY t.accountid, DATE(t.transactiondate) DESC, t.amount;
  `;

  const result = await pool.query(query);
  return result.rows;
}

/**
 * 2) Détails des transactions d'un groupe (par liste d'ids)
 */
async function getTransactionDetails(ids) {
  const query = `
    SELECT 
      t.id,
      t.accountid,
      a.name AS account_name,
      t.transactiondate,
      t.amount,
      t.type,
      t.category,
      t.description
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.accountid
    WHERE t.id = ANY($1)
    ORDER BY t.id;
  `;

  const result = await pool.query(query, [ids]);
  return result.rows;
}

/**
 * 3) Suppression d'une transaction
 */
async function deleteTransaction(id) {
  await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
}

/**
 * 4) Logique de nettoyage interactive
 */
async function cleanupDuplicates() {
  console.log('\n🧹 Nettoyage interactif des doublons\n');

  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    console.log('✅ Aucun doublon trouvé !');
    return;
  }

  console.log(`📊 ${duplicates.length} groupes de doublons trouvés\n`);

  let totalDeleted = 0;
  let skipped = 0;

  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    const transactions = await getTransactionDetails(group.ids);

    console.log(`\n${'='.repeat(80)}`);
    console.log(
      `📦 Groupe ${i + 1}/${duplicates.length} - Compte ${
        group.account_name || group.accountid
      } (id=${group.accountid}) | ${group.amount} | ${group.date}`,
    );
    console.log(`${'='.repeat(80)}\n`);

    transactions.forEach((t, index) => {
      console.log(`[${index + 1}] ID: ${t.id}`);
      console.log(`    Compte      : ${t.account_name || t.accountid}`);
      console.log(`    Type        : ${t.type}`);
      console.log(`    Catégorie   : ${t.category || 'N/A'}`);
      console.log(`    Montant     : ${t.amount}`);
      console.log(`    Date        : ${t.transactiondate}`);
      console.log(`    Description : ${t.description}`);
      console.log('');
    });

    console.log('Options:');
    console.log('  • Tapez le numéro(s) à CONSERVER (ex: 1 ou 1,2)');
    console.log('  • Tapez "s" pour IGNORER ce groupe');
    console.log('  • Tapez "a" pour GARDER TOUS');
    console.log('  • Tapez "q" pour QUITTER\n');

    const answer = await question('Votre choix: ');

    if (answer.toLowerCase() === 'q') {
      console.log('\n❌ Nettoyage interrompu');
      break;
    }

    if (answer.toLowerCase() === 's') {
      console.log('⏭️  Groupe ignoré');
      skipped++;
      continue;
    }

    if (answer.toLowerCase() === 'a') {
      console.log('✅ Toutes les transactions conservées');
      continue;
    }

    try {
      const keepIndices = answer
        .split(',')
        .map((n) => parseInt(n.trim(), 10) - 1)
        .filter((idx) => !Number.isNaN(idx) && idx >= 0 && idx < transactions.length);

      if (keepIndices.length === 0) {
        console.log('⚠️  Saisie invalide, aucune transaction supprimée pour ce groupe');
        skipped++;
        continue;
      }

      const idsToKeep = keepIndices.map((idx) => transactions[idx].id);
      const idsToDelete = transactions
        .filter((t) => !idsToKeep.includes(t.id))
        .map((t) => t.id);

      if (idsToDelete.length === 0) {
        console.log('⚠️  Aucune transaction à supprimer');
        continue;
      }

      console.log(`\n🗑️  Suppression de ${idsToDelete.length} transaction(s)...`);

      for (const id of idsToDelete) {
        await deleteTransaction(id);
        console.log(`   ✓ Transaction ${id} supprimée`);
        totalDeleted++;
      }
    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
      skipped++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 RÉSUMÉ DU NETTOYAGE');
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Transactions supprimées: ${totalDeleted}`);
  console.log(`⏭️  Groupes ignorés       : ${skipped}`);
  console.log(`📦 Groupes traités        : ${duplicates.length}`);
  console.log(`${'='.repeat(80)}\n`);
}

/**
 * 5) Entrée principale
 */
async function main() {
  try {
    console.log('✅ Connecté à PostgreSQL');
    await cleanupDuplicates();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
