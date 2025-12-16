// src/services/receivablesService.js
import { apiRequest } from './api';

export const receivablesService = {
  getAll: () => apiRequest('/receivables'),
};
