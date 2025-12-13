// src/services/transactionsService.js - VERSION MISE À JOUR AVEC getLastDates ET is_posted
import { apiRequest } from './api';

export const transactionsService = {
  // Récupérer toutes les transactions
  getAll: () => apiRequest('/transactions'),

  // ✅ NOUVEAU : Récupérer les dernières dates par compte (pour le Cutoff Import)
  getLastDates: () => apiRequest('/transactions/last-dates'),

  // Créer une transaction
  create: (transaction) => {
    const payload = {
      account_id: transaction.account_id || transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      transaction_date: transaction.transaction_date || transaction.date,
      // Gestion correcte des booléens
      is_planned: transaction.is_planned !== undefined ? transaction.is_planned : (transaction.isPlanned || false),
      is_posted: transaction.is_posted !== undefined ? transaction.is_posted : (transaction.isPosted || false),
      project_id: transaction.project_id || transaction.projectId || null,
      project_line_id: transaction.project_line_id || transaction.projectLineId || transaction.projectLine || null,
      remarks: transaction.remarks || ""
    };
    
    return apiRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Alias pour compatibilité
  createTransaction: (transaction) => transactionsService.create(transaction),

  // Mettre à jour une transaction
  update: (id, updates) => {
    const payload = {
      account_id: updates.account_id || updates.accountId,
      type: updates.type,
      amount: updates.amount,
      category: updates.category,
      description: updates.description,
      transaction_date: updates.transaction_date || updates.date,
      is_planned: updates.is_planned !== undefined ? updates.is_planned : updates.isPlanned,
      is_posted: updates.is_posted !== undefined ? updates.is_posted : updates.isPosted,
      project_id: updates.project_id || updates.projectId,
      project_line_id: updates.project_line_id || updates.projectLineId || updates.projectLine || undefined,
      remarks: updates.remarks
    };
    
    // Nettoyage des champs undefined pour ne pas écraser l'existant inutilement
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
    
    return apiRequest(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Alias pour compatibilité
  updateTransaction: (id, updates) => transactionsService.update(id, updates),

  // Supprimer une transaction
  delete: (id) => apiRequest(`/transactions/${id}`, { method: 'DELETE' }),

  // Alias pour compatibilité
  deleteTransaction: (id) => transactionsService.delete(id),

  // Importer des transactions (CSV)
  importTransactions: (transactions) => apiRequest('/transactions/import', {
    method: 'POST',
    body: JSON.stringify({ transactions })
  })
};

export default transactionsService;
