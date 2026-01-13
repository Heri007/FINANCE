/**
 * Helpers communs pour les modals de projets
 * Utilisé dans CarriereModal, LivestockModal, ExportModal, ProductFlipModal
 */

import { normalizeDescription } from './stringUtils';

/**
 * Déduplique un tableau de lignes (expenses ou revenues)
 * Priorité : dbLineId > description+montant
 * 
 * @param {Array} items - Tableau de lignes à dédupliquer
 * @returns {Array} - Tableau sans doublons
 */
export const deduplicateLines = (items) => {
  if (!Array.isArray(items)) return [];
  
  const seenIds = new Set();
  const seenDescAmounts = new Set();
  
  return items.filter(item => {
    // Déduplication par dbLineId (priorité 1)
    if (item.dbLineId) {
      if (seenIds.has(item.dbLineId)) {
        console.warn(`🔄 Doublon dbLineId supprimé: ${item.description} (${item.dbLineId})`);
        return false;
      }
      seenIds.add(item.dbLineId);
    }
    
    // Déduplication par description+montant (priorité 2)
    const amount = parseFloat(item.amount || 0).toFixed(2);
    const key = `${normalizeDescription(item.description)}_${amount}`;
    
    if (seenDescAmounts.has(key)) {
      console.warn(`🔄 Doublon desc+montant supprimé: ${item.description}`);
      return false;
    }
    seenDescAmounts.add(key);
    
    return true;
  });
};

/**
 * Match une ligne JSON avec une ligne DB
 * Retourne l'index de la ligne JSON ou -1
 * 
 * @param {Array} jsonLines - Lignes du JSON (expenses/revenues)
 * @param {Object} dbLine - Ligne de la DB (expenseLine/revenueLine)
 * @returns {number} - Index de la ligne JSON ou -1
 */
export const findMatchingLine = (jsonLines, dbLine) => {
  if (!Array.isArray(jsonLines) || !dbLine) return -1;
  
  return jsonLines.findIndex(line => {
    // PRIORITÉ 1: Match par dbLineId (100% fiable)
    if (line.dbLineId && dbLine.id && line.dbLineId === dbLine.id) {
      return true;
    }
    
    // PRIORITÉ 2: Match par description + montant (90% fiable)
    const descMatch = normalizeDescription(line.description) === normalizeDescription(dbLine.description);
    
    const lineAmount = parseFloat(line.amount || 0);
    const dbAmount = parseFloat(dbLine.projectedamount || dbLine.projectedAmount || 0);
    const amountMatch = Math.abs(lineAmount - dbAmount) < 0.01;
    
    // LES DEUX doivent matcher!
    return descMatch && amountMatch;
  });
};

/**
 * Standardise le message de confirmation de paiement/encaissement
 * 
 * @param {string} type - 'expense' ou 'income'
 * @param {string} amount - Montant formaté (ex: "1 500 000 Ar")
 * @param {string} account - Nom du compte
 * @returns {boolean} - true si "Déjà fait", false si "Créer transaction"
 */
export const confirmPayment = (type, amount, account) => {
  const emoji = type === 'expense' ? '💳' : '💰';
  const action = type === 'expense' ? 'PAIEMENT' : 'ENCAISSEMENT';
  const verb = type === 'expense' ? 'payée' : 'encaissé';
  const accountAction = type === 'expense' ? 'débiter' : 'créditer';
  const noun = type === 'expense' ? 'dépense' : 'revenu';
  
  return window.confirm(
    `${emoji} ${action}: ${amount}
` +
    `Compte: ${account}

` +
    `❓ Cette ${noun} a-t-elle DÉJÀ été ${verb} physiquement?

` +
    `✅ OUI → Cliquez OK
` +
    `   (on marque juste comme ${verb}, SANS créer de transaction)

` +
    `❌ NON → Cliquez Annuler
` +
    `   (on va créer la transaction et ${accountAction} le compte)`
  );
};

/**
 * Parse une liste qui peut être JSON string ou array
 * 
 * @param {string|Array} data - Données à parser
 * @returns {Array} - Tableau parsé ou vide
 */
export const parseList = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Erreur parsing liste:', error);
    return [];
  }
};

/**
 * Fusionne les transactions réelles avec les lignes de prévision
 * 
 * @param {Array} lines - Lignes de prévision (expenses/revenues)
 * @param {Array} transactions - Transactions réelles
 * @param {string} type - 'expense' ou 'income'
 * @param {Array} accounts - Liste des comptes
 * @returns {Array} - Lignes fusionnées
 */
export const mergeTransactionsWithLines = (lines, transactions, type, accounts) => {
  if (!Array.isArray(lines)) return [];
  if (!Array.isArray(transactions)) return lines;
  
  return lines.map(line => {
    // Chercher transaction correspondante
    const tx = transactions.find(t => 
      t.type === type && 
      String(t.projectlineid || t.projectLineId) === String(line.dbLineId)
    );
    
    if (tx) {
      const account = accounts.find(a => a.id === (tx.accountid || tx.accountId));
      
      return {
        ...line,
        isPaid: true,
        account: account?.name || 'Inconnu',
        realDate: tx.transactiondate ? new Date(tx.transactiondate) : null,
      };
    }
    
    return line;
  });
};

/**
 * Valide qu'une ligne a tous les champs requis
 * 
 * @param {Object} line - Ligne à valider
 * @param {string} type - 'expense' ou 'income'
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export const validateLine = (line, type) => {
  const errors = [];
  
  if (!line.description || line.description.trim().length === 0) {
    errors.push('Description manquante');
  }
  
  if (!line.amount || parseFloat(line.amount) <= 0) {
    errors.push('Montant invalide');
  }
  
  if (!line.category) {
    errors.push('Catégorie manquante');
  }
  
  if (!line.date) {
    errors.push('Date manquante');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};
