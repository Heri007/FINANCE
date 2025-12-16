// src/domain/finance/parsers.js

// Normalise une date en 'YYYY-MM-DD'
export function normalizeDate(input) {
  if (!input) return null;

  // Déjà au bon format
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  // Formats avec slashs (ex: 31/12/2025 ou 31/12/25)
  if (typeof input === 'string' && input.includes('/')) {
    try {
      const parts = input.split(' ')[0].split('/');
      if (parts.length === 3) {
        let [day, month, year] = parts;
        if (year.length === 2) year = '20' + year;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    } catch {
      // fallback plus bas
    }
  }

  // ISO complète ou objet Date
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

// Parse JSON “souple” (string, array, object) → toujours un array
export function parseJSONSafe(data) {
  if (!data || data === 'null') return [];
  try {
    if (typeof data === 'string') {
      const trimmed = data.trim();
      if (!trimmed || trimmed === '[]') return [];
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    }
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') return [data];
    return [];
  } catch {
    return [];
  }
}

/**
 * Parse les dépenses d'un projet
 * @param {string|array} data - Données expenses
 * @returns {array} Array des dépenses
 */
export function parseExpenses(data) {
  return parseJSONSafe(data);
}

/**
 * Parse les revenus d'un projet
 * Alias de parseExpenses (même logique)
 * @param {string|array} data - Données revenues
 * @returns {array} Array des revenus
 */
export function parseRevenues(data) {
  return parseJSONSafe(data);
}

/**
 * Parse et valide un montant
 * @param {string|number} amount - Montant à parser
 * @returns {number} Montant numérique (0 si invalide)
 */
export function parseAmount(amount) {
  if (typeof amount === 'number') {
    return isNaN(amount) ? 0 : amount;
  }

  if (typeof amount === 'string') {
    // Retirer espaces et remplacer virgules par points
    const cleaned = amount.replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}
