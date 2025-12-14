import { API_BASE } from './api';

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const linkingService = {
  // Récupérer les transactions "orphelines" (non liées)
  getUnlinked: async (projectId) => {
    const res = await fetch(`${API_BASE}/transaction-linking/unlinked?projectId=${projectId}`, {
      headers: getHeaders()
    });
    return res.json();
  },

  // Récupérer les lignes du budget (Dépenses prévues / Revenus prévus)
  getProjectLines: async (projectId) => {
    const res = await fetch(`${API_BASE}/transaction-linking/project-lines/${projectId}`, {
      headers: getHeaders()
    });
    return res.json();
  },

  // Effectuer la liaison
  linkTransaction: async (transactionId, lineId) => {
    const res = await fetch(`${API_BASE}/transaction-linking/link`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ transactionId, lineId })
    });
    return res.json();
  },

  // Lancer l'auto-match (Magie !)
  autoLink: async (projectId) => {
    const res = await fetch(`${API_BASE}/transaction-linking/auto-link/${projectId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });
    return res.json();
  }
};