// src/domain/finance/signature.js
import { normalizeDate } from './parsers';

// Signature “officielle” pour dédoublonnage (frontend & backend alignables)
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
  const cleanAmount =
    amount != null ? Math.abs(parseFloat(amount)).toFixed(2) : null;
  const cleanType = type ? String(type).trim().toLowerCase() : null;

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

  if (!cleanAccId || !cleanDate || !cleanAmount || !cleanType) {
    return null;
  }

  return `${cleanAccId}|${cleanDate}|${cleanAmount}|${cleanType}|${cleanDesc}|${cleanCat}`;
}
