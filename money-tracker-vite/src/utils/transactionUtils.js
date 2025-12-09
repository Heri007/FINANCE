// src/utils/transactionUtils.js

/**
 * Normaliser une date vers le format YYYY-MM-DD
 */
export function normalizeDate(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  try {
    if (typeof d === 'string' && d.includes('/')) {
      const parts = d.split(' ')[0].split('/');
      if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) year = '20' + year;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return null;

    return dateObj.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Créer une signature unique pour une transaction
 */
export function createSignature(accountId, date, amount, type, description) {
  const cleanAccId = accountId ? String(accountId).trim() : null;
  const cleanDate = normalizeDate(date);
  const cleanAmount = amount !== null ? Math.abs(parseFloat(amount)).toFixed(2) : null;
  const cleanType = type ? String(type).trim().toLowerCase() : null;
  
  const cleanDesc = description 
    ? String(description).trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '').replace(/[.,!?]/g, '').substring(0, 40)
    : null;
  
  if (!cleanAccId || !cleanDate || !cleanAmount || !cleanType) return null;
  
  return `${cleanAccId}|${cleanDate}|${cleanAmount}|${cleanType}|${cleanDesc}`;
}

/**
 * Indexer les transactions existantes
 */
export function indexTransactions(transactions) {
  const index = new Map();
  
  transactions.forEach(t => {
    const sig = createSignature(
      t.account_id || t.accountId,
      t.transaction_date || t.date,
      t.amount,
      t.type,
      t.description
    );
    if (sig) index.set(sig, { id: t.id, description: t.description, amount: t.amount });
  });
  
  return index;
}

/**
 * Filtrer les nouvelles transactions (sans doublons)
 */
export function filterNewTransactions(imported, existingIndex) {
  const newTrx = [], duplicates = [], invalid = [];
  const localIndex = new Map(existingIndex);
  
  imported.forEach((trx, i) => {
    const sig = createSignature(trx.accountId, trx.date, trx.amount, trx.type, trx.description);
    
    if (!sig) {
      invalid.push({ index: i + 1, trx, reason: 'Données invalides' });
    } else if (localIndex.has(sig)) {
      duplicates.push({ index: i + 1, trx, existing: localIndex.get(sig) });
    } else {
      newTrx.push(trx);
      localIndex.set(sig, { new: true });
    }
  });
  
  return { newTransactions: newTrx, duplicates, invalid };
}

/**
 * Calculer l'impact des transactions sur les soldes
 */
export function calculateImpact(transactions, accounts) {
  const impact = {};
  
  transactions.forEach(trx => {
    if (!impact[trx.accountId]) {
      const acc = accounts.find(a => a.id === trx.accountId);
      impact[trx.accountId] = {
        name: acc?.name || 'Inconnu',
        currentBalance: parseFloat(acc?.balance || 0),
        income: 0, expense: 0, count: 0
      };
    }
    
    impact[trx.accountId].count++;
    if (trx.type === 'income') impact[trx.accountId].income += parseFloat(trx.amount);
    else impact[trx.accountId].expense += parseFloat(trx.amount);
  });
  
  return impact;
}
