// src/services/receivablesService.js
import { apiRequest } from './api';

export const receivablesService = {
  /**
   * Récupérer tous les receivables ouverts
   */
  async getAll() {
    try {
      const data = await apiRequest('/api/receivables', {
        method: 'GET',
      });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Erreur getAll receivables:', error);

      // Retourne un tableau vide uniquement si non authentifié
      if (error?.status === 401) {
        return [];
      }

      // Pour les autres erreurs (500, réseau), throw pour afficher une alerte
      throw new Error(
        `Impossible de charger les receivables: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Récupérer un receivable par ID
   */
  async getById(id) {
    try {
      return await apiRequest(`/api/receivables/${id}`, {
        method: 'GET',
      });
    } catch (error) {
      console.error('❌ Erreur getById receivable:', error);
      throw new Error(
        `Receivable #${id} introuvable: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Créer un nouveau receivable
   * @param {Object} data - { person, amount, description?, source_account_id }
   */
  async create(data) {
    try {
      if (!data.person || !data.amount || !data.source_account_id) {
        throw new Error('Champs requis manquants');
      }

      // ✅ CORRECTION : Backend attend "source_account_id" (AVEC underscore)
      const payload = {
        person: String(data.person).trim(),
        amount: parseFloat(data.amount),
        description: data.description ? String(data.description).trim() : '',
        source_account_id: parseInt(data.source_account_id, 10), // ✅ AVEC underscore !
      };

      console.log('📤 Payload envoyé au backend:', payload);

      return await apiRequest('/api/receivables', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('❌ Erreur create receivable:', error);
      throw new Error(
        `Impossible de créer le receivable: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Mettre à jour un receivable
   * @param {number} id - ID du receivable
   * @param {Object} data - { status?, amount?, description? }
   */
  async update(id, data) {
    try {
      return await apiRequest(`/api/receivables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('❌ Erreur update receivable:', error);
      throw new Error(
        `Impossible de modifier le receivable #${id}: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Supprimer un receivable
   */
  async delete(id) {
    try {
      await apiRequest(`/api/receivables/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('❌ Erreur delete receivable:', error);
      throw new Error(
        `Impossible de supprimer le receivable #${id}: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Marquer un receivable comme payé
   */
  async pay(id) {
    try {
      return await apiRequest(`/api/receivables/${id}/pay`, {
        method: 'POST',
        // ✅ Pas de body : backend attend un POST vide
      });
    } catch (error) {
      console.error('❌ Erreur pay receivable:', error);
      throw new Error(
        `Impossible de marquer le receivable #${id} comme payé: ${error?.message || 'Erreur réseau'}`
      );
    }
  },

  /**
   * Restaurer un receivable depuis une sauvegarde
   */
  async restore(data) {
    try {
      return await apiRequest('/api/receivables/restore', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('❌ Erreur restore receivable:', error);
      throw new Error(
        `Impossible de restaurer le receivable: ${error?.message || 'Erreur réseau'}`
      );
    }
  },
};
