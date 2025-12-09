// FICHIER: src/services/projectsService.js
import { apiRequest } from './api';

export const projectsService = {
  // Récupérer tous les projets
  getAll: () => apiRequest('/projects'),
  
  // ✅ Alias pour compatibilité avec useProjects.js
  getAllProjects: () => apiRequest('/projects'),

  // Récupérer un projet par ID
  getById: (id) => apiRequest(`/projects/${id}`),

  // Créer un projet
  create: (project) => apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(project)
  }),
  
  // ✅ Alias pour compatibilité
  createProject: (project) => apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(project)
  }),

  // Mettre à jour un projet
  update: (id, project) => apiRequest(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(project)
  }),
  
  // ✅ Alias pour compatibilité
  updateProject: (id, project) => apiRequest(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(project)
  }),

  // Supprimer un projet
  delete: (id) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),
  
  // ✅ Alias pour compatibilité
  deleteProject: (id) => apiRequest(`/projects/${id}`, { method: 'DELETE' }),

  // Activer un projet
  activate: (id) => apiRequest(`/projects/${id}/activate`, { method: 'POST' }),

  // ✅ Migration depuis localStorage
  migrateFromLocalStorage: async () => {
    try {
      const localProjects = localStorage.getItem('projects');
      if (!localProjects) {
        return { migrated: 0, message: 'Aucun projet local à migrer' };
      }

      const projects = JSON.parse(localProjects);
      if (!Array.isArray(projects) || projects.length === 0) {
        return { migrated: 0, message: 'Aucun projet local à migrer' };
      }

      let migratedCount = 0;

      for (const project of projects) {
        try {
          const existingProjects = await projectsService.getAll();
          const exists = existingProjects.some(p => 
            p.name === project.name && p.start_date === project.startDate
          );

          if (!exists) {
  await projectsService.create({
    name: project.name,
    description: project.description || '',
    start_date: project.startDate,
    end_date: project.endDate,
    budget: project.budget || project.totalCost || 0,
    status: project.status || 'draft',
    // ✅ envoyer des arrays/objets natifs
    expenses: project.expenses || [],
    revenues: project.revenues || [],
    total_cost: project.totalCost || 0,
    total_revenues: project.totalRevenues || 0
  });
  migratedCount++;
}

        } catch (err) {
          console.error('Erreur migration projet:', project.name, err);
        }
      }

      if (migratedCount > 0) {
        localStorage.removeItem('projects');
        console.log(`✅ ${migratedCount} projets migrés`);
      }

      return { migrated: migratedCount };
    } catch (error) {
      console.error('Erreur migration:', error);
      return { migrated: 0, error: error.message };
    }
  }
};

export default projectsService;
