// src/services/accountsService.js
import { apiRequest } from './api';

export const accountsService = {
  async getAll() {
    const data = await apiRequest('/accounts');
    return Array.isArray(data) ? data : [];
  },

  create: (data) => apiRequest('/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => apiRequest(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => apiRequest(`/accounts/${id}`, {
    method: 'DELETE',
  }),
};
