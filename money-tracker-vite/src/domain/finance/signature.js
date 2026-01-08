// src/domain/finance/signature.js
import { normalizeDate } from './parsers';

/**
 * Génère une signature unique pour une transaction
 * ⚠️ ALIGNÉ avec backend: accountId|date|amount|type|description
 *
 * @param {object} transaction - Transaction avec {accountId, date, amount, type, description, category}
 * @returns {string|null} Signature unique ou null si données manquantes
 */
export function buildTransactionSignature({
  accountId,
  date,
  amount,
  type,
  description,
  category,
}) {
  const cleanAccId = accountId ? String(accountId).trim() : null;
  const cleanDate = normalizeDate(date);
  const cleanAmount = amount != null ? Math.abs(parseFloat(amount)).toFixed(2) : null;
  const cleanType = type ? String(type).trim().toLowerCase() : null;

  // Fonction de nettoyage de texte (identique au backend)
  const cleanStr = (str) =>
    (str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:!?@#$%^&*()]/g, '')
      .substring(0, 40);

  const cleanDesc = cleanStr(description);
  const cleanCat = cleanStr(category);

  // Validation des champs essentiels
  if (!cleanAccId || !cleanDate || !cleanAmount || !cleanType) {
    return null;
  }

  // ✅ Signature complète avec description
  return `${cleanAccId}|${cleanDate}|${cleanAmount}|${cleanType}|${cleanDesc}`;
}

/**
 * Alias simple pour compatibilité (sans category dans la signature)
 * Utilisé par ImportModal
 */
export function transactionSignature(transaction) {
  return buildTransactionSignature({
    accountId: transaction.accountId || transaction.account_id,
    date: transaction.date,
    amount: transaction.amount,
    type: transaction.type,
    description: transaction.description || '',
    category: transaction.category || '',
  });
}

/**
 * Dédoublonne un tableau de transactions
 * @param {array} transactions - Transactions à dédoublonner
 * @returns {array} Transactions uniques
 */
export function deduplicateTransactions(transactions) {
  if (!Array.isArray(transactions)) {
    return [];
  }

  const seen = new Map();

  transactions.forEach((transaction) => {
    const sig = transactionSignature(transaction);

    if (sig && !seen.has(sig)) {
      seen.set(sig, transaction);
    }
  });

  const unique = Array.from(seen.values());

  console.log(`✅ Dédoublonnage: ${transactions.length} → ${unique.length} transactions`);

  return unique;
}

/**
 * Vérifie si une transaction existe déjà dans une liste
 * @param {object} transaction - Transaction à vérifier
 * @param {array} existingTransactions - Liste existante
 * @returns {boolean} true si la transaction existe déjà
 */
export function transactionExists(transaction, existingTransactions) {
  if (!Array.isArray(existingTransactions)) {
    return false;
  }

  const signature = transactionSignature(transaction);

  if (!signature) {
    return false;
  }

  return existingTransactions.some((existing) => {
    return transactionSignature(existing) === signature;
  });
}
