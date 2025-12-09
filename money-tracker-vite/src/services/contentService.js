import { apiRequest } from './api';

export const contentService = {
  // --- MASTER CONTENT ---
  async getAllContent() {
    return apiRequest('/content', { method: 'GET' });
  },

  async createMasterContent(contentData) {
    return apiRequest('/content', { 
      method: 'POST', 
      body: JSON.stringify(contentData) 
    });
  },

  async updateMasterContent(id, updates) {
    return apiRequest(`/content/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(updates) 
    });
  },

  async deleteMasterContent(id) {
    return apiRequest(`/content/${id}`, { method: 'DELETE' });
  },

  // --- DERIVATIVES ---
  async addDerivative(masterId, derivativeData) {
    return apiRequest(`/content/${masterId}/derivatives`, { 
      method: 'POST', 
      body: JSON.stringify(derivativeData) 
    });
  },

  async updateDerivative(id, updates) {
    return apiRequest(`/content/derivatives/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(updates) 
    });
  },

  async deleteDerivative(id) {
    return apiRequest(`/content/derivatives/${id}`, { method: 'DELETE' });
  }
};
export default contentService;