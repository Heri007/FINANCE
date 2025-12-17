// scripts/verify-database.js
const pool = require('../config/database');
const chalk = require('chalk');

// ============================================================
// CONFIGURATION ATTENDUE
// ============================================================

const EXPECTED_TABLES = {
  users: {
    columns: ['id', 'username', 'pin_hash', 'created_at', 'updated_at'],
    constraints: ['users_pkey', 'users_username_key'],
  },
  accounts: {
    columns: ['id', 'name', 'type', 'balance', 'created_at', 'updated_at', 'user_id'],
    constraints: ['accounts_pkey', 'accounts_user_id_fkey'],
  },
  transactions: {
    columns: [
      'id',
      'account_id',
      'type',
      'amount',
      'category',
      'description',
      'created_at',
      'is_planned',
      'is_posted',
      'project_id',
      'project_line_id',
      'created_at',
      'remarks',
    ],
    constraints: ['transactions_pkey', 'transactions_account_id_fkey'],
  },
  projects: {
    columns: [
      'id',
      'name',
      'status',
      'expenses',
      'revenues',
      'allocation',
      'revenue_allocation',
      'created_at',
      'updated_at',
      'user_id',
    ],
    constraints: ['projects_pkey', 'projects_user_id_fkey'],
  },
  receivables: {
    columns: [
      'id',
      'description',
      'amount',
      'due_date',
      'status',
      'created_at',
      'updated_at',
      'user_id',
    ],
    constraints: ['receivables_pkey', 'receivables_user_id_fkey'],
  },
  backups: {
    columns: ['id', 'label', 'data', 'created_at', 'user_id'],
    constraints: ['backups_pkey', 'backups_user_id_fkey'],
  },
};

const EXPECTED_INDEXES = [
  'transactions_account_id_idx',
  'transactions_project_id_idx',
  'transactions_date_idx',
  'accounts_user_id_idx',
  'projects_user_id_idx',
  'receivables_user_id_idx',
];

// ============================================================
// FONCTIONS DE VÉRIFICATION
// ============================================================

async function checkTableExists(tableName) {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function getTableColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = $1
     ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows;
}

async function getTableConstraints(tableName) {
  const result = await pool.query(
    `SELECT constraint_name, constraint_type
     FROM information_schema.table_constraints
     WHERE table_name = $1`,
    [tableName]
  );
  return result.rows;
}

