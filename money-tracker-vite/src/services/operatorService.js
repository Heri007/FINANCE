// src/services/operatorService.js - VERSION COMPLÈTE AVEC PROJETS
import { apiRequest } from './api';

export const operatorService = {
  // ========================================
  // SOPs (Standard Operating Procedures)
  // ========================================
  
  async getSOPs() {
    return apiRequest('/operator/sops', { method: 'GET' });
  },

  async getSOPById(id) {
    return apiRequest(`/operator/sops/${id}`, { method: 'GET' });
  },

  async getSOPsByProject(projectId) {
    return apiRequest(`/operator/sops?projectid=${projectId}`, { method: 'GET' });
  },

  async getSOPsByStatus(status) {
    return apiRequest(`/operator/sops?status=${status}`, { method: 'GET' });
  },

  async getSOPsByCategory(category) {
    return apiRequest(`/operator/sops?category=${category}`, { method: 'GET' });
  },

  async createSOP(sopData) {
    // Validation des données minimales
    if (!sopData.title) {
      throw new Error('Le titre de la SOP est requis');
    }

    const payload = {
      title: sopData.title,
      description: sopData.description || '',
      owner: sopData.owner || '',
      steps: sopData.steps || [],
      avgtime: sopData.avgtime || 0,
      status: sopData.status || 'draft',
      category: sopData.category || 'Général',
      checklist: sopData.checklist || [],
      projectid: sopData.projectid || sopData.projectId || null,
      lastreview: sopData.lastreview || new Date().toISOString().split('T')[0]
    };

    return apiRequest('/operator/sops', { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
  },

  async updateSOP(id, updates) {
    // Permettre la mise à jour partielle
    const payload = {};
    
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.owner !== undefined) payload.owner = updates.owner;
    if (updates.steps !== undefined) payload.steps = updates.steps;
    if (updates.avgtime !== undefined) payload.avgtime = updates.avgtime;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.checklist !== undefined) payload.checklist = updates.checklist;
    if (updates.projectid !== undefined || updates.projectId !== undefined) {
      payload.projectid = updates.projectid || updates.projectId;
    }
    if (updates.lastreview !== undefined) payload.lastreview = updates.lastreview;

    return apiRequest(`/operator/sops/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(payload) 
    });
  },

  async updateSOPStatus(id, status) {
    return apiRequest(`/operator/sops/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ status }) 
    });
  },

  async updateSOPChecklist(id, checklist) {
    return apiRequest(`/operator/sops/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ checklist }) 
    });
  },

  async deleteSOP(id) {
    return apiRequest(`/operator/sops/${id}`, { method: 'DELETE' });
  },

  async duplicateSOP(id) {
    return apiRequest(`/operator/sops/${id}/duplicate`, { method: 'POST' });
  },

  // ========================================
  // TASKS (Tâches Opérationnelles)
  // ========================================
  
  async getTasks() {
    return apiRequest('/operator/tasks', { method: 'GET' });
  },

  async getTaskById(id) {
    return apiRequest(`/operator/tasks/${id}`, { method: 'GET' });
  },

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

  async getTasksByAssignee(assignee) {
    return apiRequest(`/operator/tasks?assignedto=${encodeURIComponent(assignee)}`, { method: 'GET' });
  },

  async getOverdueTasks() {
    return apiRequest('/operator/tasks?overdue=true', { method: 'GET' });
  },

  async createTask(taskData) {
    if (!taskData.title) {
      throw new Error('Le titre de la tâche est requis');
    }

    const payload = {
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority || 'medium',
      duedate: taskData.duedate || taskData.dueDate || null,
      assignedto: taskData.assignedto || taskData.assignedTo || '',
      status: taskData.status || 'todo',
      sopid: taskData.sopid || taskData.sopId || null,
      projectid: taskData.projectid || taskData.projectId || null
    };

    return apiRequest('/operator/tasks', { 
      method: 'POST', 
      body: JSON.stringify(payload) 
    });
  },

  async updateTask(id, updates) {
    const payload = {};
    
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.duedate !== undefined || updates.dueDate !== undefined) {
      payload.duedate = updates.duedate || updates.dueDate;
    }
    if (updates.assignedto !== undefined || updates.assignedTo !== undefined) {
      payload.assignedto = updates.assignedto || updates.assignedTo;
    }
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.sopid !== undefined || updates.sopId !== undefined) {
      payload.sopid = updates.sopid || updates.sopId;
    }
    if (updates.projectid !== undefined || updates.projectId !== undefined) {
      payload.projectid = updates.projectid || updates.projectId;
    }

    return apiRequest(`/operator/tasks/${id}`, { 
      method: 'PUT', 
      body: JSON.stringify(payload) 
    });
  },

  async updateTaskStatus(id, status) {
    return apiRequest(`/operator/tasks/${id}`, { 
      method: 'PATCH', 
      body: JSON.stringify({ status }) 
    });
  },

  async deleteTask(id) {
    return apiRequest(`/operator/tasks/${id}`, { method: 'DELETE' });
  },

  // ========================================
  // BATCH OPERATIONS
  // ========================================
  
  async bulkUpdateTasks(taskIds, updates) {
    return apiRequest('/operator/tasks/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ taskIds, updates })
    });
  },

  async bulkDeleteTasks(taskIds) {
    return apiRequest('/operator/tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds })
    });
  },

  async bulkUpdateSOPs(sopIds, updates) {
    return apiRequest('/operator/sops/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ sopIds, updates })
    });
  },

  // ========================================
  // STATISTIQUES & RAPPORTS
  // ========================================
  
  async getStats() {
    return apiRequest('/operator/stats', { method: 'GET' });
  },

  async getProjectStats(projectId) {
    return apiRequest(`/operator/stats/project/${projectId}`, { method: 'GET' });
  },

  async getSOPStats(sopId) {
    return apiRequest(`/operator/stats/sop/${sopId}`, { method: 'GET' });
  },

  async getTaskCompletionRate() {
    return apiRequest('/operator/stats/tasks/completion', { method: 'GET' });
  },

  // ========================================
  // RECHERCHE & FILTRES AVANCÉS
  // ========================================
  
  async searchSOPs(query) {
    return apiRequest(`/operator/sops/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },

  async searchTasks(query) {
    return apiRequest(`/operator/tasks/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  },

  async filterSOPs(filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.projectid) params.append('projectid', filters.projectid);
    if (filters.owner) params.append('owner', filters.owner);
    
    return apiRequest(`/operator/sops?${params.toString()}`, { method: 'GET' });
  },

  async filterTasks(filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.projectid) params.append('projectid', filters.projectid);
    if (filters.sopid) params.append('sopid', filters.sopid);
    if (filters.assignedto) params.append('assignedto', filters.assignedto);
    if (filters.overdue !== undefined) params.append('overdue', filters.overdue);
    
    return apiRequest(`/operator/tasks?${params.toString()}`, { method: 'GET' });
  },

  // ========================================
  // INTÉGRATION PROJETS
  // ========================================
  
  async linkSOPToProject(sopId, projectId) {
    return apiRequest(`/operator/sops/${sopId}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectid: projectId })
    });
  },

  async linkTaskToProject(taskId, projectId) {
    return apiRequest(`/operator/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectid: projectId })
    });
  },

  async unlinkSOPFromProject(sopId) {
    return apiRequest(`/operator/sops/${sopId}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectid: null })
    });
  },

  async unlinkTaskFromProject(taskId) {
    return apiRequest(`/operator/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ projectid: null })
    });
  },

  // ========================================
  // TEMPLATES & EXPORT
  // ========================================
  
  async exportSOPs(format = 'json') {
    return apiRequest(`/operator/sops/export?format=${format}`, { method: 'GET' });
  },

  async exportTasks(format = 'json') {
    return apiRequest(`/operator/tasks/export?format=${format}`, { method: 'GET' });
  },

  async importSOPs(data) {
    return apiRequest('/operator/sops/import', {
      method: 'POST',
      body: JSON.stringify({ sops: data })
    });
  },

  async importTasks(data) {
    return apiRequest('/operator/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ tasks: data })
    });
  }
};

export default operatorService;
