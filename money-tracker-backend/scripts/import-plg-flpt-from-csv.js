// scripts/import-plg-flpt-from-csv.js
// Usage : node scripts/import-plg-flpt-from-csv.js

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// chemins
const csvDir = path.join(__dirname, '..', 'csv');
const csvPath = path.join(csvDir, 'PLG-FLPT.csv');
const jsonOutPath = path.join(csvDir, 'PLG-FLPT-expenses.json');

// Helpers
function cleanNumber(str) {
  if (!str) return 0;
  return parseFloat(
    String(str)
      .replace(/\s/g, '')
      .replace(/,/g, '')
  ) || 0;
}

async function readCsv(filePath) {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return new Promise((resolve, reject) => {
    parse(
      content,
      { columns: true, skip_empty_lines: true, trim: true },
      (err, records) => (err ? reject(err) : resolve(records))
    );
  });
}

function mapRowToExpense(row) {
  const designation = row['Désignation']?.trim();
  const qty = cleanNumber(row['Qté'] || 1);
  const pu = cleanNumber(row['PU']);
  const montantCol = cleanNumber(row['Montant (ariary)']);

  if (!designation) return null;
  if (['TOTAL INVEST', 'Commission HIROKO'].includes(designation)) return null;

  const amount = montantCol || qty * pu;

  return {
    category: 'Investissement',
    amount,
    account: 'Déjà Payé',
    isRecurring: false,
    description: designation,
    phase: 'investissement',
  };
}

async function main() {
  console.log('🔎 Lecture CSV:', csvPath);

  const rows = await readCsv(csvPath);
  const expenses = rows
    .map(mapRowToExpense)
    .filter(Boolean);

  console.log('✅ Lignes CSV lues :', rows.length);
  console.log('✅ Dépenses générées :', expenses.length);
  console.log('💾 Écriture JSON:', jsonOutPath);

  await fs.promises.writeFile(
    jsonOutPath,
    JSON.stringify(expenses, null, 2),
    'utf8'
  );

  console.log('✅ Fichier JSON créé.');
}

main().catch((err) => {
  console.error('❌ Erreur import PLG-FLPT:', err);
  process.exit(1);
});
