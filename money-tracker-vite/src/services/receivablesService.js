// src/services/receivablesService.js
import { apiRequest } from './api';

export const receivablesService = {
  /**
   * Récupérer tous les receivables ouverts
   */
  async getAll() {
    try {
      const data = await apiRequest('/api/receivables', {
        method: 'GET'
      });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('❌ Erreur getAll receivables:', error);
      if (error?.status === 401) {
        return [];
      }
      return [];
    }
  },

  /**
   * Récupérer un receivable par ID
   */
  async getById(id) {
    try {
      return await apiRequest(`/api/receivables/${id}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('❌ Erreur getById receivable:', error);
      throw error;
    }
  },

  /**
   * Créer un nouveau receivable
   */
  async create(data) {
    try {
      return await apiRequest('/api/receivables', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('❌ Erreur create receivable:', error);
      throw error;
    }
  },

  /**
   * Mettre à jour un receivable
   */
  async update(id, data) {
    try {
      return await apiRequest(`/api/receivables/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('❌ Erreur update receivable:', error);
      throw error;
    }
  },

  /**
   * Supprimer un receivable
   */
  async delete(id) {
    try {
      await apiRequest(`/api/receivables/${id}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('❌ Erreur delete receivable:', error);
      throw error;
    }
  },

  /**
   * Marquer un receivable comme payé
   */
  async pay(id) {
    try {
      return await apiRequest(`/api/receivables/${id}/pay`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('❌ Erreur pay receivable:', error);
      throw error;
    }
  },

  /**
   * Restaurer un receivable depuis une sauvegarde
   */
  async restore(data) {
    try {
      return await apiRequest('/api/receivables/restore', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('❌ Erreur restore receivable:', error);
      throw error;
    }
  }
};
