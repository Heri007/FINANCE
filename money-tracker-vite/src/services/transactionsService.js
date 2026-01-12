// src/services/transactionsService.js
import { apiRequest } from './api';

export const transactionsService = {
  // ✅ APRÈS (avec support signal)
  async getAll(options = {}) {
    const data = await apiRequest('api/transactions', {
      method: 'GET',
      ...options  // ✅ Permet de passer { signal }
    });
    return Array.isArray(data) ? data : [];
  },

  async getLastDates(options = {}) {
    const data = await apiRequest('api/transactions/last-dates', {
      method: 'GET',
      ...options  // ✅ Permet de passer { signal }
    });
    return Array.isArray(data) ? data : [];
  },

  // ✅ Reste du code inchangé
  create: (transaction) => {
    const payload = {
      account_id: transaction.account_id || transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      transaction_date: transaction.transaction_date || transaction.date,
      is_planned:
        transaction.is_planned !== undefined
          ? transaction.is_planned
          : transaction.isPlanned || false,
      is_posted:
        transaction.is_posted !== undefined
          ? transaction.is_posted
          : transaction.isPosted || false,
      project_id: transaction.project_id || transaction.projectId || null,
      project_line_id:
        transaction.project_line_id ||
        transaction.projectLineId ||
        transaction.projectLine ||
        null,
      remarks: transaction.remarks,
    };

    return apiRequest('api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createTransaction: (transaction) => transactionsService.create(transaction),

  update: (id, updates) => {
    const payload = {
      account_id: updates.account_id || updates.accountId,
      type: updates.type,
      amount: updates.amount,
      category: updates.category,
      description: updates.description,
      transaction_date: updates.transaction_date || updates.date,
      is_planned:
        updates.is_planned !== undefined ? updates.is_planned : updates.isPlanned,
      is_posted: updates.is_posted !== undefined ? updates.is_posted : updates.isPosted,
      project_id: updates.project_id || updates.projectId,
      project_line_id:
        updates.project_line_id ||
        updates.projectLineId ||
        updates.projectLine ||
        undefined,
      remarks: updates.remarks,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) delete payload[key];
    });

    return apiRequest(`api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  updateTransaction: (id, updates) => transactionsService.update(id, updates),

  delete: (id) => apiRequest(`api/transactions/${id}`, { method: 'DELETE' }),

  deleteTransaction: (id) => transactionsService.delete(id),

  importTransactions: (transactions) =>
    apiRequest('api/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    }),
};

export default transactionsService;
