// scripts/cron-archive-logs.js
const cron = require('node-cron');
const logArchiveService = require('../services/logArchiveService');

console.log('🕐 Planificateur d\'archivage démarré');

// ✅ TÂCHE 1 : Archivage quotidien (tous les jours à 2h du matin)
cron.schedule('0 2 * * *', async () => {
  console.log('\n🌙 [CRON] Archivage quotidien - ' + new Date().toISOString());
  
  try {
    const result = await logArchiveService.archiveYesterdayLogs(true); // Supprimer après archivage
    
    console.log(`✅ Archivage quotidien terminé:
      - ${result.audit.archived} audit logs archivés
      - ${result.linking.archived} linking logs archivés
      - ${result.totalDeleted} logs supprimés de la DB
    `);

  } catch (error) {
    console.error('❌ Erreur archivage quotidien:', error);
  }
});

// ✅ TÂCHE 2 : Archivage mensuel (le 1er de chaque mois à 3h du matin)
cron.schedule('0 3 1 * *', async () => {
  console.log('\n📅 [CRON] Archivage mensuel - ' + new Date().toISOString());
  
  try {
    const result = await logArchiveService.archiveLastMonthLogs(true);
    
    console.log(`✅ Archivage mensuel terminé:
      - ${result.audit.archived} audit logs archivés
      - ${result.linking.archived} linking logs archivés
      - ${result.totalDeleted} logs supprimés de la DB
    `);

  } catch (error) {
    console.error('❌ Erreur archivage mensuel:', error);
  }
});

// ✅ TÂCHE 3 : Nettoyage des logs > 90 jours (tous les dimanches à 4h du matin)
cron.schedule('0 4 * * 0', async () => {
  console.log('\n🧹 [CRON] Nettoyage des logs > 90 jours - ' + new Date().toISOString());
  
  try {
    const pool = require('../config/database');
    
    const result = await pool.query(
      `DELETE FROM audit_log
       WHERE performed_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
       RETURNING id`
    );

    console.log(`✅ ${result.rowCount} vieux audit logs supprimés`);

    const linkingResult = await pool.query(
      `DELETE FROM transaction_linking_log
       WHERE performed_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
       RETURNING id`
    );

    console.log(`✅ ${linkingResult.rowCount} vieux linking logs supprimés`);

  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  }
});

console.log(`
✅ Planification activée:
  - 📅 Quotidien: 2h00 (archivage de la veille)
  - 📆 Mensuel: 1er du mois à 3h00 (archivage du mois précédent)
  - 🧹 Nettoyage: Dimanche 4h00 (suppression > 90 jours)
`);

// Empêcher le script de se terminer
process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du planificateur d\'archivage');
  process.exit(0);
});
