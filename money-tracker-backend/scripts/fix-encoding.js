const fs = require('fs');
const path = require('path');

// Chemin vers le fichier à corriger
const filePath = path.join(__dirname, '..', 'src', 'OperatorDashboard.jsx');

// Map de tous les remplacements nécessaires
// Utilisation de codes hexadécimaux pour éviter les problèmes d'encodage
const replacements = {
  // Emojis corrompus
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5C\uD835\uDC4A': '\uD83D\uDCCA', // 📊
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5C\uD835\uDC49': '\uD83D\uDCC5', // 📅
  '\uD835\uDC53\uD835\uDC56\uD835\uDC4E\uD835\uDC5D': '\uD83C\uDFAF', // 🎯
  '\uD835\uDC53\uD835\uDC5C\uD835\uDC59\uD835\uDC5C': '\uD83D\uDCB0', // 💰
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5C\uD835\uDC4B': '\uD83D\uDCC8', // 📈
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5C': '\uD83D\uDCDD', // 📝
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5C\uD835\uDC44': '\uD83D\uDCC4', // 📄
  '\uD835\uDC53\uD835\uDC56\uD835\uDC5B \uD835\uDC56\uD835\uDC6D': '\uD83D\uDEE0\uFE0F', // 🛠️
  
  // Caractères français corrompus
  'â€¢': '•',
  'TÃ¢ches': 'Tâches',
  'tÃ¢ches': 'tâches',
  'Ã ': 'à',
  'prÃ©vu': 'prévu',
  'PrÃ©visionnels': 'Prévisionnels',
  'EstimÃ©': 'Estimé',
  'Ã‰tapes': 'Étapes',
  'Ã©tapes': 'étapes',
  'dÃ©fini': 'défini',
  'l\'exÃ©cution': 'l\'exécution',
  'RÃ©tro': 'Rétro',
  'EntrÃ©es': 'Entrées',
  'Ã‰viter': 'Éviter',
  'qualitÃ©': 'qualité',
  'coÃ»ts': 'coûts',
  'PrÃªt': 'Prêt',
  'Ã€ faire': 'À faire',
  'assignÃ©': 'assigné',
  'amÃ©liorer': 'améliorer',
  'GÃ©nÃ©rÃ©': 'Généré',
  'OpÃ©rationnelles': 'Opérationnelles'
};

// Vérifier que le fichier existe
if (!fs.existsSync(filePath)) {
  console.error('ERREUR: Fichier introuvable:', filePath);
  process.exit(1);
}

// Lire le fichier
console.log('Lecture du fichier:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

let totalReplacements = 0;

// Appliquer tous les remplacements
Object.entries(replacements).forEach(([bad, good]) => {
  const regex = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  if (matches) {
    console.log(`  - Remplacement: "${bad}" -> "${good}" (${matches.length} occurrences)`);
    totalReplacements += matches.length;
    content = content.replace(regex, good);
  }
});

// Sauvegarder avec encodage UTF-8
fs.writeFileSync(filePath, content, { encoding: 'utf8' });

console.log('\nRESULTAT:');
console.log('  Corrections appliquées:', totalReplacements);
console.log('  Fichier sauvegardé avec encodage UTF-8');
console.log('\nRECHARGEZ votre application React (Ctrl+R ou Cmd+R dans le navigateur)');
