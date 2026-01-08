// src/contexts/FinanceContext.jsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../services/api';
import { accountsService } from '../services/accountsService';
import transactionsService from '../services/transactionsService';
import projectsService from '../services/projectsService';
import { receivablesService} from '../services/receivablesService';
import { useUser } from './UserContext';
import { parseJSONSafe } from '../domain/finance/parsers';
import { buildTransactionSignature as createSignature } from '../domain/finance/signature';

/**
 * Normalise une date au format YYYY-MM-DD sans timezone
 * @param {string|Date|null} value - Valeur de date à normaliser
 * @returns {string|null} - Date au format YYYY-MM-DD ou null
 */
const toYmd = (value) => {
  if (!value) return null;
  try {
    // Si c'est déjà une string YYYY-MM-DD, la retourner telle quelle
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    // Si c'est une string ISO ou autre format, extraire la partie date
    if (typeof value === 'string') {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().split('T')[0];
    }
    // Si c'est un objet Date
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }
    return null;
  } catch (error) {
    console.error('Erreur normalisation date:', error, value);
    return null;
  }
};

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { isAuthenticated } = useUser();

  // ============================================================================
  // ÉTATS
  // ============================================================================
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [totalOpenReceivables, setTotalOpenReceivables] = useState(0);

  const [accountsLoading, setAccountsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [projectFilterId, setProjectFilterId] = useState(null);
  const [accountFilterId, setAccountFilterId] = useState(null);

  const [projectExpenseLines, setProjectExpenseLines] = useState([]);
  const [projectRevenueLines, setProjectRevenueLines] = useState([]);

  // ✅ AJOUT : État global d'erreur
  const [error, setError] = useState(null);
  const clearError = useCallback(() => setError(null), []);

  // ============================================================================
  // REFRESH FUNCTIONS
  // ============================================================================

  const refreshProjectLines = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [unpaidExpenses, pendingRevenues] = await Promise.all([
        apiRequest('projects/expense-lines/unpaid'),
        apiRequest('projects/revenue-lines/pending'),
      ]);

      setProjectExpenseLines(Array.isArray(unpaidExpenses) ? unpaidExpenses : []);
      setProjectRevenueLines(Array.isArray(pendingRevenues) ? pendingRevenues : []);
    } catch (err) {
      console.error('Erreur refresh project lines:', err);
      setError({ message: 'Erreur lors du chargement des lignes de projet', details: err });
    }
  }, [isAuthenticated]);

  const refreshAccounts = useCallback(async () => {
    if (!isAuthenticated) return;
    setAccountsLoading(true);
    try {
      const data = await accountsService.getAll();
      setAccounts(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      if (err?.status === 401) {
        setAccounts([]);
        return;
      }
      console.error('Erreur chargement comptes:', err);
      setError({ message: 'Erreur lors du chargement des comptes', details: err });
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
      setError(null);
    } catch (err) {
      if (err?.status === 401) {
        setTransactions([]);
        return;
      }
      console.error('Erreur chargement transactions:', err);
      setError({ message: 'Erreur lors du chargement des transactions', details: err });
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

      // Normaliser les données avant de les stocker
      const normalized = Array.isArray(data)
        ? data.map((project) => ({
            ...project,
            expenses: parseJSONSafe(project.expenses, []),
            revenues: parseJSONSafe(project.revenues, []),
            expenseLines: project.expenseLines ?? project.expenselines ?? [],
            revenueLines: project.revenueLines ?? project.revenuelines ?? [],
          }))
        : [];

      setProjects(normalized);
      setError(null);
    } catch (err) {
      if (err?.status === 401) {
        setProjects([]);
        return;
      }
      console.error('Erreur chargement projets:', err);
      setError({ message: 'Erreur lors du chargement des projets', details: err });
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
        ? data.reduce((sum, r) => sum + Number(r?.amount ?? 0), 0)
        : 0;
      setTotalOpenReceivables(total);
      setError(null);
    } catch (err) {
      if (err?.status === 401) {
        setTotalOpenReceivables(0);
        return;
      }
      console.error('Erreur chargement receivables:', err);
      setError({ message: 'Erreur lors du chargement des receivables', details: err });
      setTotalOpenReceivables(0);
    }
  }, [isAuthenticated]);

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================
  useEffect(() => {
    if (!isAuthenticated) {
      setAccounts([]);
      setTransactions([]);
      setProjects([]);
      setTotalOpenReceivables(0);
      setProjectExpenseLines([]);
      setProjectRevenueLines([]);
      setError(null);
      return;
    }

    refreshAccounts();
    refreshTransactions();
    refreshProjects();
    refreshReceivables();
    refreshProjectLines();
  }, [
    isAuthenticated,
    refreshAccounts,
    refreshTransactions,
    refreshProjects,
    refreshReceivables,
    refreshProjectLines,
  ]);

  // ============================================================================
  // MUTATIONS - ACCOUNTS
  // ============================================================================
  const createAccount = useCallback(
    async (data) => {
      try {
        const created = await accountsService.create(data);
        await refreshAccounts();
        setError(null);
        return created;
      } catch (err) {
        console.error('Erreur createAccount:', err);
        setError({ message: 'Erreur lors de la création du compte', details: err });
        throw err;
      }
    },
    [refreshAccounts]
  );

  const updateAccount = useCallback(
    async (id, data) => {
      try {
        const updated = await accountsService.update(id, data);
        await refreshAccounts();
        setError(null);
        return updated;
      } catch (err) {
        console.error('Erreur updateAccount:', err);
        setError({ message: 'Erreur lors de la mise à jour du compte', details: err });
        throw err;
      }
    },
    [refreshAccounts]
  );

  const deleteAccount = useCallback(
    async (id) => {
      try {
        await accountsService.delete(id);
        await refreshAccounts();
        setError(null);
      } catch (err) {
        console.error('Erreur deleteAccount:', err);
        setError({ message: 'Erreur lors de la suppression du compte', details: err });
        throw err;
      }
    },
    [refreshAccounts]
  );

  // ============================================================================
  // MUTATIONS - TRANSACTIONS
  // ============================================================================
  const createTransaction = useCallback(
    async (data) => {
      try {
        const payload = {
          accountid: parseInt(data.accountid ?? data.accountId ?? data.accountid, 10),
          type: data.type,
          amount: parseFloat(data.amount),
          category: data.category ?? 'Autre',
          description: data.description ?? '',
          date: data.date ?? data.transactiondate ?? data.transactiondate ?? new Date().toISOString().split('T')[0],
          isplanned: data.isplanned ?? data.isplanned ?? false,
          isposted: data.isposted ?? data.isposted ?? true,
          projectid: data.projectid ?? data.projectId ?? data.projectid ?? null,
          projectlineid: data.projectlineid ?? data.projectlineid ?? null,
        };

        const response = await apiRequest('transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        await refreshTransactions();
        await refreshAccounts();
        setError(null);
        return response;
      } catch (err) {
        console.error('Erreur createTransaction:', err);
        setError({ message: 'Erreur lors de la création de la transaction', details: err });
        throw err;
      }
    },
    [refreshTransactions, refreshAccounts]
  );

  const updateTransaction = useCallback(
    async (id, data) => {
      try {
        const payload = {
          accountid: parseInt(data.accountid ?? data.accountId ?? data.accountid, 10),
          type: data.type,
          amount: parseFloat(data.amount),
          category: data.category ?? 'Autre',
          description: data.description ?? '',
          date: data.date ?? data.transactiondate ?? data.transactiondate ?? new Date().toISOString().split('T')[0],
          isplanned: data.isplanned ?? data.isplanned ?? false,
          isposted: data.isposted ?? data.isposted ?? true,
          projectid: data.projectid ?? data.projectId ?? data.projectid ?? null,
          projectlineid: data.projectlineid ?? data.projectlineid ?? null,
        };

        const response = await apiRequest(`transactions/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        await refreshTransactions();
        await refreshAccounts();
        setError(null);
        return response;
      } catch (err) {
        console.error('Erreur updateTransaction:', err);
        setError({ message: 'Erreur lors de la mise à jour de la transaction', details: err });
        throw err;
      }
    },
    [refreshTransactions, refreshAccounts]
  );

  const deleteTransaction = useCallback(
    async (id) => {
      try {
        await apiRequest(`transactions/${id}`, { method: 'DELETE' });
        await refreshTransactions();
        await refreshAccounts();
        setError(null);
      } catch (err) {
        console.error('Erreur deleteTransaction:', err);
        setError({ message: 'Erreur lors de la suppression de la transaction', details: err });
        throw err;
      }
    },
    [refreshTransactions, refreshAccounts]
  );

  // ============================================================================
  // MUTATIONS - PROJECTS
  // ============================================================================
  const createProject = useCallback(
    async (data) => {
      try {
        const created = await projectsService.create(data);
        await refreshProjects();
        setError(null);
        return created;
      } catch (err) {
        console.error('Erreur createProject:', err);
        setError({ message: 'Erreur lors de la création du projet', details: err });
        throw err;
      }
    },
    [refreshProjects]
  );

  const updateProject = useCallback(
    async (id, data) => {
      try {
        const updated = await projectsService.update(id, data);
        await refreshProjects();
        setError(null);
        return updated;
      } catch (err) {
        console.error('Erreur updateProject:', err);
        setError({ message: 'Erreur lors de la mise à jour du projet', details: err });
        throw err;
      }
    },
    [refreshProjects]
  );

  const deleteProject = useCallback(
    async (id) => {
      try {
        await apiRequest(`projects/${id}`, { method: 'DELETE' });
        await refreshProjects();
        setError(null);
      } catch (err) {
        console.error('Erreur deleteProject:', err);
        setError({ message: 'Erreur lors de la suppression du projet', details: err });
        throw err;
      }
    },
    [refreshProjects]
  );

  const completeProject = useCallback(
    async (projectId) => {
      try {
        const response = await apiRequest(`projects/${projectId}/complete`, {
          method: 'POST',
        });

        await refreshProjects();
        setError(null);
        return { success: true };
      } catch (err) {
        console.error('Erreur completeProject:', err);
        setError({ message: 'Erreur lors de la complétion du projet', details: err });
        throw err;
      }
    },
    [refreshProjects]
  );

    const activateProject = useCallback(
    async (projectId) => {
      try {
        const project = projects.find((p) => String(p.id) === String(projectId));
        if (!project) throw new Error('Projet introuvable');

        const parseExpenses = (data) => {
          if (Array.isArray(data)) return data;
          if (!data || typeof data !== 'string') return [];
          try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            console.error('Parse expenses failed:', e);
            return [];
          }
        };

        const parsedExpenses = parseExpenses(project.expenses);
        const parsedRevenues = parseExpenses(project.revenues);

        const newTransactions = [];

        // Créer les transactions de dépenses
        for (const exp of parsedExpenses) {
          const acc = accounts.find((a) => a.name === exp.account);
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
          const acc = accounts.find((a) => a.name === rev.account);
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
        await Promise.all([refreshTransactions(), refreshAccounts()]);

        setError(null);
        return {
          success: true,
          transactionCount: newTransactions.length,
        };
      } catch (err) {
        console.error('Erreur activation projet:', err);
        setError({ message: 'Erreur lors de l\'activation du projet', details: err });
        throw err;
      }
    },
    [projects, accounts, createTransaction, updateProject, refreshProjects, refreshTransactions, refreshAccounts]
  );

  const deactivateProject = useCallback(
    async (projectId) => {
      try {
        const project = projects?.find((p) => p.id === projectId);
        if (!project) throw new Error('Projet introuvable');

        const payload = {
          name: project.name,
          description: project.description ?? '',
          type: project.type,
          status: 'paused',
          startDate: project.startDate,
          endDate: project.endDate ?? null,
          totalCost: Number(project.totalCost) || 0,
          totalRevenues: Number(project.totalRevenues) || 0,
          netProfit: Number(project.netProfit) || 0,
          roi: Number(project.roi) || 0,
          expenses: typeof project.expenses === 'string' ? project.expenses : JSON.stringify(project.expenses ?? []),
          revenues: typeof project.revenues === 'string' ? project.revenues : JSON.stringify(project.revenues ?? []),
        };

        await apiRequest(`projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        await refreshProjects();
        setError(null);
        return { success: true };
      } catch (err) {
        console.error('Erreur deactivateProject:', err);
        setError({ message: 'Erreur lors de la désactivation du projet', details: err });
        throw err;
      }
    },
    [projects, refreshProjects]
  );

  const reactivateProject = useCallback(
    async (projectId) => {
      try {
        const project = projects?.find((p) => p.id === projectId);
        if (!project) throw new Error('Projet introuvable');

        const payload = {
          name: project.name,
          description: project.description ?? '',
          type: project.type,
          status: 'active',
          startDate: project.startDate,
          endDate: project.endDate ?? null,
          totalCost: Number(project.totalCost) || 0,
          totalRevenues: Number(project.totalRevenues) || 0,
          netProfit: Number(project.netProfit) || 0,
          roi: Number(project.roi) || 0,
          expenses: typeof project.expenses === 'string' ? project.expenses : JSON.stringify(project.expenses ?? []),
          revenues: typeof project.revenues === 'string' ? project.revenues : JSON.stringify(project.revenues ?? []),
        };

        await apiRequest(`projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        await refreshProjects();
        setError(null);
        return { success: true };
      } catch (err) {
        console.error('Erreur reactivateProject:', err);
        setError({ message: 'Erreur lors de la réactivation du projet', details: err });
        throw err;
      }
    },
    [projects, refreshProjects]
  );

  const archiveProject = useCallback(
    async (projectId) => {
      return await completeProject(projectId);
    },
    [completeProject]
  );

  // ============================================================================
  // IMPORT BULK TRANSACTIONS
  // ============================================================================
  const importTransactions = useCallback(
    async (importedTransactions) => {
      if (!Array.isArray(importedTransactions) || importedTransactions.length === 0) {
        throw new Error('Aucune transaction à importer');
      }

      try {
        // 1. Récupérer les transactions existantes
        const existingTransactions = transactions;

        // 2. Créer un index des signatures existantes
        const existingSignatures = new Map();
        existingTransactions.forEach((t) => {
          const sig = createSignature({
            accountId: t.accountid,
            date: t.transactiondate ?? t.date,
            amount: t.amount,
            type: t.type,
            description: t.description,
            category: t.category ?? 'Autre',
          });
          if (sig) {
            existingSignatures.set(sig, {
              id: t.id,
              description: t.description,
              amount: t.amount,
              date: t.transactiondate ?? t.date,
            });
          }
        });

        // 3. Filtrer les transactions à importer
        const newTransactions = [];
        const duplicates = [];
        const invalid = [];

        importedTransactions.forEach((trx, index) => {
          const sig = createSignature({
            accountId: trx.accountId,
            date: trx.date,
            amount: trx.amount,
            type: trx.type,
            description: trx.description,
            category: trx.category ?? 'Autre',
          });

          if (!sig) {
            invalid.push({
              index: index + 1,
              reason: 'Données invalides (date, montant ou compte manquant)',
              trx,
            });
            return;
          }

          if (existingSignatures.has(sig)) {
            const existing = existingSignatures.get(sig);
            duplicates.push({
              index: index + 1,
              sig,
              csv: trx,
              existing,
              reason: 'Transaction identique déjà en base',
            });
          } else {
            newTransactions.push(trx);
            existingSignatures.set(sig, { new: true });
          }
        });

        // 4. Si aucune nouvelle transaction, arrêter
        if (newTransactions.length === 0) {
          return {
            success: true,
            imported: 0,
            duplicates: duplicates.length,
            invalid: invalid.length,
            message: 'Aucune nouvelle transaction à importer',
            details: { duplicates, invalid },
          };
        }

        // 5. Calculer l'impact par compte
        const impactByAccount = {};
        newTransactions.forEach((trx) => {
          const accId = trx.accountId;
          if (!impactByAccount[accId]) {
            const account = accounts.find((a) => a.id === accId);
            impactByAccount[accId] = {
              name: account?.name ?? 'Compte inconnu',
              currentBalance: parseFloat(account?.balance) || 0,
              income: 0,
              expense: 0,
              count: 0,
            };
          }
          impactByAccount[accId].count++;
          if (trx.type === 'income') {
            impactByAccount[accId].income += trx.amount;
          } else {
            impactByAccount[accId].expense += trx.amount;
          }
        });

        // 6. Générer le message de confirmation
        let impactDetails = '\n\n📊 IMPACT SUR LES SOLDES :\n';
        Object.values(impactByAccount).forEach((acc) => {
          const netImpact = acc.income - acc.expense;
          const newBalance = acc.currentBalance + netImpact;
          const sign = netImpact >= 0 ? '+' : '';

          impactDetails += `\n• ${acc.name} (${acc.count} trx) :\n`;
          impactDetails += `  Solde actuel : ${acc.currentBalance.toLocaleString('fr-FR')} Ar\n`;
          if (acc.income > 0) impactDetails += `  + Revenus : ${acc.income.toLocaleString('fr-FR')} Ar\n`;
          if (acc.expense > 0) impactDetails += `  - Dépenses : ${acc.expense.toLocaleString('fr-FR')} Ar\n`;
          impactDetails += `  → Nouveau solde : ${newBalance.toLocaleString('fr-FR')} Ar (${sign}${netImpact.toLocaleString('fr-FR')} Ar)\n`;
        });

        const confirmMsg = `
📥 IMPORT CSV - CONFIRMATION

✅ Nouvelles transactions : ${newTransactions.length}
⚠️  Doublons ignorés : ${duplicates.length}
${invalid.length > 0 ? `❌ Invalides ignorées : ${invalid.length}\n` : ''}
${impactDetails}

Voulez-vous importer ces ${newTransactions.length} nouvelles transactions ?
`.trim();

        if (!window.confirm(confirmMsg)) {
          return {
            success: false,
            imported: 0,
            duplicates: duplicates.length,
            invalid: invalid.length,
            message: 'Import annulé par l\'utilisateur',
          };
        }

        // 7. Importer via l'endpoint bulk
        const payload = newTransactions.map((t) => ({
          accountid: t.accountId,
          type: t.type,
          amount: t.amount,
          category: t.category,
          description: t.description,
          transactiondate: t.date,
          isplanned: false,
          isposted: true,
          projectid: t.projectId ?? null,
          remarks: t.remarks ?? '',
        }));

        const result = await transactionsService.importTransactions(payload);
        const successCount = Number(result?.imported) || 0;
        const serverDuplicates = Number(result?.duplicates) || 0;

        if (successCount > 0) {
          // 8. Recalculer tous les soldes
          try {
            await apiRequest('accounts/recalculate-all', { method: 'POST' });
          } catch (recalcError) {
            console.error('Erreur recalcul:', recalcError);
          }

          // 9. Rafraîchir les données
          await refreshAccounts();
          await refreshTransactions();
        }

        setError(null);
        return {
          success: true,
          imported: successCount,
          duplicates: duplicates.length,
          serverDuplicates,
          invalid: invalid.length,
          message: `${successCount} transactions importées avec succès`,
          details: { duplicates, invalid },
        };
      } catch (err) {
        console.error('Erreur importTransactions:', err);
        setError({ message: 'Erreur lors de l\'import des transactions', details: err });
        throw err;
      }
    },
    [transactions, accounts, refreshAccounts, refreshTransactions]
  );

  // ============================================================================
  // SELECTORS & COMPUTED VALUES
  // ============================================================================

  const visibleTransactions = useMemo(() => {
    let list = transactions;
    if (projectFilterId) {
      list = list.filter((t) => String(t.projectid) === String(projectFilterId));
    }
    if (accountFilterId) {
      list = list.filter((t) => String(t.accountid) === String(accountFilterId));
    }
    return list;
  }, [transactions, projectFilterId, accountFilterId]);

  const { income, expense } = useMemo(() => {
    return transactions.reduce(
      (tot, t) => {
        const a = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
          tot.income += a;
        } else {
          tot.expense += a;
        }
        return tot;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const accountsWithCorrectReceivables = useMemo(() => {
    return accounts.map((acc) => {
      if (acc?.name === 'Receivables') {
        return { ...acc, balance: totalOpenReceivables };
      }
      return acc;
    });
  }, [accounts, totalOpenReceivables]);

  const totalBalance = useMemo(() => {
    return accountsWithCorrectReceivables.reduce((sum, acc) => sum + (parseFloat(acc?.balance) || 0), 0);
  }, [accountsWithCorrectReceivables]);

  const activeProjects = useMemo(() => {
    return projects.filter((p) => {
      const status = String(p?.status ?? '').toLowerCase();
      return (
        status === 'active' ||
        status === 'actif' ||
        status === 'draft' ||
        status.startsWith('phase')
      );
    });
  }, [projects]);

    const remainingCostSum = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const expensesArr = parseJSONSafe(p?.expenses, []);
      const futureExpenses = expensesArr.filter(
        (e) => e?.account !== 'Déjà Payé' && e?.account !== 'Payé'
      );
      const subtotal = futureExpenses.reduce((s, e) => s + (parseFloat(e?.amount) || 0), 0);
      return sum + subtotal;
    }, 0);
  }, [activeProjects]);

  const projectsTotalRevenues = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const revArr = parseJSONSafe(p?.revenues, []);
      const subtotal = revArr.reduce((s, r) => s + (parseFloat(r?.amount) || 0), 0);
      return sum + subtotal;
    }, 0);
  }, [activeProjects]);

  const projectsNetImpact = projectsTotalRevenues - remainingCostSum;

  const coffreAccount = accountsWithCorrectReceivables.find((a) => a?.name === 'Coffre');
  const currentCoffreBalance = Number(coffreAccount?.balance) || 0;

  const receivablesForecastCoffre = currentCoffreBalance + totalOpenReceivables;
  const receivablesForecastTotal = totalBalance + totalOpenReceivables;

  const projectsForecastCoffre = receivablesForecastCoffre + projectsNetImpact;
  const projectsForecastTotal = receivablesForecastTotal + projectsNetImpact;

  // Prévisions détaillées par projet à partir des lignes (PLANNED TRANSACTIONS)
  const plannedTransactions = useMemo(() => {
    const result = [];

    // 1. Dépenses non payées
    projectExpenseLines
      .filter((line) => line.isPaid === false || line.isPaid === null || line.isPaid === undefined)
      .forEach((line) => {
        const rawDate = line.transactionDate ?? line.transactiondate ?? null;
        const normalizedDate = toYmd(rawDate);

        if (!normalizedDate) {
          console.warn('Ligne projet sans date valide:', line.id, rawDate);
          return;
        }

        result.push({
          projectid: line.projectId ?? line.projectid,
          projectname: line.projectName ?? line.projectname,
          type: 'plannedexpense',
          amount: Number(line.projectedAmount ?? line.projectedamount ?? 0),
          date: normalizedDate,
          account: line.account ?? 'Coffre',
          category: line.category ?? 'Projet - Charge',
          description: line.description ?? '',
          lineid: line.id,
        });
      });

    // 2. Revenus non reçus
    projectRevenueLines
      .filter((line) => line.isReceived === false || line.isReceived === null || line.isReceived === undefined)
      .forEach((line) => {
        const rawDate = line.transactionDate ?? line.transactiondate ?? null;
        const normalizedDate = toYmd(rawDate);

        if (!normalizedDate) {
          console.warn('Ligne projet sans date valide:', line.id, rawDate);
          return;
        }

        result.push({
          projectid: line.projectId ?? line.projectid,
          projectname: line.projectName ?? line.projectname,
          type: 'plannedincome',
          amount: Number(line.projectedAmount ?? line.projectedamount ?? 0),
          date: normalizedDate,
          account: line.account ?? 'Coffre',
          category: line.category ?? 'Projet - Revenu',
          description: line.description ?? '',
          lineid: line.id,
        });
      });

    return result;
  }, [projectExpenseLines, projectRevenueLines]);

  const treasuryAlerts = useMemo(() => {
    const warnings = [];

    if (!accounts || !transactions) return warnings;

    accountsWithCorrectReceivables.forEach((acc) => {
      let projectedBalance = parseFloat(acc.balance) || 0;

      const plannedTrx = transactions.filter(
        (t) =>
          String(t.accountid ?? t.accountid) === String(acc.id) &&
          t.isplanned === true &&
          t.isposted === false
      );

      plannedTrx.forEach((t) => {
        if (t.type === 'income') {
          projectedBalance += parseFloat(t.amount) || 0;
        } else {
          projectedBalance -= parseFloat(t.amount) || 0;
        }
      });

      if (projectedBalance < 0) {
        warnings.push({
          type: 'warning',
          account: acc.name,
          accountId: acc.id,
          message: `Solde projeté négatif : ${projectedBalance.toFixed(2)} Ar`,
          projected: projectedBalance,
          plannedCount: plannedTrx.length,
        });
      }
    });

    return warnings;
  }, [accountsWithCorrectReceivables, transactions]);

  const transactionStats = useMemo(() => {
    if (!transactions) return { income: 0, expense: 0, total: 0 };

    const incomeCount = transactions.filter((t) => t.type === 'income').length;
    const expenseCount = transactions.filter((t) => t.type === 'expense').length;

    return {
      income: incomeCount,
      expense: expenseCount,
      total: transactions.length,
    };
  }, [transactions]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  const value = useMemo(
    () => ({
      // State
      accounts: accountsWithCorrectReceivables,
      transactions,
      projects,

      // Lignes projet & prévisions
      projectExpenseLines,
      projectRevenueLines,
      plannedTransactions,

      // Filters
      projectFilterId,
      setProjectFilterId,
      accountFilterId,
      setAccountFilterId,

      // Computed
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
      treasuryAlerts,
      transactionStats,

      // Loading
      accountsLoading,
      transactionsLoading,
      projectsLoading,

      // ✅ Gestion d'erreur
      error,
      clearError,

      // Refresh
      refreshAccounts,
      refreshTransactions,
      refreshProjects,
      refreshReceivables,

      // Mutations - Accounts
      createAccount,
      updateAccount,
      deleteAccount,

      // Mutations - Transactions
      createTransaction,
      updateTransaction,
      deleteTransaction,
      importTransactions,

      // Mutations - Projects
      createProject,
      updateProject,
      deleteProject,
      activateProject,
      archiveProject,
      deactivateProject,
      reactivateProject,
      completeProject,
    }),
    [
      accountsWithCorrectReceivables,
      transactions,
      projects,
      projectExpenseLines,
      projectRevenueLines,
      plannedTransactions,
      projectFilterId,
      accountFilterId,
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
      treasuryAlerts,
      transactionStats,
      accountsLoading,
      transactionsLoading,
      projectsLoading,
      error,
      clearError,
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
      importTransactions,
      createProject,
      updateProject,
      deleteProject,
      activateProject,
      archiveProject,
      deactivateProject,
      reactivateProject,
      completeProject,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance doit être utilisé dans un FinanceProvider');
  }
  return ctx;
}


