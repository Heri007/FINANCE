// src/services/accountsService.js
import { apiRequest } from './api';

export const accountsService = {
  async getAll() {
    const data = await apiRequest('/api/accounts');
    return Array.isArray(data) ? data : [];
  },

  create: (data) => apiRequest('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => apiRequest(`/api/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => apiRequest(`/api/accounts/${id}`, {
    method: 'DELETE',
  }),
};
