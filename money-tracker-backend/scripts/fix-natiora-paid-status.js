const pool = require('../config/database');

async function fixNatioraPaidStatus() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(`
      UPDATE project_expense_lines 
      SET is_paid = true, 
          actual_amount = projected_amount,
          last_synced_at = NOW()
      WHERE project_id = 24 
      AND description IN (
        'Bâtiment Oies (60 m²)',
        'Bâtiment Kuroiler (40 m²)',
        'Bâtiment Poulets locaux (40 m²)',
        'Équipements durables (mangeoires, abreuvoirs, ventilation)',
        'Clôture et sécurité site Bypass',
        'Fonds de roulement initial'
      )
      RETURNING description, projected_amount
    `);
    
    console.log(`✅ ${result.rows.length} dépenses marquées comme payées :`);
    result.rows.forEach(row => {
      console.log(`  - ${row.description}: ${row.projected_amount} Ar`);
    });
    
    await client.query('COMMIT');
    console.log('\n✅ Statuts mis à jour avec succès');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

fixNatioraPaidStatus();
