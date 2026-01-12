// scripts/test-audit.js
const pool = require('../config/database');

async function testAudit() {
  console.log('🧪 TEST DU SYSTÈME D\'AUDIT\n');

  try {
    // Test 1 : Modifier une transaction
    console.log('1️⃣ Modification d\'une transaction...');
    await pool.query(
      `UPDATE transactions 
       SET description = 'TEST AUDIT - ' || description 
       WHERE id = 1`
    );
    console.log('   ✅ Transaction modifiée\n');

    // Test 2 : Vérifier que c'est loggé
    console.log('2️⃣ Vérification de l\'audit_log...');
    const auditResult = await pool.query(
      `SELECT * FROM audit_log 
       WHERE table_name = 'transactions' 
       ORDER BY performed_at DESC 
       LIMIT 1`
    );
    
    if (auditResult.rows.length > 0) {
      const log = auditResult.rows[0];
      console.log('   ✅ Entrée d\'audit créée:');
      console.log('      ID:', log.id);
      console.log('      Opération:', log.operation);
      console.log('      Champs modifiés:', log.changed_fields);
      console.log('      Par:', log.performed_by);
      console.log('      Quand:', log.performed_at);
      console.log('      Anciennes valeurs:', JSON.stringify(log.old_data, null, 2).substring(0, 200));
      console.log('      Nouvelles valeurs:', JSON.stringify(log.new_data, null, 2).substring(0, 200));
    } else {
      console.log('   ❌ Aucune entrée d\'audit trouvée');
    }

    console.log('\n3️⃣ Restauration...');
    await pool.query(
      `UPDATE transactions 
       SET description = REPLACE(description, 'TEST AUDIT - ', '') 
       WHERE id = 1`
    );
    console.log('   ✅ Transaction restaurée\n');

    // Test 3 : Statistiques
    console.log('4️⃣ Statistiques d\'audit...');
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT table_name) as tables_tracked,
        MIN(performed_at) as oldest_log,
        MAX(performed_at) as newest_log
      FROM audit_log`
    );
    console.log('   Stats:', statsResult.rows[0]);

    // Test 4 : Dernières modifications par table
    console.log('\n5️⃣ Dernières modifications par table...');
    const recentResult = await pool.query(
      `SELECT 
        table_name,
        COUNT(*) as count,
        MAX(performed_at) as last_change
      FROM audit_log
      WHERE performed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      GROUP BY table_name
      ORDER BY count DESC
      LIMIT 10`
    );
    
    console.log('   Modifications des 7 derniers jours:');
    recentResult.rows.forEach(row => {
      console.log(`      - ${row.table_name}: ${row.count} modifications`);
    });

    console.log('\n✅ Tous les tests passés avec succès!\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur test audit:', error);
    process.exit(1);
  }
}

testAudit();

