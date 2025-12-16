// src/services/authService.js
import { apiRequest } from './api';

/**
 * Service d'authentification centralisé
 * Utilise apiRequest pour bénéficier de:
 * - Gestion automatique des erreurs 401
 * - Headers standardisés (Content-Type, Authorization)
 * - Configuration centralisée via VITE_API_URL
 * - Event 'auth:logout' sur session expirée
 */
export const authService = {
  /**
   * Vérifier si un PIN existe dans la base de données
   * @returns {Promise<{exists: boolean}>}
   */
  checkPin: async () => {
    try {
      const data = await apiRequest('/api/auth/check-pin', {
        method: 'GET',
      });
      return data; // { exists: true/false }
    } catch (error) {
      console.error('Erreur checkPin:', error);
      // En cas d'erreur, on assume qu'il n'existe pas
      return { exists: false };
    }
  },

  /**
   * Créer un nouveau PIN (premier accès)
   * Sauvegarde automatiquement le token reçu
   * @param {string} pin - Le code PIN à créer (4-6 chiffres)
   * @returns {Promise<{token: string, success: boolean}>}
   */
  setupPin: async (pin) => {
    try {
      const data = await apiRequest('/api/auth/setup-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });

      // Sauvegarder le token
      if (data.token) {
        localStorage.setItem('token', data.token);
        
        // ✅ Notifier UserContext du nouveau token
        window.dispatchEvent(new CustomEvent('auth:login', { 
          detail: { token: data.token } 
        }));
      }

      return data;
    } catch (error) {
      console.error('Erreur setupPin:', error);
      throw new Error(error.message || 'Erreur lors de la création du PIN');
    }
  },

  /**
   * Se connecter avec le PIN
   * Sauvegarde automatiquement le token reçu
   * @param {string} pin - Le code PIN pour se connecter
   * @returns {Promise<{token: string, success: boolean}>}
   */
  loginWithPin: async (pin) => {
    try {
      const data = await apiRequest('/api/auth/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });

      // Sauvegarder le token
      if (data.token) {
        localStorage.setItem('token', data.token);
        
        // ✅ Notifier UserContext du nouveau token
        window.dispatchEvent(new CustomEvent('auth:login', { 
          detail: { token: data.token } 
        }));
      }

      return data;
    } catch (error) {
      console.error('Erreur loginWithPin:', error);
      throw new Error(error.message || 'PIN incorrect');
    }
  },

  /**
   * Vérifier si le token JWT actuel est valide
   * @returns {Promise<{valid: boolean}>}
   */
  verifyToken: async () => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return { valid: false };
    }

    try {
      const result = await apiRequest('/api/auth/verify-token', {
        method: 'GET',
      });
      
      return { valid: true, ...result };
    } catch (error) {
      // Si erreur 401, le token est invalide/expiré
      // apiRequest a déjà nettoyé localStorage et émis 'auth:logout'
      if (error.status === 401 || error.isAuthError) {
        return { valid: false };
      }

      // Autres erreurs (réseau, serveur down, etc.)
      console.error('Erreur verifyToken:', error);
      return { valid: false };
    }
  },

  /**
   * Déconnexion manuelle
   * Supprime le token et notifie les composants
   */
  logout: () => {
    localStorage.removeItem('token');
    
    // ✅ Notifier UserContext et FinanceContext
    window.dispatchEvent(new Event('auth:logout'));
  }
};
