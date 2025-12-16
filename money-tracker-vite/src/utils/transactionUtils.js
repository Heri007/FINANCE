// src/utils/transactionUtils.js

/**
 * Normaliser une date vers le format YYYY-MM-DD en respectant le fuseau local
 * Évite le bug du jour précédent (J-1) dû à toISOString()
 */
export function normalizeDate(d) {
  if (!d) return null;

  // 1. Si c'est déjà une chaîne propre YYYY-MM-DD
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;

  try {
    // 2. Gestion format DD/MM/YYYY (fréquent dans les CSV francophones)
    if (typeof d === 'string' && d.includes('/')) {
      const parts = d.split(' ')[0].split('/');
      if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) year = '20' + year;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // 3. Gestion Objet Date ou ISO string
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return null;

    // ⚠️ CORRECTION IMPORTANTE : Utiliser les méthodes locales pour éviter le décalage UTC
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;

  } catch (e) {
    console.error("Erreur normalisation date:", d, e);
    return null;
  }
}

/**
 * Créer une signature unique pour une transaction (Deduplication)
 * ⚠️ ALIGNÉ À 100% AVEC LE BACKEND (importController.createSig)
 * 
 * Règles strictes pour correspondre au backend:
 * - Date au format YYYY-MM-DD (tronqué si ISO)
 * - Montant: Math.abs().toFixed(2)
 * - Description: accents supprimés, espaces compressés en UN espace (pas supprimés),
 *   ponctuation [.,;:!?@#$%^&*()] retirée, tronqué à 40 caractères
 * - PAS de catégorie dans la signature
 */
export function createSignature(accountId, date, amount, type, description) {
  const cleanAccId = accountId ? String(accountId).trim() : null;
  
  // Date normalisée puis tronquée (si ISO complet type "2024-12-15T12:00:00")
  let cleanDate = normalizeDate(date);
  if (cleanDate && cleanDate.includes('T')) {
    cleanDate = cleanDate.split('T')[0];
  }
  
  // Montant absolu avec 2 décimales
  const cleanAmount = amount !== null && amount !== undefined 
    ? Math.abs(parseFloat(amount)).toFixed(2) 
    : null;
    
  const cleanType = type ? String(type).trim().toLowerCase() : null;
  
  // ⚠️ IMPORTANT: Nettoyage IDENTIQUE au backend
  const cleanDesc = description 
    ? String(description)
        .trim()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Enlève les accents
        .replace(/\s+/g, ' ')                              // Compresse espaces multiples en UN espace
        .replace(/[.,;:!?@#$%^&*()]/g, '')                // Retire ponctuation spécifique
        .substring(0, 40)                                  // Tronque à 40 caractères
    : '';
  
  if (!cleanAccId || !cleanDate || !cleanAmount || !cleanType) return null;
  
  // Format: accountId|date|amount|type|description (PAS de catégorie)
  return `${cleanAccId}|${cleanDate}|${cleanAmount}|${cleanType}|${cleanDesc}`;
}

/**
 * Indexer les transactions existantes pour recherche rapide
 */
export function indexTransactions(transactions) {
  const index = new Map();
  
  if (!Array.isArray(transactions)) return index;

  transactions.forEach(t => {
    // Gestion snake_case (DB) ou camelCase (App)
    const accId = t.account_id || t.accountId;
    const dateVal = t.transaction_date || t.date;

    const sig = createSignature(
      accId,
      dateVal,
      t.amount,
      t.type,
      t.description
    );
    
    if (sig) index.set(sig, { id: t.id, description: t.description });
  });
  
  return index;
}

/**
 * Filtrer les nouvelles transactions (Détecter doublons)
 */
export function filterNewTransactions(imported, existingIndex) {
  const newTransactions = [];
  const duplicates = [];
  const invalid = [];
  
  // Copie de l'index pour gérer les doublons au sein même du fichier importé
  const localIndex = new Map(existingIndex);
  
  imported.forEach((trx, i) => {
    // Gestion souple des noms de propriétés
    const accId = trx.account_id || trx.accountId;
    const dateVal = trx.transaction_date || trx.date;

    const sig = createSignature(accId, dateVal, trx.amount, trx.type, trx.description);
    
    if (!sig) {
      invalid.push({ index: i + 1, trx, reason: 'Données manquantes ou invalides' });
    } else if (localIndex.has(sig)) {
      duplicates.push({ index: i + 1, trx, existing: localIndex.get(sig) });
    } else {
      newTransactions.push(trx);
      // On ajoute immédiatement à l'index local pour bloquer si la ligne se répète dans le CSV
      localIndex.set(sig, { new: true, description: trx.description });
    }
  });
  
  return { newTransactions, duplicates, invalid };
}

/**
 * Calculer l'impact financier sur les comptes
 */
export function calculateImpact(transactions, accounts) {
  const impact = {};
  
  transactions.forEach(trx => {
    const accId = trx.account_id || trx.accountId;
    if (!accId) return;

    if (!impact[accId]) {
      const acc = accounts.find(a => String(a.id) === String(accId));
      impact[accId] = {
        name: acc?.name || `Compte #${accId}`,
        currentBalance: parseFloat(acc?.balance || 0),
        income: 0,
        expense: 0,
        count: 0,
        finalBalance: parseFloat(acc?.balance || 0)
      };
    }
    
    const amount = parseFloat(trx.amount || 0);
    impact[accId].count++;
    
    if (trx.type === 'income') {
      impact[accId].income += amount;
      impact[accId].finalBalance += amount;
    } else {
      impact[accId].expense += amount;
      impact[accId].finalBalance -= amount;
    }
  });
  
  return impact;
}
