// src/services/receivablesService.js
import { apiRequest } from './api';

export const receivablesService = {
  /**
   * Récupérer tous les avoirs ouverts
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
   * Récupérer un avoir par ID
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
   * Créer un nouvel avoir
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
   * Mettre à jour un avoir
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
   * Supprimer un avoir
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
   * Marquer un avoir comme payé
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
   * Restaurer un avoir depuis une sauvegarde
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
