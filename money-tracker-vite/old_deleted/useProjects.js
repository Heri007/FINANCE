// FICHIER: src/hooks/useProjects.js
import { useState, useCallback, useEffect } from 'react';
import { projectsService } from '../src/services/projectsService';

export const useProjects = (isAuthenticated) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fonction pour recharger la liste des projets
  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      // ✅ CORRECTION: Utiliser getAll() au lieu de getAllProjects()
      const data = await projectsService.getAll();
      setProjects(data || []);
      setError(null);
    } catch (err) {
      console.error("Erreur chargement projets:", err);
      setError("Impossible de charger les projets");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Charger les projets au montage si l'utilisateur est connecté
  useEffect(() => {
    if (isAuthenticated) {
      refreshProjects();
    }
  }, [isAuthenticated, refreshProjects]);

  return {
    projects,
    loading,
    error,
    refreshProjects,
    // ✅ CORRECTION: Utiliser les bons noms de fonctions
    createProject: projectsService.create,
    updateProject: projectsService.update,
    deleteProject: projectsService.delete
  };
};

export default useProjects;
