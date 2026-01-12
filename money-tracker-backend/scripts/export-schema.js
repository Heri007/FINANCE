#!/usr/bin/env node

/**
 * Script d'export du schéma PostgreSQL
 * Génère un fichier schema.sql à partir de la DB actuelle
 * Usage: node scripts/export-schema.js
 */

require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_DATABASE || 'moneytracker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'HRPIRATES',
  outputFile: path.join(__dirname, '../schema.sql'),
  backupFile: path.join(__dirname, '../schema-backup.sql')
};

// Couleurs
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

/**
 * Backup de l'ancien schema.sql si existe
 */
function backupOldSchema() {
  if (fs.existsSync(CONFIG.outputFile)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = CONFIG.outputFile.replace('.sql', `-${timestamp}.sql`);
    fs.copyFileSync(CONFIG.outputFile, backupPath);
    log.success(`Ancien schéma sauvegardé: ${path.basename(backupPath)}`);
    return backupPath;
  }
  return null;
}

/**
 * Exporter le schéma avec pg_dump
 */
async function exportSchema() {
  log.title('📤 EXPORT DU SCHÉMA POSTGRESQL');
  
  log.info(`Base de données: ${CONFIG.database}`);
  log.info(`Utilisateur: ${CONFIG.user}`);
  log.info(`Fichier de sortie: ${CONFIG.outputFile}`);
  
  // Backup ancien fichier
  backupOldSchema();
  
  // Commande pg_dump pour exporter UNIQUEMENT le schéma (sans données)
  const pgDumpCommand = `PGPASSWORD="${CONFIG.password}" pg_dump \
    -h ${CONFIG.host} \
    -p ${CONFIG.port} \
    -U ${CONFIG.user} \
    -d ${CONFIG.database} \
    --schema-only \
    --no-owner \
    --no-privileges \
    --schema=public \
    -f "${CONFIG.outputFile}"`;
  
  try {
    log.info('Exécution de pg_dump...');
    
    const { stdout, stderr } = await execAsync(pgDumpCommand);
    
    if (stderr && !stderr.includes('NOTICE')) {
      log.warn(`Avertissements: ${stderr}`);
    }
    
    // Vérifier que le fichier a été créé
    if (fs.existsSync(CONFIG.outputFile)) {
      const stats = fs.statSync(CONFIG.outputFile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      const lines = fs.readFileSync(CONFIG.outputFile, 'utf8').split('\n').length;
      
      log.success(`Schéma exporté avec succès!`);
      log.info(`Taille: ${sizeKB} KB`);
      log.info(`Lignes: ${lines}`);
      log.info(`Chemin: ${CONFIG.outputFile}`);
      
      // Afficher un aperçu
      displayPreview();
      
      // Générer des statistiques
      await generateStats();
      
      return true;
    } else {
      log.error('Le fichier schema.sql n\'a pas été créé');
      return false;
    }
  } catch (error) {
    log.error(`Erreur lors de l'export: ${error.message}`);
    
    if (error.message.includes('pg_dump: command not found')) {
      log.warn('');
      log.warn('pg_dump n\'est pas installé ou pas dans le PATH');
      log.warn('Installation:');
      log.warn('  macOS: brew install postgresql');
      log.warn('  Ubuntu: sudo apt-get install postgresql-client');
      log.warn('  Windows: Télécharger depuis postgresql.org');
    }
    
    return false;
  }
}

/**
 * Afficher un aperçu du fichier
 */
function displayPreview() {
  log.title('📋 APERÇU DU SCHÉMA');
  
  const content = fs.readFileSync(CONFIG.outputFile, 'utf8');
  const lines = content.split('\n');
  
  // Compter les éléments
  const tables = (content.match(/CREATE TABLE/gi) || []).length;
  const functions = (content.match(/CREATE (OR REPLACE )?FUNCTION/gi) || []).length;
  const views = (content.match(/CREATE (OR REPLACE )?VIEW/gi) || []).length;
  const triggers = (content.match(/CREATE TRIGGER/gi) || []).length;
  const indexes = (content.match(/CREATE( UNIQUE)? INDEX/gi) || []).length;
  
  console.log(`${colors.bright}Contenu:${colors.reset}`);
  console.log(`  ${colors.green}Tables:${colors.reset} ${tables}`);
  console.log(`  ${colors.green}Fonctions:${colors.reset} ${functions}`);
  console.log(`  ${colors.green}Vues:${colors.reset} ${views}`);
  console.log(`  ${colors.green}Triggers:${colors.reset} ${triggers}`);
  console.log(`  ${colors.green}Indexes:${colors.reset} ${indexes}`);
  console.log(`  ${colors.green}Total lignes:${colors.reset} ${lines.length}`);
}

/**
 * Générer un fichier de statistiques
 */
async function generateStats() {
  const pool = require('../config/database');
  
  try {
    // Récupérer les stats des tables
    const tablesQuery = `
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
    `;
    
    const result = await pool.query(tablesQuery);
    
    // Créer fichier stats
    const statsPath = CONFIG.outputFile.replace('.sql', '-stats.txt');
    let statsContent = `SCHEMA STATISTICS - ${new Date().toLocaleString('fr-FR')}\n`;
    statsContent += `${'='.repeat(60)}\n\n`;
    statsContent += `Database: ${CONFIG.database}\n`;
    statsContent += `Export file: ${path.basename(CONFIG.outputFile)}\n\n`;
    statsContent += `TABLES BY SIZE:\n`;
    statsContent += `${'-'.repeat(40)}\n`;
    
    result.rows.forEach((row, i) => {
      statsContent += `${String(i + 1).padStart(2)}. ${row.tablename.padEnd(30)} ${row.size}\n`;
    });
    
    fs.writeFileSync(statsPath, statsContent);
    log.success(`Statistiques: ${path.basename(statsPath)}`);
    
    await pool.end();
  } catch (error) {
    log.warn(`Impossible de générer les stats: ${error.message}`);
  }
}

/**
 * Exporter avec options avancées
 */
async function exportWithData() {
  log.title('📤 EXPORT COMPLET (SCHÉMA + DONNÉES)');
  
  const outputWithData = CONFIG.outputFile.replace('.sql', '-with-data.sql');
  
  const pgDumpCommand = `PGPASSWORD="${CONFIG.password}" pg_dump \
    -h ${CONFIG.host} \
    -p ${CONFIG.port} \
    -U ${CONFIG.user} \
    -d ${CONFIG.database} \
    --no-owner \
    --no-privileges \
    --schema=public \
    -f "${outputWithData}"`;
  
  try {
    log.info('Export du schéma + données...');
    await execAsync(pgDumpCommand);
    
    const stats = fs.statSync(outputWithData);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    log.success(`Export complet réussi!`);
    log.info(`Fichier: ${path.basename(outputWithData)}`);
    log.info(`Taille: ${sizeMB} MB`);
    
    return true;
  } catch (error) {
    log.error(`Erreur: ${error.message}`);
    return false;
  }
}

/**
 * Mode principal
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bright}Export du schéma PostgreSQL${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/export-schema.js [options]

${colors.cyan}Options:${colors.reset}
  --schema-only    Export uniquement le schéma (défaut)
  --with-data      Export schéma + données
  --stats          Afficher les statistiques après export
  -h, --help       Afficher cette aide

${colors.cyan}Exemples:${colors.reset}
  node scripts/export-schema.js
  node scripts/export-schema.js --with-data
  node scripts/export-schema.js --schema-only --stats
    `);
    process.exit(0);
  }
  
  console.clear();
  log.title('🗄️  EXPORT DU SCHÉMA POSTGRESQL - FINANCE');
  
  // Export du schéma seul
  const success = await exportSchema();
  
  if (!success) {
    process.exit(1);
  }
  
  // Export avec données si demandé
  if (args.includes('--with-data')) {
    await exportWithData();
  }
  
  log.title('✅ TERMINÉ');
  process.exit(0);
}

// Exécution
main();
