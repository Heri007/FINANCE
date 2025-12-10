// FICHIER: src/contexts/FinanceContext.jsx
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { accountsService } from '../services/accountsService';
import { transactionsService } from '../services/transactionsService';
import { projectsService } from '../services/projectsService';
import { API_BASE } from '../services/api';
import { useUser } from './UserContext';

const FinanceContext = createContext(null);

// ✅ Exporter le hook APRÈS le provider
export const FinanceProvider = ({ children }) => {
  const { isAuthenticated } = useUser();
  
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [totalOpenReceivables, setTotalOpenReceivables] = useState(0);
  
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [projectFilterId, setProjectFilterId] = useState(null);
  const [accountFilterId, setAccountFilterId] = useState(null);

  const refreshAccounts = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setAccountsLoading(true);
    try {
      const data = await accountsService.getAll();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement comptes:', error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshTransactions = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setTransactionsLoading(true);
    try {
      const data = await transactionsService.getAll();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setProjectsLoading(true);
    try {
      const data = await projectsService.getAll();
      setProjects(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur chargement projets:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [isAuthenticated]);

 const refreshReceivables = useCallback(async () => {
  if (!isAuthenticated) return;
  
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/receivables`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) {
      console.warn('Erreur API receivables:', res.status);
      setTotalOpenReceivables(0);
      return;
    }
    
    const data = await res.json();
    
    if (!Array.isArray(data)) {
      console.warn('Receivables response is not an array');
      setTotalOpenReceivables(0);
      return;
    }
    
    const total = data.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    setTotalOpenReceivables(total); // ✅ Mise à jour du total
    
    console.log('✅ Receivables chargés:', data.length, 'Total:', total);
  } catch (error) {
    console.error('Erreur chargement receivables:', error);
    setTotalOpenReceivables(0);
  }
}, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAccounts();
      refreshTransactions();
      refreshProjects();
      refreshReceivables();
    } else {
      setAccounts([]);
      setTransactions([]);
      setProjects([]);
      setTotalOpenReceivables(0);
    }
  }, [isAuthenticated, refreshAccounts, refreshTransactions, refreshProjects, refreshReceivables]);

  const createAccount = useCallback(async (data) => {
    const newAccount = await accountsService.create(data);
    await refreshAccounts();
    return newAccount;
  }, [refreshAccounts]);

  const updateAccount = useCallback(async (id, data) => {
    const updated = await accountsService.update(id, data);
    await refreshAccounts();
    return updated;
  }, [refreshAccounts]);

  const deleteAccount = useCallback(async (id) => {
    await accountsService.delete(id);
    await refreshAccounts();
  }, [refreshAccounts]);

  const createTransaction = useCallback(async (data) => {
    const newTransaction = await transactionsService.create(data);
    await refreshTransactions();
    await refreshAccounts();
    return newTransaction;
  }, [refreshTransactions, refreshAccounts]);

  const updateTransaction = useCallback(async (id, data) => {
    const updated = await transactionsService.update(id, data);
    await refreshTransactions();
    await refreshAccounts();
    return updated;
  }, [refreshTransactions, refreshAccounts]);

  const deleteTransaction = useCallback(async (id) => {
    await transactionsService.delete(id);
    await refreshTransactions();
    await refreshAccounts();
  }, [refreshTransactions, refreshAccounts]);

  const createProject = useCallback(async (data) => {
    const newProject = await projectsService.create(data);
    await refreshProjects();
    return newProject;
  }, [refreshProjects]);

  const updateProject = useCallback(async (id, data) => {
    const updated = await projectsService.update(id, data);
    await refreshProjects();
    return updated;
  }, [refreshProjects]);

  const deleteProject = useCallback(async (id) => {
    await projectsService.delete(id);
    await refreshProjects();
  }, [refreshProjects]);

  const visibleTransactions = useMemo(() => {
    let list = transactions || [];
    if (projectFilterId) {
      list = list.filter(t => String(t.project_id) === String(projectFilterId));
    }
    if (accountFilterId) {
      list = list.filter(t => String(t.account_id) === String(accountFilterId));
    }
    return list;
  }, [transactions, projectFilterId, accountFilterId]);

  const { income, expense } = useMemo(() => {
    const seenSignatures = new Set();
    const uniqueTransactions = [];
    
    transactions.forEach((t) => {
      const sig = `${t.account_id}|${(t.date || '').split('T')[0]}|${t.amount}|${t.type}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        uniqueTransactions.push(t);
      }
    });

    return uniqueTransactions.reduce(
      (tot, t) => {
        const a = parseFloat(t.amount || 0);
        if (t.type === 'income') tot.income += a;
        else tot.expense += a;
        return tot;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const accountsWithCorrectAvoir = useMemo(() => {
    return accounts.map(acc => {
      if (acc.name === 'Avoir') {
        return { ...acc, balance: totalOpenReceivables };
      }
      return acc;
    });
  }, [accounts, totalOpenReceivables]);

  const totalBalance = useMemo(() => {
    return accountsWithCorrectAvoir.reduce(
      (s, acc) => s + parseFloat(acc.balance || 0),
      0
    );
  }, [accountsWithCorrectAvoir]);

  const parseJSONSafe = useCallback((data) => {
    if (!data || data === null || data === undefined || data === 'null') return [];
    try {
      if (typeof data === 'string') {
        if (data.trim() === '[]' || data.trim() === '') return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
      if (typeof data === 'object') {
        if (Array.isArray(data)) return data;
        return [data];
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const activeProjects = useMemo(() => {
    return projects.filter(p => {
      const status = (p.status || '').toLowerCase();
      return (
        status === 'active' ||
        status === 'actif' ||
        status.startsWith('phase ')
      );
    });
  }, [projects]);

  const remainingCostSum = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      try {
        const expenses = parseJSONSafe(p.expenses);
        const futureExpenses = expenses.filter(e => 
          e.account !== 'Déjà Payé' && e.account !== 'Payé'
        );
        return sum + futureExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
      } catch {
        return sum;
      }
    }, 0);
  }, [activeProjects, parseJSONSafe]);

  const projectsTotalRevenues = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const revenues = parseJSONSafe(p.revenues);
      return sum + revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    }, 0);
  }, [activeProjects, parseJSONSafe]);

  const projectsNetImpact = projectsTotalRevenues - remainingCostSum;

  const coffreAccount = accountsWithCorrectAvoir.find(a => a.name === 'Coffre');
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);
  const receivablesForecastCoffre = currentCoffreBalance + totalOpenReceivables;
  const receivablesForecastTotal = totalBalance + totalOpenReceivables;
  const projectsForecastCoffre = receivablesForecastCoffre + projectsNetImpact;
  const projectsForecastTotal = receivablesForecastTotal + projectsNetImpact;

  const value = {
    accounts: accountsWithCorrectAvoir,
    transactions,
    projects,
    visibleTransactions,
    totalOpenReceivables,
    activeProjects,
    income,
    expense,
    totalBalance,
    remainingCostSum,
    projectsTotalRevenues,
    projectsNetImpact,
    currentCoffreBalance,
    receivablesForecastCoffre,
    receivablesForecastTotal,
    projectsForecastCoffre,
    projectsForecastTotal,
    accountsLoading,
    transactionsLoading,
    projectsLoading,
    projectFilterId,
    setProjectFilterId,
    accountFilterId,
    setAccountFilterId,
    createAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refreshTransactions,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects,
    refreshReceivables,
    parseJSONSafe,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

// ✅ Hook exporté APRÈS le Provider
export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance doit être utilisé dans un FinanceProvider');
  }
  return context;
}
