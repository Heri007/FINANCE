/**
 * Convertit une date en string ISO LOCAL (sans conversion UTC)
 * @param {Date|string} date - Date à convertir
 * @returns {string} - Format "YYYY-MM-DD" en heure locale
 */
export const toLocalISODate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d)) return null;
  
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Convertit une date en string ISO LOCAL avec heure (sans conversion UTC)
 * @param {Date|string} date - Date à convertir
 * @returns {string} - Format "YYYY-MM-DDTHH:mm:ss.sssZ" mais en gardant les composantes locales
 */
export const toLocalISOString = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d)) return null;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}T00:00:00.000Z`;
};

/**
 * Extrait la date AAAA-MM-JJ à partir d'une date (heure locale)
 * Remplace la fonction toYmd existante
 */
export const toYmd = (rawDate) => {
  if (!rawDate) return null;
  const d = new Date(rawDate);
  if (isNaN(d)) return null;
  
  // ✅ Utiliser les composantes locales au lieu de UTC
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
