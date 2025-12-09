import { useState, useEffect, useCallback } from 'react';
import { accountsService } from '../services/accountsService';

export const useAccounts = (isAuthenticated) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);
    try {
      const data = await accountsService.getAll();
      setAccounts(data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch accounts:', err);
      if (err.status === 401) {
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(async (accountData) => {
    setLoading(true);
    try {
      const newAccount = await accountsService.create(accountData);
      setAccounts(prev => [...prev, newAccount]);
      return newAccount;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteAccount = useCallback(async (accountId) => {
    setLoading(true);
    try {
      await accountsService.delete(accountId);
      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAccounts = useCallback(() => {
    return fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    createAccount,
    deleteAccount,
    refreshAccounts,
  };
};