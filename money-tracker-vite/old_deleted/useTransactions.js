import { useState, useEffect, useCallback } from 'react';
import { transactionsService } from '../src/services/transactionsService';

export const useTransactions = (isAuthenticated) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const data = await transactionsService.getAll();
      setTransactions(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const createTransaction = useCallback(async (transactionData) => {
    setLoading(true);
    try {
      const newTransaction = await transactionsService.create(transactionData);
      setTransactions((prev) => [newTransaction, ...prev]);
      return newTransaction;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createBulkTransactions = useCallback(
    async (transactionsArray) => {
      setLoading(true);
      try {
        const result = await transactionsService.createBulk(transactionsArray);
        await fetchTransactions();
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchTransactions]
  );

  const deleteTransaction = useCallback(async (transactionId) => {
    setLoading(true);
    try {
      await transactionsService.delete(transactionId);
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTransactions = useCallback(() => {
    return fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    createTransaction,
    createBulkTransactions,
    deleteTransaction,
    refreshTransactions,
  };
};
