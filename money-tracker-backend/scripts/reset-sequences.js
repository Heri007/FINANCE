// Script de réinitialisation des séquences PostgreSQL
// Utilisation: node reset-sequences.js
// Prérequis: npm install pg dotenv

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'finance',
  user: process.env.DB_USER || 'm1',
  password: process.env.DB_PASSWORD || '',
});

// Liste de toutes les tables avec leurs séquences
const TABLES_AND_SEQUENCES = [
  // Tables principales
  { table: 'accounts', sequence: 'accounts_id_seq' },
  { table: 'transactions', sequence: 'transactions_id_seq' },
  { table: 'categories', sequence: 'categories_id_seq' },
  { table: 'receivables', sequence: 'receivables_id_seq' },

  // Tables de projets
  { table: 'projects', sequence: 'projects_id_seq' },
  { table: 'project_expense_lines', sequence: 'project_expense_lines_id_seq' },
  { table: 'project_revenue_lines', sequence: 'project_revenue_lines_id_seq' },

  // Tables de tâches et SOPs
  { table: 'tasks', sequence: 'tasks_id_seq' },
  { table: 'operator_tasks', sequence: 'operator_tasks_id_seq' },
  { table: 'sops', sequence: 'sops_id_seq' },
  { table: 'operator_sops', sequence: 'operator_sops_id_seq' },

  // Tables de contenu
  { table: 'master_content', sequence: 'master_content_id_seq' },
  { table: 'content_master', sequence: 'content_master_id_seq' },
  { table: 'derivatives', sequence: 'derivatives_id_seq' },
  { table: 'content_derivatives', sequence: 'content_derivatives_id_seq' },

  // Autres tables
  { table: 'objectives', sequence: 'objectives_id_seq' },
  { table: 'employees', sequence: 'employees_id_seq' },
  { table: 'notes', sequence: 'notes_id_seq' },
  { table: 'visions', sequence: 'visions_id_seq' },
  { table: 'sessions', sequence: 'sessions_id_seq' },
  { table: 'app_settings', sequence: 'app_settings_id_seq' },

  // Tables de log
  { table: 'transaction_linking_log', sequence: 'transaction_linking_log_id_seq' }
];

async function resetSequences() {
  const client = await pool.connect();

  try {
    console.log('\n🔄 RÉINITIALISATION DES SÉQUENCES');
    console.log('=' .repeat(70));
    console.log('⚠️  Cette opération va réinitialiser toutes les séquences (IDs)');
    console.log('✅ Vos données resteront intactes\n');

    let totalReset = 0;
    const results = [];

    for (const { table, sequence } of TABLES_AND_SEQUENCES) {
      try {
        // Obtenir le MAX(id) actuel de la table
        const maxResult = await client.query(`SELECT MAX(id) FROM ${table}`);
        const maxId = maxResult.rows[0].max || 0;

        // Obtenir la valeur actuelle de la séquence
        const seqResult = await client.query(`SELECT last_value FROM ${sequence}`);
        const currentSeq = seqResult.rows[0].last_value;

        // Réinitialiser la séquence
        if (maxId > 0) {
          await client.query(`SELECT setval('${sequence}', ${maxId}, true)`);
          totalReset++;

          const status = currentSeq > maxId ? '📉 Réduit' : currentSeq < maxId ? '📈 Augmenté' : '✓ Inchangé';

          console.log(`${status} ${table.padEnd(30)} | ${String(currentSeq).padStart(6)} → ${String(maxId).padStart(6)}`);

          results.push({
            table,
            sequence,
            previousValue: currentSeq,
            newValue: maxId,
            maxTableId: maxId,
            status: currentSeq === maxId ? 'unchanged' : 'reset'
          });
        } else {
          // Table vide, réinitialiser à 1
          await client.query(`SELECT setval('${sequence}', 1, false)`);
          console.log(`🆕 ${table.padEnd(30)} | Table vide → démarrage à 1`);

          results.push({
            table,
            sequence,
            previousValue: currentSeq,
            newValue: 1,
            maxTableId: 0,
            status: 'empty'
          });
        }
      } catch (error) {
        console.log(`❌ ${table.padEnd(30)} | Erreur: ${error.message}`);
        results.push({
          table,
          sequence,
          error: error.message,
          status: 'error'
        });
      }
    }

    console.log('\n' + '=' .repeat(70));
    console.log('📊 RÉSUMÉ');
    console.log('=' .repeat(70));
    console.log(`Tables traitées: ${TABLES_AND_SEQUENCES.length}`);
    console.log(`Séquences réinitialisées: ${totalReset}`);
    console.log(`Tables vides: ${results.filter(r => r.status === 'empty').length}`);
    console.log(`Erreurs: ${results.filter(r => r.status === 'error').length}`);

    // Vérification finale
    console.log('\n🔍 VÉRIFICATION POST-RÉINITIALISATION');
    console.log('=' .repeat(70));

    for (const { table, sequence } of TABLES_AND_SEQUENCES.slice(0, 5)) {
      const maxResult = await client.query(`SELECT MAX(id) FROM ${table}`);
      const seqResult = await client.query(`SELECT last_value FROM ${sequence}`);
      const maxId = maxResult.rows[0].max || 0;
      const seqValue = seqResult.rows[0].last_value;

      const ok = maxId <= seqValue;
      console.log(`${ok ? '✅' : '❌'} ${table.padEnd(30)} | MAX(id)=${String(maxId).padStart(6)}, SEQ=${String(seqValue).padStart(6)}`);
    }
    console.log('   ... (et ' + (TABLES_AND_SEQUENCES.length - 5) + ' autres)');

    // Sauvegarder les résultats
    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `sequence-reset-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify({ timestamp: new Date(), results }, null, 2));
    console.log(`\n💾 Rapport détaillé sauvegardé: ${filename}`);

    console.log('\n✅ Réinitialisation terminée avec succès!');
    console.log('\n💡 CONSEIL: Exécutez ce script après chaque nettoyage de données de test');
    console.log('   pour éviter les gaps inutiles dans vos IDs.\n');

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Exécution avec confirmation
console.log('\n⚠️  ATTENTION: Ce script va réinitialiser toutes les séquences (IDs)');
console.log('   Vos données ne seront PAS supprimées.');
console.log('   Les séquences seront alignées sur les valeurs MAX(id) actuelles.\n');

// Attendre 2 secondes pour que l'utilisateur puisse lire
setTimeout(() => {
  console.log('🚀 Démarrage de la réinitialisation...\n');
  resetSequences()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Échec:', err);
      process.exit(1);
    });
}, 2000);
