// src/contexts/FinanceContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { accountsService } from '../services/accountsService';
import { transactionsService } from '../services/transactionsService';
import { projectsService } from '../services/projectsService';
import { receivablesService } from '../services/receivablesService';

import { useUser } from './UserContext';
import { parseJSONSafe } from '../domain/finance/parsers';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
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
      if (error?.status === 401) {
        setAccounts([]);
        return;
      }
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
      if (error?.status === 401) {
        setTransactions([]);
        return;
      }
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
      if (error?.status === 401) {
        setProjects([]);
        return;
      }
      console.error('Erreur chargement projets:', error);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshReceivables = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const data = await receivablesService.getAll();
      const total = Array.isArray(data)
        ? data.reduce((sum, r) => sum + Number(r?.amount || 0), 0)
        : 0;
      setTotalOpenReceivables(total);
    } catch (error) {
      if (error?.status === 401) {
        setTotalOpenReceivables(0);
        return;
      }
      setTotalOpenReceivables(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccounts([]);
      setTransactions([]);
      setProjects([]);
      setTotalOpenReceivables(0);
      return;
    }

    refreshAccounts();
    refreshTransactions();
    refreshProjects();
    refreshReceivables();
  }, [
    isAuthenticated,
    refreshAccounts,
    refreshTransactions,
    refreshProjects,
    refreshReceivables,
  ]);

  // Mutations (CRUD)
  const createAccount = useCallback(
    async (data) => {
      const created = await accountsService.create(data);
      await refreshAccounts();
      return created;
    },
    [refreshAccounts]
  );

  const updateAccount = useCallback(
    async (id, data) => {
      const updated = await accountsService.update(id, data);
      await refreshAccounts();
      return updated;
    },
    [refreshAccounts]
  );

  const deleteAccount = useCallback(
    async (id) => {
      await accountsService.delete(id);
      await refreshAccounts();
    },
    [refreshAccounts]
  );

  const createTransaction = useCallback(
    async (data) => {
      const created = await transactionsService.create(data);
      await refreshTransactions();
      await refreshAccounts();
      return created;
    },
    [refreshTransactions, refreshAccounts]
  );

  const updateTransaction = useCallback(
    async (id, data) => {
      const updated = await transactionsService.update(id, data);
      await refreshTransactions();
      await refreshAccounts();
      return updated;
    },
    [refreshTransactions, refreshAccounts]
  );

  const deleteTransaction = useCallback(
    async (id) => {
      await transactionsService.delete(id);
      await refreshTransactions();
      await refreshAccounts();
    },
    [refreshTransactions, refreshAccounts]
  );

  const createProject = useCallback(
    async (data) => {
      const created = await projectsService.create(data);
      await refreshProjects();
      return created;
    },
    [refreshProjects]
  );

  const updateProject = useCallback(
    async (id, data) => {
      const updated = await projectsService.update(id, data);
      await refreshProjects();
      return updated;
    },
    [refreshProjects]
  );

  const deleteProject = useCallback(
    async (id) => {
      await projectsService.delete(id);
      await refreshProjects();
    },
    [refreshProjects]
  );

  // Helpers / selectors
  const visibleTransactions = useMemo(() => {
    let list = transactions || [];
    if (projectFilterId) {
      list = list.filter((t) => String(t.project_id) === String(projectFilterId));
    }
    if (accountFilterId) {
      list = list.filter((t) => String(t.account_id) === String(accountFilterId));
    }
    return list;
  }, [transactions, projectFilterId, accountFilterId]);

  const { income, expense } = useMemo(() => {
    const seen = new Set();
    const unique = [];

    (transactions || []).forEach((t) => {
      const date = (t.date || '').split('T')[0];
      const sig = `${t.account_id}|${date}|${t.amount}|${t.type}`;
      if (!seen.has(sig)) {
        seen.add(sig);
        unique.push(t);
      }
    });

    return unique.reduce(
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
    return (accounts || []).map((acc) => {
      if (acc?.name === 'Avoir') return { ...acc, balance: totalOpenReceivables };
      return acc;
    });
  }, [accounts, totalOpenReceivables]);

  const totalBalance = useMemo(() => {
    return (accountsWithCorrectAvoir || []).reduce(
      (s, acc) => s + parseFloat(acc?.balance || 0),
      0
    );
  }, [accountsWithCorrectAvoir]);

  const activeProjects = useMemo(() => {
    return (projects || []).filter((p) => {
      const status = String(p?.status || '').toLowerCase();
      return status === 'active' || status === 'actif' || status.startsWith('phase ');
    });
  }, [projects]);

  const remainingCostSum = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const expensesArr = parseJSONSafe(p?.expenses);
      const futureExpenses = expensesArr.filter(
        (e) => e?.account !== 'Déjà Payé' && e?.account !== 'Payé'
      );
      const subtotal = futureExpenses.reduce(
        (s, e) => s + parseFloat(e?.amount || 0),
        0
      );
      return sum + subtotal;
    }, 0);
  }, [activeProjects]);

  const projectsTotalRevenues = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const revArr = parseJSONSafe(p?.revenues);
      const subtotal = revArr.reduce((s, r) => s + parseFloat(r?.amount || 0), 0);
      return sum + subtotal;
    }, 0);
  }, [activeProjects]);

  const projectsNetImpact = projectsTotalRevenues - remainingCostSum;

  const coffreAccount = accountsWithCorrectAvoir.find((a) => a?.name === 'Coffre');
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);

  const receivablesForecastCoffre = currentCoffreBalance + totalOpenReceivables;
  const receivablesForecastTotal = totalBalance + totalOpenReceivables;

  const projectsForecastCoffre = receivablesForecastCoffre + projectsNetImpact;
  const projectsForecastTotal = receivablesForecastTotal + projectsNetImpact;

  const value = {
    // raw state
    accounts: accountsWithCorrectAvoir,
    transactions,
    projects,

    // filters
    projectFilterId,
    setProjectFilterId,
    accountFilterId,
    setAccountFilterId,

    // derived
    visibleTransactions,
    totalOpenReceivables,
    income,
    expense,
    totalBalance,
    activeProjects,
    remainingCostSum,
    projectsTotalRevenues,
    projectsNetImpact,
    currentCoffreBalance,
    receivablesForecastCoffre,
    receivablesForecastTotal,
    projectsForecastCoffre,
    projectsForecastTotal,

    // loading
    accountsLoading,
    transactionsLoading,
    projectsLoading,

    // actions
    refreshAccounts,
    refreshTransactions,
    refreshProjects,
    refreshReceivables,

    createAccount,
    updateAccount,
    deleteAccount,

    createTransaction,
    updateTransaction,
    deleteTransaction,

    createProject,
    updateProject,
    deleteProject,
  };

    return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance doit être utilisé dans un FinanceProvider');
  return ctx;
}