async function getIndexes(tableName) {
  const result = await pool.query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE tablename = $1`,
    [tableName]
  );
  return result.rows;
}

async function getRowCount(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    return null;
  }
}

async function checkForeignKeyIntegrity(tableName, fkColumn, refTable) {
  const result = await pool.query(
    `SELECT COUNT(*) as orphans
     FROM ${tableName} t
     WHERE t.${fkColumn} IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM ${refTable} r WHERE r.id = t.${fkColumn}
     )`
  );
  return parseInt(result.rows[0].orphans);
}

// ============================================================
// VÉRIFICATIONS SPÉCIFIQUES
// ============================================================

async function verifyTransactionsIntegrity() {
  console.log('\n' + chalk.blue('🔍 Vérification intégrité transactions...'));

  // Vérifier orphelins account_id
  const orphanAccounts = await checkForeignKeyIntegrity('transactions', 'account_id', 'accounts');
  if (orphanAccounts > 0) {
    console.log(chalk.red(`  ❌ ${orphanAccounts} transactions avec account_id invalide`));
  } else {
    console.log(chalk.green(`  ✅ Tous les account_id sont valides`));
  }

  // Vérifier orphelins project_id
  const orphanProjects = await checkForeignKeyIntegrity('transactions', 'project_id', 'projects');
  if (orphanProjects > 0) {
    console.log(chalk.red(`  ❌ ${orphanProjects} transactions avec project_id invalide`));
  } else {
    console.log(chalk.green(`  ✅ Tous les project_id sont valides`));
  }

  // Vérifier dates futures
  const futureDates = await pool.query(
    `SELECT COUNT(*) as count FROM transactions WHERE date > NOW() + INTERVAL '1 year'`
  );
  const futureCount = parseInt(futureDates.rows[0].count);
  if (futureCount > 0) {
    console.log(chalk.yellow(`  ⚠️  ${futureCount} transactions avec dates > 1 an futur`));
  } else {
    console.log(chalk.green(`  ✅ Aucune date aberrante`));
  }

  // Vérifier montants négatifs
  const negativeAmounts = await pool.query(
    `SELECT COUNT(*) as count FROM transactions WHERE amount < 0`
  );
  const negCount = parseInt(negativeAmounts.rows[0].count);
  if (negCount > 0) {
    console.log(chalk.red(`  ❌ ${negCount} transactions avec montants négatifs`));
  } else {
    console.log(chalk.green(`  ✅ Tous les montants sont positifs`));
  }
}

async function verifyAccountsBalance() {
  console.log('\n' + chalk.blue('🔍 Vérification soldes comptes...'));

  const result = await pool.query(`
    SELECT 
      a.id,
      a.name,
      a.balance as stored_balance,
      COALESCE(SUM(
        CASE 
          WHEN t.type = 'income' THEN t.amount
          WHEN t.type = 'expense' THEN -t.amount
          ELSE 0
        END
      ), 0) as calculated_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id AND t.is_posted = true
    GROUP BY a.id, a.name, a.balance
  `);

  let allMatch = true;
  result.rows.forEach((row) => {
    const diff = Math.abs(parseFloat(row.stored_balance) - parseFloat(row.calculated_balance));
    if (diff > 0.01) {
      console.log(
        chalk.red(
          `  ❌ ${row.name}: Stocké ${row.stored_balance} ≠ Calculé ${row.calculated_balance}`
        )
      );
      allMatch = false;
    }
  });

  if (allMatch) {
    console.log(chalk.green(`  ✅ Tous les soldes correspondent`));
  }
}

async function verifyProjectsJSON() {
  console.log('\n' + chalk.blue('🔍 Vérification JSON projects...'));

  const result = await pool.query(`SELECT id, name, expenses, revenues FROM projects`);

  let errors = 0;
  result.rows.forEach((row) => {
    // Vérifier expenses
    if (row.expenses) {
      if (typeof row.expenses === 'string') {
        console.log(chalk.yellow(`  ⚠️  Projet "${row.name}": expenses est string (devrait être JSON)`));
        errors++;
      } else if (!Array.isArray(row.expenses)) {
        console.log(chalk.red(`  ❌ Projet "${row.name}": expenses n'est pas un array`));
        errors++;
      }
    }

    // Vérifier revenues
    if (row.revenues) {
      if (typeof row.revenues === 'string') {
        console.log(chalk.yellow(`  ⚠️  Projet "${row.name}": revenues est string (devrait être JSON)`));
        errors++;
      } else if (!Array.isArray(row.revenues)) {
        console.log(chalk.red(`  ❌ Projet "${row.name}": revenues n'est pas un array`));
        errors++;
      }
    }
  });

  if (errors === 0) {
    console.log(chalk.green(`  ✅ Tous les champs JSON sont valides`));
  }
}

// ============================================================
// RAPPORT PRINCIPAL
// ============================================================

