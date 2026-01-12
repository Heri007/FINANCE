// src/services/accountsService.js
import { apiRequest } from './api';

export const accountsService = {
  // ✅ APRÈS (avec support signal)
  async getAll(options = {}) {
    const data = await apiRequest('api/accounts', {
      method: 'GET',
      ...options  // ✅ Permet de passer { signal }
    });
    return Array.isArray(data) ? data : [];
  },

  create(data) {
    return apiRequest('api/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id, data) {
    return apiRequest(`api/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id) {
    return apiRequest(`api/accounts/${id}`, {
      method: 'DELETE',
    });
  },
};

export default accountsService;
