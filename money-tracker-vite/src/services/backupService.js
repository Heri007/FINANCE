// src/services/backupService.js

import { apiRequest } from './api';

export const backupService = {
  // 🔹 Demander au serveur un backup complet (accounts + transactions + receivables + projects)
  fetchFull: () => apiRequest('/backup/full-export'),

  // 🔹 Créer et sauvegarder un backup côté serveur, avec label optionnel
  createLegacy: (accounts, transactions, receivables, projects = [], label = '') => {
    const backupData = {
      version: '2.0',
      date: new Date().toISOString(),
      label, // pour annoter le snapshot, ex: "post-migration-AVOIR"
      accounts,
      transactions,
      receivables,
      projects, // ✅ CORRECTION: utiliser "projects" au lieu de "projectsData"
    };

    return apiRequest('/backup/export', {
      method: 'POST',
      body: JSON.stringify(backupData),
    });
  },

  // 🔹 Sauvegarder un backup uploadé (restauration) sur le serveur
  saveUploaded: backupData =>
    apiRequest('/backup/save', {
      method: 'POST',
      body: JSON.stringify(backupData),
    }),

  // 🔹 Lister les backups disponibles sur le serveur (avec labels)
  list: () => apiRequest('/backup/list'),

  // 🔹 Télécharger localement un backup complet obtenu du serveur (snapshot live)
  downloadFullLocal: async (filename = null) => {
    const backupData = await backupService.fetchFull();
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });

    const name =
      filename ||
      `moneytracker_full_backup_${new Date().toISOString().split('T')[0]}.json`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 🔹 Télécharger depuis le serveur un fichier de backup par son filename
  downloadByFilename: async filename => {
    const base =
      import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

    const response = await fetch(
      `${base}/backup/${encodeURIComponent(filename)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${
            localStorage.getItem('token') || ''
          }`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Erreur téléchargement backup');
    }

    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default backupService;
