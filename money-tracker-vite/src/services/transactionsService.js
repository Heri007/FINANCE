// src/services/transactionsService.js
import { apiRequest } from './api';

export const transactionsService = {
  // ✅ Ajouter guard array
  async getAll() {
    const data = await apiRequest('/transactions');
    return Array.isArray(data) ? data : [];
  },

  async getLastDates() {
    const data = await apiRequest('/transactions/last-dates');
    return Array.isArray(data) ? data : [];
  },

  create: (transaction) => {
    const payload = {
      account_id: transaction.account_id || transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      transactiondate: transaction.transactiondate || transaction.date,
      is_planned: transaction.is_planned !== undefined ? transaction.is_planned : (transaction.isPlanned || false),
      is_posted: transaction.is_posted !== undefined ? transaction.is_posted : (transaction.isPosted || false),
      project_id: transaction.project_id || transaction.projectId || null,
      project_line_id: transaction.project_line_id || transaction.projectLineId || transaction.projectLine || null,
      remarks: transaction.remarks,
    };

    return apiRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Alias
  createTransaction: (transaction) => transactionsService.create(transaction),

  update: (id, updates) => {
    const payload = {
      account_id: updates.account_id || updates.accountId,
      type: updates.type,
      amount: updates.amount,
      category: updates.category,
      description: updates.description,
      transactiondate: updates.transactiondate || updates.date,
      is_planned: updates.is_planned !== undefined ? updates.is_planned : updates.isPlanned,
      is_posted: updates.is_posted !== undefined ? updates.is_posted : updates.isPosted,
      project_id: updates.project_id || updates.projectId,
      project_line_id: updates.project_line_id || updates.projectLineId || updates.projectLine || undefined,
      remarks: updates.remarks,
    };

    // Nettoyage des undefined
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) delete payload[key];
    });

    return apiRequest(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updateTransaction: (id, updates) => transactionsService.update(id, updates),

  delete: (id) => apiRequest(`/transactions/${id}`, { method: 'DELETE' }),
  
  deleteTransaction: (id) => transactionsService.delete(id),

  importTransactions: (transactions) => apiRequest('/transactions/import', {
    method: 'POST',
    body: JSON.stringify({ transactions }),
  }),
};

export default transactionsService;
