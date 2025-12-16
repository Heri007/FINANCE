import { apiRequest } from './api';

export const linkingService = {
  // Récupérer les transactions "orphelines" (non liées)
  getUnlinked: (projectId) =>
    apiRequest(`/transaction-linking/unlinked?projectId=${projectId}`),

  // Récupérer les lignes du budget (Dépenses prévues / Revenus prévus)
  getProjectLines: (projectId) =>
    apiRequest(`/transaction-linking/project-lines/${projectId}`),

  // Effectuer la liaison
  linkTransaction: (transactionId, lineId) =>
    apiRequest('/transaction-linking/link', {
      method: 'POST',
      body: JSON.stringify({ transactionId, lineId }),
    }),

  // Lancer l'auto-match (Magie !)
  autoLink: (projectId) =>
    apiRequest(`/transaction-linking/auto-link/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
