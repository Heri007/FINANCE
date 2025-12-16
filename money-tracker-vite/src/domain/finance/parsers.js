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
