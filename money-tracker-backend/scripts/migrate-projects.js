// scripts/migrate-projects.js

const ProjectMigrationService = require('../services/projectMigrationService');

async function main() {
  console.log('🚀 Script de migration des projets');
  console.log('='.repeat(50));
  
  const command = process.argv[2] || 'run';
  
  try {
    switch (command) {
      case 'run':
        console.log('🔄 Exécution de la migration...');
        const result = await ProjectMigrationService.migrateAllProjects();
        console.log('\n✅ Migration terminée avec succès!');
        break;
        
      case 'check':
        console.log('🔍 Vérification de l\'état...');
        await ProjectMigrationService.checkMigrationStatus();
        break;
        
      case 'rollback':
        const confirm = process.argv[3];
        if (confirm !== '--force') {
          console.log('❌ Pour rollback, utilisez: node migrate-projects.js rollback --force');
          console.log('⚠️  Cette opération supprimera toutes les lignes migrées!');
          process.exit(1);
        }
        await ProjectMigrationService.rollbackMigration();
        break;
        
      case 'help':
      default:
        console.log('📚 Commandes disponibles:');
        console.log('  node migrate-projects.js run      - Exécuter la migration');
        console.log('  node migrate-projects.js check    - Vérifier l\'état');
        console.log('  node migrate-projects.js rollback --force - Annuler (DANGEREUX)');
        console.log('  node migrate-projects.js help     - Afficher cette aide');
        break;
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécution
if (require.main === module) {
  main().then(() => {
    console.log('👋 Terminé');
    process.exit(0);
  });
}