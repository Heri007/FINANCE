// scripts/test-archive.js
const logArchiveService = require('../services/logArchiveService');

async function test() {
  console.log('🧪 TEST D\'ARCHIVAGE\n');

  try {
    // Test 1 : Archiver la veille (sans supprimer)
    console.log('1️⃣ Archivage de la veille (sans suppression)...');
    const result = await logArchiveService.archiveYesterdayLogs(false);
    
    console.log(`   ✅ Résultat:
      - Audit logs: ${result.audit.archived} archivés
      - Linking logs: ${result.linking.archived} archivés
      - Fichiers créés: ${result.audit.filepath}, ${result.linking.filepath}
    `);

    // Test 2 : Lister les archives
    console.log('\n2️⃣ Liste des archives audit...');
    const archives = await logArchiveService.listArchives('audit');
    console.log(`   ${archives.length} archives trouvées`);
    archives.slice(0, 3).forEach(a => {
      console.log(`   - ${a.filename} (${a.sizeHuman})`);
    });

    console.log('\n✅ Tests réussis!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur test:', error);
    process.exit(1);
  }
}

test();
