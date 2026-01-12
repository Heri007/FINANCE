// scripts/test-csv-import.js
const fs = require('fs');
const csv = require('csv-parser');

async function testCsvImport(csvFile) {
  console.log(`\n📄 TEST: ${csvFile}\n`);

  const transactions = [];
  
  await new Promise((resolve) => {
    fs.createReadStream(csvFile)
      .pipe(csv())
      .on('data', (row) => {
        transactions.push(row);
      })
      .on('end', resolve);
  });

  console.log(`📊 Total transactions dans le CSV: ${transactions.length}`);
  
  // Analyser les dates
  const dates = transactions
    .map(t => t.TRAN_DATE)
    .filter(Boolean)
    .sort();
  
  if (dates.length > 0) {
    console.log(`📅 Période: ${dates[0]} → ${dates[dates.length - 1]}`);
  }

  // Analyser les montants
  let totalIncome = 0;
  let totalExpense = 0;
  
  transactions.forEach(t => {
    const amount = parseFloat(t.QUANTITÉ || '0');
    if (amount > 0) {
      totalIncome += amount;
    } else {
      totalExpense += Math.abs(amount);
    }
  });

  console.log(`💰 Revenus: ${totalIncome.toLocaleString('fr-FR')} Ar`);
  console.log(`💸 Dépenses: ${totalExpense.toLocaleString('fr-FR')} Ar`);
  console.log(`📊 Solde net: ${(totalIncome - totalExpense).toLocaleString('fr-FR')} Ar`);
}

// Tester chaque fichier
Promise.resolve()
  .then(() => testCsvImport('mvola_mga.csv'))
  .then(() => testCsvImport('argent_liquide_mga.csv'))
  .then(() => testCsvImport('boa_mga.csv'))
  .catch(console.error);