async function runVerification() {
  console.log(chalk.cyan('\n════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('  🔍 VÉRIFICATION COMPLÈTE BASE DE DONNÉES'));
  console.log(chalk.cyan('════════════════════════════════════════════════════════\n'));

  try {
    // Test connexion
    await pool.query('SELECT NOW()');
    console.log(chalk.green('✅ Connexion PostgreSQL OK\n'));

    // ========================================
    // 1. VÉRIFIER TABLES
    // ========================================
    console.log(chalk.blue('📋 Vérification des tables...\n'));

    for (const [tableName, config] of Object.entries(EXPECTED_TABLES)) {
      const exists = await checkTableExists(tableName);

      if (!exists) {
        console.log(chalk.red(`❌ Table "${tableName}" MANQUANTE`));
        continue;
      }

      console.log(chalk.green(`✅ Table "${tableName}" existe`));

      // Vérifier colonnes
      const columns = await getTableColumns(tableName);
      const columnNames = columns.map((c) => c.column_name);

      const missingColumns = config.columns.filter((c) => !columnNames.includes(c));
      if (missingColumns.length > 0) {
        console.log(chalk.red(`   ❌ Colonnes manquantes: ${missingColumns.join(', ')}`));
      }

      const extraColumns = columnNames.filter((c) => !config.columns.includes(c));
      if (extraColumns.length > 0) {
        console.log(chalk.yellow(`   ⚠️  Colonnes supplémentaires: ${extraColumns.join(', ')}`));
      }

      // Vérifier contraintes
      const constraints = await getTableConstraints(tableName);
      const constraintNames = constraints.map((c) => c.constraint_name);

      const missingConstraints = config.constraints.filter((c) => !constraintNames.includes(c));
      if (missingConstraints.length > 0) {
        console.log(chalk.yellow(`   ⚠️  Contraintes manquantes: ${missingConstraints.join(', ')}`));
      }

      // Compter lignes
      const count = await getRowCount(tableName);
      console.log(chalk.gray(`   📊 ${count} lignes\n`));
    }

    // ========================================
    // 2. VÉRIFIER INDEX
    // ========================================
    console.log(chalk.blue('\n📇 Vérification des index...\n'));

    for (const expectedIndex of EXPECTED_INDEXES) {
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = $1`,
        [expectedIndex]
      );

      if (result.rows.length > 0) {
        console.log(chalk.green(`✅ Index "${expectedIndex}" existe`));
      } else {
        console.log(chalk.yellow(`⚠️  Index "${expectedIndex}" MANQUANT`));
      }
    }

    // ========================================
    // 3. VÉRIFICATIONS SPÉCIFIQUES
    // ========================================
    await verifyTransactionsIntegrity();
    await verifyAccountsBalance();
    await verifyProjectsJSON();

    // ========================================
    // 4. STATISTIQUES GLOBALES
    // ========================================
    console.log('\n' + chalk.blue('📊 Statistiques globales...\n'));

    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM accounts) as accounts,
        (SELECT COUNT(*) FROM transactions) as transactions,
        (SELECT COUNT(*) FROM projects) as projects,
        (SELECT COUNT(*) FROM receivables) as receivables,
        (SELECT COUNT(*) FROM backups) as backups
    `);

    const s = stats.rows[0];
    console.log(chalk.cyan(`  👥 Utilisateurs: ${s.users}`));
    console.log(chalk.cyan(`  💰 Comptes: ${s.accounts}`));
    console.log(chalk.cyan(`  📝 Transactions: ${s.transactions}`));
    console.log(chalk.cyan(`  📁 Projets: ${s.projects}`));
    console.log(chalk.cyan(`  💵 Receivables: ${s.receivables}`));
    console.log(chalk.cyan(`  💾 Backups: ${s.backups}`));

    // ========================================
    // 5. TAILLE BASE DE DONNÉES
    // ========================================
    const sizeResult = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        pg_size_pretty(pg_total_relation_size('transactions')) as transactions_size,
        pg_size_pretty(pg_total_relation_size('backups')) as backups_size
    `);

    console.log('\n' + chalk.blue('💾 Taille des données...\n'));
    console.log(chalk.cyan(`  📦 Base totale: ${sizeResult.rows[0].db_size}`));
    console.log(chalk.cyan(`  📝 Table transactions: ${sizeResult.rows[0].transactions_size}`));
    console.log(chalk.cyan(`  💾 Table backups: ${sizeResult.rows[0].backups_size}`));

    console.log(chalk.cyan('\n════════════════════════════════════════════════════════'));
    console.log(chalk.green('✅ VÉRIFICATION TERMINÉE'));
    console.log(chalk.cyan('════════════════════════════════════════════════════════\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ ERREUR:'), error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// ============================================================
// EXÉCUTION
// ============================================================

runVerification();
