// scripts/recategorize.js - Script de recatégorisation pour PostgreSQL
const pool = require('../config/database.js');
require('dotenv').config();

// 🎯 Règles de catégorisation (ordre d'importance)
const categorizationRules = [
  // 🚫 TRANSFERTS (à marquer pour exclusion)
  {
    patterns: [/transfert vers/i, /transfert depuis/i, /retrait \d+/i],
    category: 'Transfert Interne',
    newType: 'transfer'
  },
  
  // 🚖 TRANSPORT
  {
    patterns: [/bajaj/i, /taxi/i, /transport/i, /tnr/i, /tve/i, /tvé/i, /carburant/i],
    category: 'Transport'
  },
  
  // 🍽️ ALIMENTATION
  {
    patterns: [
      /sakafo/i, /voan-dalana/i, /café/i, /hotely/i, 
      /atoandro/i, /laoka/i, /patte/i, /saucisse/i,
      /coca/i, /restaurant/i
    ],
    category: 'Alimentation'
  },
  
  // 🍻 LOISIRS / AFTERWORK
  {
    patterns: [/afterwork/i, /queens/i, /loisir/i, /sortie/i],
    category: 'Loisirs'
  },
  
  // 📰 INFORMATION / PRESSE
  {
    patterns: [/news/i, /journal/i, /presse/i],
    category: 'Information'
  },
  
  // 👕 HABILLEMENT
  {
    patterns: [/t-shirt/i, /vêtement/i, /habit/i, /chaussure/i],
    category: 'Habillement'
  },
  
  // 🏥 SANTÉ
  {
    patterns: [/dentiste/i, /médecin/i, /docteur/i, /pharmacie/i, /santé/i],
    category: 'Santé'
  },
  
  // 💼 SERVICES PROFESSIONNELS
  {
    patterns: [/comptable/i, /divorce/i, /avocat/i, /notaire/i, /juridique/i],
    category: 'Services Professionnels'
  },
  
  // 📱 TÉLÉCOMMUNICATIONS
  {
    patterns: [
      /carte telma/i, /orange/i, /airtel/i, /connexion/i, 
      /internet/i, /téléphone/i, /crédits phone/i,
      /mora/i, /yellow/i, /netweek/i
    ],
    category: 'Télécommunications'
  },
  
  // 💻 ABONNEMENTS / LOGICIELS
  {
    patterns: [/perplexity/i, /premium/i, /abonnement/i, /subscription/i],
    category: 'Abonnements'
  },
  
  // 🏠 LOGEMENT / HÉBERGEMENT
  {
    patterns: [/hébergement/i, /hebergement/i, /loyer/i, /logement/i],
    category: 'Logement'
  },
  
  // 🚗 VÉHICULES / AUTOMOBILE
  {
    patterns: [
      /achat voiture/i, /coût d'achat/i, /voiture/i, 
      /moto/i, /cotisse/i, /assurance/i
    ],
    category: 'Automobile'
  },
  
  // 👥 DONS / AIDE / PRÊTS
  {
    patterns: [
      /@[a-zA-Z]+/i, // Tout ce qui contient @NOM
      /doit @/i, /aide/i, /prêt/i, /don/i
    ],
    category: 'Dons & Aide'
  },
  
  // 📄 FRAIS DIVERS
  {
    patterns: [
      /frais/i, /commission/i, /bé \d+/i, 
      /photocopie/i, /impression/i
    ],
    category: 'Frais Divers'
  }
];

// 🔍 Fonction pour trouver la catégorie appropriée
function findCategory(description) {
  for (const rule of categorizationRules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(description)) {
        return {
          category: rule.category,
          newType: rule.newType || null
        };
      }
    }
  }
  return { category: 'Autre', newType: null };
}

// 📊 Fonction principale
async function recategorizeTransactions() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 DÉBUT DE LA RECATÉGORISATION...\n');
    
    // Récupérer toutes les transactions de type "expense"
    const result = await client.query(
      `SELECT id, description, category, amount, transaction_date, type 
       FROM transactions 
       WHERE type = 'expense' 
       ORDER BY transaction_date DESC`
    );

    const rows = result.rows;
    console.log(`📋 ${rows.length} dépenses trouvées\n`);

    let updated = 0;
    let excluded = 0;
    let unchanged = 0;

    // Traiter chaque transaction
    for (const row of rows) {
      const result = findCategory(row.description);
      const newCategory = result.category;
      const newType = result.newType;

      // Si c'est un transfert, on le marque avec type "transfer"
      if (newType === 'transfer') {
        excluded++;
        console.log(`🚫 EXCLUSION : "${row.description}" → ${newCategory}`);
        
        await client.query(
          `UPDATE transactions 
           SET category = $1, type = $2 
           WHERE id = $3`,
          [newCategory, 'transfer', row.id]
        );
        continue;
      }

      // Si la catégorie change
      if (newCategory !== row.category && newCategory !== 'Autre') {
        updated++;
        const shortDesc = row.description.length > 50 
          ? row.description.substring(0, 50) + '...' 
          : row.description;
        console.log(`✅ "${shortDesc}" : ${row.category} → ${newCategory}`);
        
        await client.query(
          `UPDATE transactions 
           SET category = $1 
           WHERE id = $2`,
          [newCategory, row.id]
        );
        continue;
      }

      unchanged++;
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📊 RÉSUMÉ DE LA RECATÉGORISATION');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Transactions mises à jour : ${updated}`);
    console.log(`🚫 Transferts exclus : ${excluded}`);
    console.log(`➖ Inchangées : ${unchanged}`);
    console.log(`📋 Total traité : ${rows.length}`);
    console.log('═══════════════════════════════════════\n');
    
    return { updated, excluded, unchanged, total: rows.length };

  } catch (err) {
    console.error('❌ Erreur:', err);
    throw err;
  } finally {
    client.release();
  }
}

// 🎯 Exécution
if (require.main === module) {
  recategorizeTransactions()
    .then(() => {
      console.log('✅ Recatégorisation terminée avec succès !');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Erreur fatale :', err);
      process.exit(1);
    });
}

module.exports = { recategorizeTransactions, findCategory };
