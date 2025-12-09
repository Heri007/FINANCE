import { apiRequest } from './api';

export const accountsService = {
  getAll: () => apiRequest('/accounts'),

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