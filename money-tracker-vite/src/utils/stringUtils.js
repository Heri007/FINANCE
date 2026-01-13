/**
 * Utilitaires pour manipulation de chaînes de caractères
 * Utilisé pour normaliser les descriptions dans les modals
 */

/**
 * Normalise une chaîne pour comparaison fiable
 * - Supprime les accents
 * - Convertit en minuscules
 * - Remplace les espaces multiples par un seul
 * - Supprime les caractères spéciaux diacritiques
 * 
 * @param {string} str - La chaîne à normaliser
 * @returns {string} - La chaîne normalisée
 * 
 * @example
 * normalizeDescription("  Achat   Poussins   ") // "achat poussins"
 * normalizeDescription("Redevance Minière") // "redevance miniere"
 */
export const normalizeDescription = (str) => {
  if (!str) return '';
  
  return str
    .trim()
    .toLowerCase()
    // Remplacer espaces multiples par un seul
    .replace(/\s+/g, ' ')
    // Remplacer les accents communs
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[ý]/g, 'y')
    // Normaliser les caractères Unicode et supprimer les diacritiques
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * Compare deux descriptions de manière robuste
 * 
 * @param {string} desc1 - Première description
 * @param {string} desc2 - Deuxième description
 * @returns {boolean} - true si les descriptions matchent
 */
export const matchDescriptions = (desc1, desc2) => {
  const normalized1 = normalizeDescription(desc1);
  const normalized2 = normalizeDescription(desc2);
  return normalized1 === normalized2 && normalized1.length > 0;
};

/**
 * Vérifie si une chaîne contient un mot-clé (insensible à la casse et aux accents)
 * 
 * @param {string} str - La chaîne à chercher
 * @param {string} keyword - Le mot-clé à trouver
 * @returns {boolean}
 */
export const containsKeyword = (str, keyword) => {
  const normalizedStr = normalizeDescription(str);
  const normalizedKeyword = normalizeDescription(keyword);
  return normalizedStr.includes(normalizedKeyword);
};

/**
 * Tronque une chaîne avec ellipse si trop longue
 * 
 * @param {string} str - La chaîne à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string}
 */
export const truncate = (str, maxLength = 50) => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};
