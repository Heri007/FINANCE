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
      console.log('🔄 FinanceContext: isAuthenticated =', isAuthenticated);

    if (!isAuthenticated) {
      console.log('❌ FinanceContext: Non authentifié, reset données');
      setAccounts([]);
      setTransactions([]);
      setProjects([]);
      setTotalOpenReceivables(0);
      return;
    }
    console.log('✅ FinanceContext: Authentifié, chargement données...');
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

  // ============================================================
  // ACTIONS - PROJETS (ACTIVATION, DÉSACTIVATION, ARCHIVAGE)
  // ============================================================

  /**
   * Active un projet : crée les transactions associées (dépenses + revenus)
   */
  const activateProject = useCallback(async (projectId) => {
    try {
      const project = projects.find(p => String(p.id) === String(projectId));
      if (!project) {
        throw new Error('Projet introuvable');
      }

      const parseExpenses = (data) => {
        if (!data || typeof data !== 'string') return [];
        try {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.error('Parse expenses failed', e);
          return [];
        }
      };

      const parsedExpenses = parseExpenses(project.expenses);
      const parsedRevenues = parseExpenses(project.revenues);

      const newTransactions = [];

      // Créer les transactions de dépenses
      for (const exp of parsedExpenses) {
        const acc = accounts.find(a => a.name === exp.account);
        if (acc) {
          await createTransaction({
            accountid: acc.id,
            type: 'expense',
            amount: parseFloat(exp.amount),
            category: project.name,
            description: exp.description,
            date: new Date().toISOString().split('T')[0],
            projectid: projectId,
            isplanned: false,
            isposted: true,
          });
          newTransactions.push(exp);
        }
      }

      // Créer les transactions de revenus
      for (const rev of parsedRevenues) {
        const acc = accounts.find(a => a.name === rev.account);
        if (acc) {
          await createTransaction({
            accountid: acc.id,
            type: 'income',
            amount: parseFloat(rev.amount),
            category: project.name,
            description: rev.description,
            date: new Date().toISOString().split('T')[0],
            projectid: projectId,
            isplanned: false,
            isposted: true,
          });
          newTransactions.push(rev);
        }
      }

      // Mettre à jour le statut du projet
      await updateProject(projectId, { status: 'active' });

      await refreshProjects();
      await refreshTransactions();
      await refreshAccounts();

      return { success: true, transactionCount: newTransactions.length };
    } catch (error) {
      console.error('Erreur activation projet', error);
      throw error;
    }
  }, [projects, accounts, createTransaction, updateProject, refreshProjects, refreshTransactions, refreshAccounts]);

  /**
   * Archive (complète) un projet
   */
  const archiveProject = useCallback(async (projectId) => {
    await updateProject(projectId, { status: 'archived' });
    await refreshProjects();
    await refreshTransactions();
    await refreshAccounts();
  }, [updateProject, refreshProjects, refreshTransactions, refreshAccounts]);

  /**
   * Désactive un projet (passe le statut à "Inactif")
   */
  const deactivateProject = useCallback(async (projectId) => {
    try {
      const project = projects.find(p => String(p.id) === String(projectId));
      
      if (!project) {
        throw new Error('Projet introuvable');
      }

      console.log('🔍 Projet AVANT désactivation:', project);

      // ✅ Normaliser toutes les données
      const dataToSend = {
        ...project,
        
        // ✅ CORRECTION 1 : Statut valide
        status: 'paused',
        
        // ✅ CORRECTION 2 : allocation doit être un objet ou string, pas un array
        allocation: (() => {
          if (typeof project.allocation === 'string') return project.allocation;
          if (typeof project.allocation === 'object' && !Array.isArray(project.allocation)) {
            return project.allocation;
          }
          return {}; // Convertir [] en {}
        })(),
        
        // ✅ Assurer que revenueAllocation est un objet
        revenueAllocation: typeof project.revenueAllocation === 'object' && !Array.isArray(project.revenueAllocation)
          ? project.revenueAllocation
          : {},
        
        // ✅ S'assurer que expenses et revenues sont des strings JSON
        expenses: typeof project.expenses === 'string' 
          ? project.expenses 
          : JSON.stringify(project.expenses || []),
        
        revenues: typeof project.revenues === 'string' 
          ? project.revenues 
          : JSON.stringify(project.revenues || []),
      };

      console.log('📤 Données normalisées à envoyer:', {
        ...dataToSend,
        expenses: `[${typeof dataToSend.expenses === 'string' ? 'string' : 'object'}]`,
        revenues: `[${typeof dataToSend.revenues === 'string' ? 'string' : 'object'}]`,
      });

      await updateProject(projectId, dataToSend);
      await refreshProjects();
      
      console.log('✅ Projet désactivé avec succès (status: paused)');
    } catch (error) {
      console.error('❌ Erreur désactivation:', error);
      
      if (error.details) {
        console.error('🔴 Détails validation:', error.details);
      }
      
      throw error;
    }
  }, [projects, updateProject, refreshProjects]);

  /**
   * Réactive un projet (passe le statut de "paused" à "active")
   */
  const reactivateProject = useCallback(async (projectId) => {
    try {
      const project = projects.find(p => String(p.id) === String(projectId));
      
      if (!project) {
        throw new Error('Projet introuvable');
      }

      console.log('🔄 Réactivation du projet:', project.name);

      // ✅ Changer le statut à "active"
      const dataToSend = {
        ...project,
        status: 'active',
        allocation: typeof project.allocation === 'object' && !Array.isArray(project.allocation)
          ? project.allocation
          : {}
      };

      await updateProject(projectId, dataToSend);
      await refreshProjects();
      
      console.log('✅ Projet réactivé avec succès (status: active)');
    } catch (error) {
      console.error('❌ Erreur réactivation:', error);
      if (error.details) {
        console.error('🔴 Détails validation:', error.details);
      }
      throw error;
    }
  }, [projects, updateProject, refreshProjects]);

  // ✅ AJOUTER LES ACTIONS PROJETS AU VALUE
  const valueWithProjectActions = useMemo(() => ({
    ...value,
    
    // Actions projets supplémentaires
    activateProject,
    archiveProject,
    reactivateProject,
    deactivateProject,
  }), [value, activateProject, archiveProject, reactivateProject, deactivateProject]);

  return (
    <FinanceContext.Provider value={valueWithProjectActions}>
      {children}
    </FinanceContext.Provider>
  );
}  // ✅ CORRECTION: Fermeture de FinanceProvider

// Hook useFinance est déjà correct ✅
export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance doit être utilisé dans un FinanceProvider');
  return ctx;
}
