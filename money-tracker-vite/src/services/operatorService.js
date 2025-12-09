import { apiRequest } from './api';

export const operatorService = {
  // --- SOPs ---
  async getSOPs() {
    return apiRequest('/operator/sops', { method: 'GET' });
  },

  async createSOP(sopData) {
    return apiRequest('/operator/sops', { 
      method: 'POST', 
      body: JSON.stringify(sopData) 
    });
  },

  async updateSOP(id, updates) {
    return apiRequest(`/operator/sops/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(updates) 
    });
  },

  async deleteSOP(id) {
    return apiRequest(`/operator/sops/${id}`, { method: 'DELETE' });
  },

  // ========================================
  // TASKS (Tâches Opérationnelles)
  // ========================================
  
  async getTasks() {
    return apiRequest('/operator/tasks', { method: 'GET' });
  },

  async createTask(taskData) {
    return apiRequest('/operator/tasks', { 
      method: 'POST', 
      body: JSON.stringify(taskData) 
    });
  },

  async updateTask(id, updates) {
    return apiRequest(`/operator/tasks/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(updates) 
    });
  },

  async deleteTask(id) {
    return apiRequest(`/operator/tasks/${id}`, { method: 'DELETE' });
  },

  // ========================================
  // FILTRES & RECHERCHE
  // ========================================
  
  async getTasksByProject(projectId) {
    return apiRequest(`/operator/tasks?projectid=${projectId}`, { method: 'GET' });
  },

  async getTasksByStatus(status) {
    return apiRequest(`/operator/tasks?status=${status}`, { method: 'GET' });
  },

  async getTasksByPriority(priority) {
    return apiRequest(`/operator/tasks?priority=${priority}`, { method: 'GET' });
  },

  async getTasksBySOP(sopId) {
    return apiRequest(`/operator/tasks?sopid=${sopId}`, { method: 'GET' });
  },

  // ========================================
  // BATCH OPERATIONS
  // ========================================
  
  async updateTaskStatus(id, status) {
    return apiRequest(`/operator/tasks/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ status }) 
    });
  },

  async bulkUpdateTasks(taskIds, updates) {
    return apiRequest('/operator/tasks/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ taskIds, updates })
    });
  }
};

export default operatorService;