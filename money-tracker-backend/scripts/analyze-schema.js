#!/usr/bin/env node

/**
 * Script d'analyse du schéma PostgreSQL
 * Affiche la structure complète de la base de données
 * Usage: node scripts/analyze-schema.js
 */

require('dotenv').config();
const pool = require('../config/database');

// Couleurs pour console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n`)
};

/**
 * Récupérer toutes les tables
 */
async function getTables() {
  const query = `
    SELECT 
      schemaname,
      tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
      pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Récupérer les colonnes d'une table
 */
async function getColumns(tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      column_default,
      is_nullable,
      CASE 
        WHEN column_name = 'id' THEN 'PK'
        WHEN column_name LIKE '%_id' THEN 'FK'
        ELSE ''
      END as key_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Récupérer les contraintes (FK, UNIQUE, CHECK)
 */
async function getConstraints(tableName) {
  const query = `
    SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      CASE con.contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
        ELSE con.contype::text
      END AS type_label,
      pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = $1
    ORDER BY con.contype
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Récupérer les indexes
 */
async function getIndexes(tableName) {
  const query = `
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = $1
    ORDER BY indexname
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

/**
 * Récupérer le nombre de lignes
 */
async function getRowCount(tableName) {
  try {
    const result = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    return 'N/A';
  }
}

/**
 * Récupérer les fonctions/procédures
 */
async function getFunctions() {
  const query = `
    SELECT 
      proname AS function_name,
      pg_get_function_arguments(oid) AS arguments,
      pg_get_functiondef(oid) AS definition
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND prokind = 'f'
    ORDER BY proname
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Récupérer les vues
 */
async function getViews() {
  const query = `
    SELECT 
      viewname,
      definition
    FROM pg_views
    WHERE schemaname = 'public'
    ORDER BY viewname
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Récupérer les triggers
 */
async function getTriggers() {
  const query = `
    SELECT 
      trigger_name,
      event_object_table AS table_name,
      action_statement,
      action_timing,
      event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Afficher les statistiques globales
 */
async function displayGlobalStats() {
  log.title('STATISTIQUES GLOBALES DE LA BASE DE DONNÉES');
  
  // Taille totale de la DB
  const dbSize = await pool.query(`
    SELECT pg_size_pretty(pg_database_size(current_database())) as size
  `);
  
  // Nombre de tables
  const tableCount = await pool.query(`
    SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'
  `);
  
  // Nombre de colonnes total
  const columnCount = await pool.query(`
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_schema = 'public'
  `);
  
  // Nombre d'indexes
  const indexCount = await pool.query(`
    SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'
  `);
  
  // Nombre de contraintes
  const constraintCount = await pool.query(`
    SELECT COUNT(*) FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = connamespace
    WHERE nsp.nspname = 'public'
  `);
  
  console.log(`${colors.bright}Base de données:${colors.reset} ${colors.cyan}${process.env.DB_DATABASE}${colors.reset}`);
  console.log(`${colors.bright}Taille totale:${colors.reset} ${colors.green}${dbSize.rows[0].size}${colors.reset}`);
  console.log(`${colors.bright}Tables:${colors.reset} ${colors.yellow}${tableCount.rows[0].count}${colors.reset}`);
  console.log(`${colors.bright}Colonnes:${colors.reset} ${columnCount.rows[0].count}`);
  console.log(`${colors.bright}Indexes:${colors.reset} ${indexCount.rows[0].count}`);
  console.log(`${colors.bright}Contraintes:${colors.reset} ${constraintCount.rows[0].count}`);
}

/**
 * Afficher les tables
 */
async function displayTables() {
  log.title('TABLES (Triées par taille)');
  
  const tables = await getTables();
  
  console.log('┌─────┬─────────────────────────────┬────────────┬──────────────┐');
  console.log('│ #   │ Table                       │ Taille     │ Lignes       │');
  console.log('├─────┼─────────────────────────────┼────────────┼──────────────┤');
  
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const rowCount = await getRowCount(table.tablename);
    const rowCountStr = typeof rowCount === 'number' ? rowCount.toLocaleString('fr-FR') : rowCount;
    
    console.log(
      `│ ${String(i + 1).padEnd(3)} │ ${table.tablename.padEnd(27)} │ ${table.size.padEnd(10)} │ ${rowCountStr.padStart(12)} │`
    );
  }
  
  console.log('└─────┴─────────────────────────────┴────────────┴──────────────┘');
}

/**
 * Afficher les détails d'une table
 */
async function displayTableDetails(tableName) {
  log.section(`📋 TABLE: ${tableName.toUpperCase()}`);
  
  // Colonnes
  const columns = await getColumns(tableName);
  console.log(`${colors.bright}Colonnes (${columns.length}):${colors.reset}`);
  console.log('┌───────────────────────────┬─────────────────┬──────────┬──────────────────────┐');
  console.log('│ Nom                       │ Type            │ Nullable │ Par défaut           │');
  console.log('├───────────────────────────┼─────────────────┼──────────┼──────────────────────┤');
  
  columns.forEach(col => {
    const typeStr = col.character_maximum_length 
      ? `${col.data_type}(${col.character_maximum_length})`
      : col.data_type;
    
    const keyIcon = col.key_type === 'PK' ? '🔑 ' : col.key_type === 'FK' ? '🔗 ' : '';
    
    console.log(
      `│ ${(keyIcon + col.column_name).padEnd(25)} │ ${typeStr.padEnd(15)} │ ${col.is_nullable.padEnd(8)} │ ${(col.column_default || '').substring(0, 20).padEnd(20)} │`
    );
  });
  
  console.log('└───────────────────────────┴─────────────────┴──────────┴──────────────────────┘\n');
  
  // Contraintes
  const constraints = await getConstraints(tableName);
  if (constraints.length > 0) {
    console.log(`${colors.bright}Contraintes (${constraints.length}):${colors.reset}`);
    constraints.forEach(con => {
      console.log(`  ${colors.yellow}${con.type_label}${colors.reset}: ${con.constraint_name}`);
      console.log(`    ${colors.cyan}${con.definition}${colors.reset}`);
    });
    console.log('');
  }
  
  // Indexes
  const indexes = await getIndexes(tableName);
  if (indexes.length > 0) {
    console.log(`${colors.bright}Indexes (${indexes.length}):${colors.reset}`);
    indexes.forEach(idx => {
      console.log(`  ${colors.green}${idx.indexname}${colors.reset}`);
    });
    console.log('');
  }
}

/**
 * Afficher les fonctions
 */
async function displayFunctions() {
  log.title('FONCTIONS PL/pgSQL');
  
  const functions = await getFunctions();
  
  if (functions.length === 0) {
    log.warn('Aucune fonction trouvée');
    return;
  }
  
  console.log(`${colors.bright}Total: ${functions.length} fonction(s)${colors.reset}\n`);
  
  functions.forEach((func, index) => {
    console.log(`${colors.bright}${index + 1}. ${func.function_name}${colors.reset}(${func.arguments || 'void'})`);
    console.log(`${colors.cyan}${func.definition.substring(0, 200)}...${colors.reset}\n`);
  });
}

/**
 * Afficher les vues
 */
async function displayViews() {
  log.title('VUES');
  
  const views = await getViews();
  
  if (views.length === 0) {
    log.warn('Aucune vue trouvée');
    return;
  }
  
  console.log(`${colors.bright}Total: ${views.length} vue(s)${colors.reset}\n`);
  
  views.forEach((view, index) => {
    console.log(`${colors.bright}${index + 1}. ${view.viewname}${colors.reset}`);
    console.log(`${colors.cyan}${view.definition.substring(0, 150)}...${colors.reset}\n`);
  });
}

/**
 * Afficher les triggers
 */
async function displayTriggers() {
  log.title('TRIGGERS');
  
  const triggers = await getTriggers();
  
  if (triggers.length === 0) {
    log.warn('Aucun trigger trouvé');
    return;
  }
  
  console.log(`${colors.bright}Total: ${triggers.length} trigger(s)${colors.reset}\n`);
  
  // Grouper par table
  const byTable = {};
  triggers.forEach(trg => {
    if (!byTable[trg.table_name]) {
      byTable[trg.table_name] = [];
    }
    byTable[trg.table_name].push(trg);
  });
  
  Object.entries(byTable).forEach(([table, trgs]) => {
    console.log(`${colors.bright}${table}:${colors.reset}`);
    trgs.forEach(trg => {
      console.log(`  ${colors.green}${trg.trigger_name}${colors.reset}`);
      console.log(`    ${trg.action_timing} ${trg.event_manipulation}`);
      console.log(`    ${colors.cyan}${trg.action_statement}${colors.reset}`);
    });
    console.log('');
  });
}

/**
 * Générer un diagramme ERD en texte
 */
async function generateERD() {
  log.title('DIAGRAMME ERD (Relations)');
  
  const query = `
    SELECT
      tc.table_name AS table_from,
      kcu.column_name AS column_from,
      ccu.table_name AS table_to,
      ccu.column_name AS column_to,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, ccu.table_name
  `;
  
  const result = await pool.query(query);
  const relations = result.rows;
  
  if (relations.length === 0) {
    log.warn('Aucune relation Foreign Key trouvée');
    return;
  }
  
  console.log(`${colors.bright}Total: ${relations.length} relation(s) Foreign Key${colors.reset}\n`);
  
  // Grouper par table source
  const byTable = {};
  relations.forEach(rel => {
    if (!byTable[rel.table_from]) {
      byTable[rel.table_from] = [];
    }
    byTable[rel.table_from].push(rel);
  });
  
  Object.entries(byTable).forEach(([table, rels]) => {
    console.log(`${colors.bright}${colors.blue}${table}${colors.reset}`);
    rels.forEach(rel => {
      console.log(`  │`);
      console.log(`  ├─${colors.cyan}${rel.column_from}${colors.reset} → ${colors.green}${rel.table_to}${colors.reset}.${rel.column_to}`);
    });
    console.log('');
  });
}

/**
 * Exporter le schéma en Markdown
 */
async function exportToMarkdown(tables) {
  const fs = require('fs');
  const path = require('path');
  
  let markdown = `# 📊 Schéma de Base de Données - FINANCE\n\n`;
  markdown += `**Date de génération:** ${new Date().toLocaleString('fr-FR')}\n\n`;
  markdown += `---\n\n`;
  
  // Statistiques globales
  const dbSize = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
  markdown += `## 📈 Statistiques Globales\n\n`;
  markdown += `- **Base de données:** ${process.env.DB_DATABASE}\n`;
  markdown += `- **Taille totale:** ${dbSize.rows[0].size}\n`;
  markdown += `- **Nombre de tables:** ${tables.length}\n\n`;
  markdown += `---\n\n`;
  
  // Liste des tables
  markdown += `## 📑 Tables\n\n`;
  markdown += `| # | Table | Taille | Lignes |\n`;
  markdown += `|---|-------|--------|--------|\n`;
  
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    const rowCount = await getRowCount(table.tablename);
    const rowCountStr = typeof rowCount === 'number' ? rowCount.toLocaleString('fr-FR') : rowCount;
    markdown += `| ${i + 1} | \`${table.tablename}\` | ${table.size} | ${rowCountStr} |\n`;
  }
  
  markdown += `\n---\n\n`;
  
  // Détails de chaque table
  markdown += `## 🗂️ Détails des Tables\n\n`;
  
  for (const table of tables) {
    markdown += `### ${table.tablename}\n\n`;
    
    const columns = await getColumns(table.tablename);
    const rowCount = await getRowCount(table.tablename);
    
    markdown += `**Lignes:** ${typeof rowCount === 'number' ? rowCount.toLocaleString('fr-FR') : rowCount} | `;
    markdown += `**Taille:** ${table.size}\n\n`;
    
    // Colonnes
    markdown += `#### Colonnes\n\n`;
    markdown += `| Nom | Type | Nullable | Défaut | Clé |\n`;
    markdown += `|-----|------|----------|--------|-----|\n`;
    
    columns.forEach(col => {
      const typeStr = col.character_maximum_length 
        ? `${col.data_type}(${col.character_maximum_length})`
        : col.data_type;
      const defaultStr = (col.column_default || '-').substring(0, 30);
      markdown += `| \`${col.column_name}\` | ${typeStr} | ${col.is_nullable} | ${defaultStr} | ${col.key_type} |\n`;
    });
    
    markdown += `\n`;
    
    // Contraintes
    const constraints = await getConstraints(table.tablename);
    if (constraints.length > 0) {
      markdown += `#### Contraintes\n\n`;
      constraints.forEach(con => {
        markdown += `- **${con.type_label}:** \`${con.constraint_name}\`\n`;
        markdown += `  \`\`\`sql\n  ${con.definition}\n  \`\`\`\n`;
      });
      markdown += `\n`;
    }
    
    // Indexes
    const indexes = await getIndexes(table.tablename);
    if (indexes.length > 0) {
      markdown += `#### Indexes\n\n`;
      indexes.forEach(idx => {
        markdown += `- \`${idx.indexname}\`\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
  }
  
  // Fonctions
  const functions = await getFunctions();
  if (functions.length > 0) {
    markdown += `## ⚙️ Fonctions PL/pgSQL\n\n`;
    functions.forEach((func, i) => {
      markdown += `### ${i + 1}. ${func.function_name}\n\n`;
      markdown += `**Arguments:** \`${func.arguments || 'void'}\`\n\n`;
      markdown += `\`\`\`sql\n${func.definition}\n\`\`\`\n\n`;
    });
  }
  
  // Vues
  const views = await getViews();
  if (views.length > 0) {
    markdown += `## 👁️ Vues\n\n`;
    views.forEach((view, i) => {
      markdown += `### ${i + 1}. ${view.viewname}\n\n`;
      markdown += `\`\`\`sql\n${view.definition}\n\`\`\`\n\n`;
    });
  }
  
  // Sauvegarder
  const filePath = path.join(__dirname, '../docs/DATABASE_SCHEMA.md');
  const docsDir = path.join(__dirname, '../docs');
  
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  fs.writeFileSync(filePath, markdown);
  log.success(`Documentation exportée: ${filePath}`);
}

/**
 * Menu interactif
 */
async function showMenu() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise(resolve => rl.question(query, resolve));
  
  console.clear();
  log.title('🗄️  ANALYSEUR DE SCHÉMA POSTGRESQL - FINANCE');
  
  console.log(`${colors.bright}Options:${colors.reset}`);
  console.log(`  ${colors.green}1${colors.reset} - Statistiques globales`);
  console.log(`  ${colors.green}2${colors.reset} - Liste des tables`);
  console.log(`  ${colors.green}3${colors.reset} - Détails d'une table`);
  console.log(`  ${colors.green}4${colors.reset} - Toutes les tables (détaillées)`);
  console.log(`  ${colors.green}5${colors.reset} - Fonctions PL/pgSQL`);
  console.log(`  ${colors.green}6${colors.reset} - Vues`);
  console.log(`  ${colors.green}7${colors.reset} - Triggers`);
  console.log(`  ${colors.green}8${colors.reset} - Relations (ERD)`);
  console.log(`  ${colors.green}9${colors.reset} - Exporter en Markdown`);
  console.log(`  ${colors.green}0${colors.reset} - Analyse complète`);
  console.log(`  ${colors.red}q${colors.reset} - Quitter\n`);
  
  const choice = await question('Votre choix: ');
  
  try {
    switch (choice.trim()) {
      case '1':
        await displayGlobalStats();
        break;
      case '2':
        await displayTables();
        break;
      case '3':
        const tables = await getTables();
        console.log('\nTables disponibles:');
        tables.forEach((t, i) => console.log(`  ${i + 1}. ${t.tablename}`));
        const tableChoice = await question('\nNuméro de la table: ');
        const selectedTable = tables[parseInt(tableChoice) - 1];
        if (selectedTable) {
          await displayTableDetails(selectedTable.tablename);
        } else {
          log.warn('Table invalide');
        }
        break;
      case '4':
        const allTables = await getTables();
        for (const table of allTables) {
          await displayTableDetails(table.tablename);
        }
        break;
      case '5':
        await displayFunctions();
        break;
      case '6':
        await displayViews();
        break;
      case '7':
        await displayTriggers();
        break;
      case '8':
        await generateERD();
        break;
      case '9':
        const tablesForExport = await getTables();
        await exportToMarkdown(tablesForExport);
        break;
      case '0':
        await displayGlobalStats();
        await displayTables();
        await displayFunctions();
        await displayViews();
        await displayTriggers();
        await generateERD();
        const tablesForFull = await getTables();
        await exportToMarkdown(tablesForFull);
        break;
      case 'q':
      case 'Q':
        log.info('Au revoir!');
        rl.close();
        await pool.end();
        process.exit(0);
        return;
      default:
        log.warn('Choix invalide');
    }
    
    console.log('\n' + '─'.repeat(60) + '\n');
    const continueChoice = await question('Continuer? (o/n): ');
    
    if (continueChoice.toLowerCase() === 'o') {
      rl.close();
      await showMenu();
    } else {
      rl.close();
      await pool.end();
      log.success('Terminé!');
      process.exit(0);
    }
  } catch (error) {
    log.warn(`Erreur: ${error.message}`);
    rl.close();
    await pool.end();
    process.exit(1);
  }
}

/**
 * Mode CLI (sans interaction)
 */
async function runCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Mode interactif
    await showMenu();
    return;
  }
  
  const command = args[0];
  
  try {
    switch (command) {
      case 'stats':
        await displayGlobalStats();
        break;
      case 'tables':
        await displayTables();
        break;
      case 'table':
        if (!args[1]) {
          log.warn('Usage: node analyze-schema.js table <nom_table>');
          break;
        }
        await displayTableDetails(args[1]);
        break;
      case 'functions':
        await displayFunctions();
        break;
      case 'views':
        await displayViews();
        break;
      case 'triggers':
        await displayTriggers();
        break;
      case 'erd':
        await generateERD();
        break;
      case 'export':
        const tables = await getTables();
        await exportToMarkdown(tables);
        break;
      case 'full':
        await displayGlobalStats();
        await displayTables();
        await displayFunctions();
        await displayViews();
        await displayTriggers();
        await generateERD();
        break;
      default:
        console.log('Usage: node analyze-schema.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  stats      - Statistiques globales');
        console.log('  tables     - Liste des tables');
        console.log('  table <nom> - Détails d\'une table');
        console.log('  functions  - Fonctions PL/pgSQL');
        console.log('  views      - Vues');
        console.log('  triggers   - Triggers');
        console.log('  erd        - Diagramme ERD');
        console.log('  export     - Exporter en Markdown');
        console.log('  full       - Analyse complète');
        console.log('');
        console.log('Sans argument: mode interactif');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    log.warn(`Erreur: ${error.message}`);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

// Exécution
runCLI();
