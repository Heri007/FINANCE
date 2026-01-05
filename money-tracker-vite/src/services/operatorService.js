// src/services/operatorService.js - VERSION CORRIGÉE snake_case
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
    return apiRequest(`/operator/sops?project_id=${projectId}`, { method: 'GET' });
  },

  async getSOPsByStatus(status) {
    return apiRequest(`/operator/sops?status=${status}`, { method: 'GET' });
  },

  async getSOPsByCategory(category) {
    return apiRequest(`/operator/sops?category=${category}`, { method: 'GET' });
  },

  async createSOP(sopData) {
    if (!sopData.title) {
      throw new Error('Le titre de la SOP est requis');
    }

    const payload = {
      title: sopData.title,
      description: sopData.description || '',
      owner: sopData.owner || '',
      steps: sopData.steps || [],
      avg_time: sopData.avg_time || sopData.avgtime || 0, // ✅ Accepter les 2 formats
      status: sopData.status || 'draft',
      category: sopData.category || 'Général',
      checklist: sopData.checklist || [],
      project_id: sopData.project_id || sopData.projectId || sopData.projectid || null, // ✅
      last_review: sopData.last_review || sopData.lastreview || null, // ✅
    };

    return apiRequest('/operator/sops', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSOP(id, updates) {
    const payload = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.owner !== undefined) payload.owner = updates.owner;
    if (updates.steps !== undefined) payload.steps = updates.steps;
    
    // Accepter les deux formats pour compatibilité
    if (updates.avg_time !== undefined || updates.avgtime !== undefined) {
      payload.avg_time = updates.avg_time || updates.avgtime;
    }
    
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.checklist !== undefined) payload.checklist = updates.checklist;
    
    if (updates.project_id !== undefined || updates.projectId !== undefined || updates.projectid !== undefined) {
      payload.project_id = updates.project_id || updates.projectId || updates.projectid;
    }
    
    if (updates.last_review !== undefined || updates.lastreview !== undefined) {
      payload.last_review = updates.last_review || updates.lastreview;
    }

    return apiRequest(`/operator/sops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateSOPStatus(id, status) {
    return apiRequest(`/operator/sops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async updateSOPChecklist(id, checklist) {
    return apiRequest(`/operator/sops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ checklist }),
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
    return apiRequest(`/operator/tasks?project_id=${projectId}`, { method: 'GET' });
  },

  async getTasksByStatus(status) {
    return apiRequest(`/operator/tasks?status=${status}`, { method: 'GET' });
  },

  async getTasksByPriority(priority) {
    return apiRequest(`/operator/tasks?priority=${priority}`, { method: 'GET' });
  },

  async getTasksBySOP(sopId) {
    return apiRequest(`/operator/tasks?sop_id=${sopId}`, { method: 'GET' });
  },

  async getTasksByAssignee(assignee) {
    return apiRequest(`/operator/tasks?assigned_to=${encodeURIComponent(assignee)}`, {
      method: 'GET',
    });
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
      due_date: taskData.due_date || taskData.dueDate || taskData.duedate || null, // ✅
      assigned_to: taskData.assigned_to || taskData.assignedTo || taskData.assignedto || '', // ✅
      status: taskData.status || 'todo',
      sop_id: taskData.sop_id || taskData.sopId || taskData.sopid || null, // ✅
      project_id: taskData.project_id || taskData.projectId || taskData.projectid || null, // ✅
    };

    return apiRequest('/operator/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTask(id, updates) {
    const payload = {};

    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    
    // Accepter tous les formats possibles
    if (updates.due_date !== undefined || updates.dueDate !== undefined || updates.duedate !== undefined) {
      payload.due_date = updates.due_date || updates.dueDate || updates.duedate;
    }
    
    if (updates.assigned_to !== undefined || updates.assignedTo !== undefined || updates.assignedto !== undefined) {
      payload.assigned_to = updates.assigned_to || updates.assignedTo || updates.assignedto;
    }
    
    if (updates.status !== undefined) payload.status = updates.status;
    
    if (updates.sop_id !== undefined || updates.sopId !== undefined || updates.sopid !== undefined) {
      payload.sop_id = updates.sop_id || updates.sopId || updates.sopid;
    }
    
    if (updates.project_id !== undefined || updates.projectId !== undefined || updates.projectid !== undefined) {
      payload.project_id = updates.project_id || updates.projectId || updates.projectid;
    }

    return apiRequest(`/operator/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateTaskStatus(id, status) {
    return apiRequest(`/operator/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
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
      body: JSON.stringify({ taskIds, updates }),
    });
  },

  async bulkDeleteTasks(taskIds) {
    return apiRequest('/operator/tasks/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  },

  async bulkUpdateSOPs(sopIds, updates) {
    return apiRequest('/operator/sops/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ sopIds, updates }),
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
    return apiRequest(`/operator/sops/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  },

  async searchTasks(query) {
    return apiRequest(`/operator/tasks/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  },

  async filterSOPs(filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.project_id || filters.projectid) params.append('project_id', filters.project_id || filters.projectid);
    if (filters.owner) params.append('owner', filters.owner);

    return apiRequest(`/operator/sops?${params.toString()}`, { method: 'GET' });
  },

  async filterTasks(filters) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.project_id || filters.projectid) params.append('project_id', filters.project_id || filters.projectid);
    if (filters.sop_id || filters.sopid) params.append('sop_id', filters.sop_id || filters.sopid);
    if (filters.assigned_to || filters.assignedto) params.append('assigned_to', filters.assigned_to || filters.assignedto);
    if (filters.overdue !== undefined) params.append('overdue', filters.overdue);

    return apiRequest(`/operator/tasks?${params.toString()}`, { method: 'GET' });
  },

  // ========================================
  // INTÉGRATION PROJETS
  // ========================================

  async linkSOPToProject(sopId, projectId) {
    return apiRequest(`/operator/sops/${sopId}`, {
      method: 'PATCH',
      body: JSON.stringify({ project_id: projectId }),
    });
  },

  async linkTaskToProject(taskId, projectId) {
    return apiRequest(`/operator/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ project_id: projectId }),
    });
  },

  async unlinkSOPFromProject(sopId) {
    return apiRequest(`/operator/sops/${sopId}`, {
      method: 'PATCH',
      body: JSON.stringify({ project_id: null }),
    });
  },

  async unlinkTaskFromProject(taskId) {
    return apiRequest(`/operator/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ project_id: null }),
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
      body: JSON.stringify({ sops: data }),
    });
  },

  async importTasks(data) {
    return apiRequest('/operator/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ tasks: data }),
    });
  },
};

export default operatorService;
