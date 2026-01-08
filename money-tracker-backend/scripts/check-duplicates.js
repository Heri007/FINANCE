// Script de vérification des doublons dans la base de données PostgreSQL
// Utilisation: node check-duplicates.js
// Prérequis: npm install pg dotenv
const pool = require('../config/database');

// Configuration avec les VRAIS noms de colonnes
const TABLES_TO_CHECK = {
  // RISQUE ÉLEVÉ
  accounts: {
    columns: ['name', 'type', 'user_id'],
    description: 'Comptes avec même nom',
    risk: 'HIGH'
  },
  projects: {
    columns: ['name', 'type', 'status', 'start_date', 'user_id'],
    description: 'Projets dupliqués',
    risk: 'HIGH'
  },
  project_expense_lines: {
    columns: ['project_id', 'description', 'category', 'transaction_date', 'projected_amount'],
    description: 'Lignes de dépenses dupliquées',
    risk: 'HIGH'
  },
  project_revenue_lines: {
    columns: ['project_id', 'description', 'category', 'transaction_date', 'projected_amount'],
    description: 'Lignes de revenus dupliquées',
    risk: 'HIGH'
  },
  receivables: {
    columns: ['account_id', 'person', 'description', 'amount', 'status'],
    description: 'Créances dupliquées',
    risk: 'HIGH'
  },
  
  // RISQUE MOYEN
  transactions: {
    columns: ['account_id', 'transaction_date', 'amount', 'type', 'description'],
    description: 'Transactions dupliquées malgré contrainte UNIQUE',
    risk: 'MEDIUM'
  },
  tasks: {
    columns: ['title', 'assignee', 'due_date', 'project_id'],
    description: 'Tâches dupliquées',
    risk: 'MEDIUM'
  },
  operator_tasks: {
    columns: ['title', 'assignedto', 'duedate', 'projectid'],
    description: 'Tâches opérateur dupliquées',
    risk: 'MEDIUM'
  },
  sops: {
    columns: ['title', 'owner', 'category', 'project_id'],
    description: 'SOPs dupliquées',
    risk: 'MEDIUM'
  },
  operator_sops: {
    columns: ['title', 'owner', 'category'],
    description: 'SOPs opérateur dupliquées',
    risk: 'MEDIUM'
  },
  objectives: {
    columns: ['title', 'category', 'deadline'],
    description: 'Objectifs dupliqués',
    risk: 'MEDIUM'
  },
  master_content: {
    columns: ['title', 'type', 'status'],
    description: 'Contenus master dupliqués',
    risk: 'MEDIUM'
  },
  content_master: {
    columns: ['title', 'type'],
    description: 'Contenus master dupliqués',
    risk: 'MEDIUM'
  },
  derivatives: {
    columns: ['master_id', 'platform', 'format'],
    description: 'Dérivés dupliqués',
    risk: 'MEDIUM'
  },
  content_derivatives: {
    columns: ['master_id', 'platform', 'type'],
    description: 'Dérivés de contenu dupliqués',
    risk: 'MEDIUM'
  },
  
  // RISQUE FAIBLE
  categories: {
    columns: ['name'],
    description: 'Catégories (contrainte UNIQUE)',
    risk: 'LOW'
  },
  employees: {
    columns: ['email'],
    description: 'Employés (contrainte UNIQUE)',
    risk: 'LOW'
  }
};

function buildDuplicateQuery(table, columns) {
  const columnsList = columns.join(', ');
  const groupByColumns = columns.map(col => `${col}`).join(', ');
  
  return `
    SELECT 
      ${columnsList},
      COUNT(*) as duplicate_count,
      ARRAY_AGG(id ORDER BY id) as duplicate_ids
    FROM ${table}
    WHERE ${columns.map(col => `${col} IS NOT NULL`).join(' AND ')}
    GROUP BY ${groupByColumns}
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, ${columns[0]};
  `;
}

async function checkDuplicates() {
  const client = await pool.connect();
  const results = {
    summary: { totalTables: 0, tablesWithDuplicates: 0, totalDuplicates: 0 },
    details: []
  };

  try {
    console.log('\n🔍 VÉRIFICATION DES DOUBLONS DANS LA BASE DE DONNÉES');
    console.log('='.repeat(70));

    for (const [tableName, config] of Object.entries(TABLES_TO_CHECK)) {
      results.summary.totalTables++;
      
      console.log(`\n📊 Table: ${tableName} [${config.risk}]`);
      console.log(`   Description: ${config.description}`);
      console.log(`   Colonnes: ${config.columns.join(', ')}`);

      try {
        const query = buildDuplicateQuery(tableName, config.columns);
        const result = await client.query(query);

        if (result.rows.length > 0) {
          results.summary.tablesWithDuplicates++;
          const duplicateCount = result.rows.reduce((sum, row) => sum + (row.duplicate_count - 1), 0);
          results.summary.totalDuplicates += duplicateCount;

          console.log(`   ⚠️  DOUBLONS: ${result.rows.length} groupe(s), ${duplicateCount} doublon(s)`);
          
          result.rows.slice(0, 5).forEach((row, idx) => {
            console.log(`      ${idx + 1}. Count: ${row.duplicate_count}, IDs: [${row.duplicate_ids.join(', ')}]`);
          });

          if (result.rows.length > 5) {
            console.log(`      ... et ${result.rows.length - 5} autre(s) groupe(s)`);
          }

          results.details.push({
            table: tableName,
            risk: config.risk,
            duplicateGroups: result.rows.length,
            totalDuplicates: duplicateCount,
            samples: result.rows.slice(0, 3)
          });
        } else {
          console.log('   ✅ Aucun doublon');
        }
      } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📋 RÉSUMÉ');
    console.log('='.repeat(70));
    console.log(`Tables vérifiées: ${results.summary.totalTables}`);
    console.log(`Tables avec doublons: ${results.summary.tablesWithDuplicates}`);
    console.log(`Total doublons: ${results.summary.totalDuplicates}`);

    if (results.summary.tablesWithDuplicates > 0) {
      console.log('\n⚠️  ACTIONS RECOMMANDÉES:');
      console.log('   1. Examiner chaque groupe manuellement');
      console.log('   2. Identifier les enregistrements à conserver');
      console.log('   3. Supprimer les doublons: DELETE FROM table WHERE id = <id>;');
      console.log('   4. Ajouter contraintes UNIQUE si nécessaire');
    } else {
      console.log('\n✅ Aucun doublon détecté!');
    }

    const fs = require('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `duplicate-check-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Résultats: ${filename}`);

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('\n🚀 Démarrage...');
console.log('✅ Connecté à PostgreSQL\n');
checkDuplicates()
  .then(() => {
    console.log('\n✅ Vérification terminée!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erreur:', err);
    process.exit(1);
  });
