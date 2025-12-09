// scripts/diagnostic-csv.js
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const CSV_FOLDER = path.join(__dirname, '..', 'csv');

async function analyzeCsv(filename) {
  console.log(`\n📄 ${filename}`);
  const fullPath = path.join(CSV_FOLDER, filename);
  
  if (!fs.existsSync(fullPath)) {
    console.log('   ⚠️  Fichier introuvable');
    return;
  }
  
  const transactions = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(fullPath)
      .pipe(csv())
      .on('data', (row) => transactions.push(row))
      .on('end', resolve)
      .on('error', reject);
  });
  
  let balance = 0;
  transactions.forEach(trx => {
    const amount = parseFloat((trx['QUANTITÉ'] || trx['QUANTITE'] || '0').replace(',', '.'));
    balance += amount;
  });
  
  console.log(`   Total lignes: ${transactions.length}`);
  console.log(`   Solde net: ${balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} Ar`);
  console.log(`   Premières transactions:`);
  transactions.slice(0, 3).forEach((trx, i) => {
    const amount = parseFloat((trx['QUANTITÉ'] || trx['QUANTITE'] || '0').replace(',', '.'));
    console.log(`      ${i + 1}. ${trx['PAYEE_ITEM_DESC']} : ${amount.toLocaleString('fr-FR')} Ar`);
  });
}

async function main() {
  console.log('🔍 DIAGNOSTIC DES CSV\n');
  
  await analyzeCsv('argent_liquide_mga.csv');
  await analyzeCsv('mvola_mga.csv');
  await analyzeCsv('orange_money_mga.csv');
  await analyzeCsv('boa_mga.csv');
  await analyzeCsv('coffre_mga.csv');
  await analyzeCsv('avoir_mga.csv');
}

main();
