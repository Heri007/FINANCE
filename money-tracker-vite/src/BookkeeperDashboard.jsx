// src/BookkeeperDashboard.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart,
  Wallet,
  Filter,
} from 'lucide-react';
import { CopyButton } from './components/common/CopyButton';
import { useFinance } from './contexts/FinanceContext';

// Utilitaires
const formatCurrency = (amount) =>
  new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount || 0) + ' Ar';

export default function BookkeeperDashboard({ onClose }) {
  const { transactions: ctxTransactions, accounts, projects } = useFinance();

  const transactions = ctxTransactions || [];

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    console.log('📊 BookkeeperDashboard - Transactions reçues:', transactions.length);
    console.log('📊 BookkeeperDashboard - Comptes reçus:', accounts.length);
    console.log('📊 BookkeeperDashboard - Projets reçus:', projects.length);
  }, [transactions, accounts, projects]);

  // Texte pour CopyButton - VERSION COMPLÈTE
  const generateCopyText = () => {
    const now = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let text = `📊 BOOKKEEPER DASHBOARD\n`;
    text += `═══════════════════════════════════════════════\n`;
    text += `Date: ${now}\n`;
    text += `What I don't track can't grow\n\n`;

    // RÉSUMÉ GLOBAL
    text += `💰 RÉSUMÉ FINANCIER GLOBAL\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `Solde total:           ${formatCurrency(filteredTotalBalance)}\n`;
    text += `Comptes suivis:        ${accounts.length}\n`;
    text += `Encaissements filtrés: ${formatCurrency(filteredIncome)}\n`;
    text += `  (${filteredTransactions.filter((t) => t.type === 'income').length} transactions)\n`;
    text += `Dépenses filtrées:     ${formatCurrency(filteredExpense)}\n`;
    text += `  (${filteredTransactions.filter((t) => t.type === 'expense').length} transactions)\n`;
    text += `Solde net:             ${formatCurrency(filteredIncome - filteredExpense)}\n`;
    text += `Projets actifs:        ${projects.length}\n\n`;

    // DÉTAIL DES COMPTES
    if (accounts.length > 0) {
      text += `💳 DÉTAIL DES COMPTES\n`;
      text += `───────────────────────────────────────────────\n`;
      accounts
        .sort((a, b) => parseFloat(b.balance || 0) - parseFloat(a.balance || 0))
        .forEach((acc) => {
          text += `${acc.name}: ${formatCurrency(acc.balance || 0)}\n`;
        });
      text += `\n`;
    }

    // IMPACTS À VENIR (PROJETS)
    const futureImpacts = projectTimelines.reduce((sum, project) => {
      return (
        sum +
        project.accountTimelines.reduce((accSum, acc) => {
          return (
            accSum +
            acc.events.reduce(
              (evSum, ev) => (ev.type === 'income' ? evSum + (ev.amount || 0) : evSum),
              0
            )
          );
        }, 0)
      );
    }, 0);

    if (futureImpacts > 0) {
      text += `📈 IMPACTS À VENIR\n`;
      text += `───────────────────────────────────────────────\n`;
      text += `Revenus projetés:      ${formatCurrency(futureImpacts)}\n`;
      text += `(Gain futur brut hors transferts et dépenses)\n\n`;
    }

    // PROJETS ACTIFS
    if (projects.length > 0) {
      text += `📋 PROJETS ACTIFS (${projects.length})\n`;
      text += `───────────────────────────────────────────────\n`;
      projects.forEach((project, idx) => {
        text += `${idx + 1}. ${project.name}\n`;
        text += `   Type: ${project.type || 'N/A'}\n`;
        text += `   Budget: ${formatCurrency(project.totalCost || 0)}\n`;
        text += `   CA prévu: ${formatCurrency(project.totalRevenues || 0)}\n`;
        text += `   ROI: ${(project.roi || 0).toFixed(1)}%\n`;
      });
      text += `\n`;
    }

    // FILTRES ACTIFS
    const activeFilters = [];
    if (selectedAccountId) {
      const acc = accounts.find((a) => String(a.id) === String(selectedAccountId));
      if (acc) activeFilters.push(`Compte: ${acc.name}`);
    }
    if (selectedProjectId) {
      const proj = projects.find((p) => String(p.id) === String(selectedProjectId));
      if (proj) activeFilters.push(`Projet: ${proj.name}`);
    }
    if (dateRange.from) activeFilters.push(`Début: ${dateRange.from}`);
    if (dateRange.to) activeFilters.push(`Fin: ${dateRange.to}`);

    if (activeFilters.length > 0) {
      text += `🔍 FILTRES ACTIFS\n`;
      text += `───────────────────────────────────────────────\n`;
      activeFilters.forEach((filter) => {
        text += `• ${filter}\n`;
      });
      text += `\n`;
    }

    // TRANSACTIONS FILTRÉES (TOP 20)
    text += `📝 TRANSACTIONS FILTRÉES (${filteredTransactions.length} total)\n`;
    text += `───────────────────────────────────────────────\n`;

    if (filteredTransactions.length === 0) {
      text += `Aucune transaction ne correspond aux filtres.\n\n`;
    } else {
      const displayCount = Math.min(filteredTransactions.length, 20);
      text += `Affichage des ${displayCount} premières:\n\n`;

      filteredTransactions.slice(0, 20).forEach((tx) => {
        const acc = accounts.find((a) => a.id === tx.account_id);
        const proj = projects.find((p) => p.id === tx.project_id);
        const date = String(tx.date || tx.transactiondate || '')
          .split('T')[0]
          .replace(/-/g, '/');

        text += `${date} | ${tx.type === 'income' ? '📈' : '📉'} ${formatCurrency(tx.amount)}\n`;
        text += `  ${tx.description || '—'}\n`;
        if (acc) text += `  Compte: ${acc.name}\n`;
        if (proj) text += `  Projet: ${proj.name}\n`;
        text += `\n`;
      });

      if (filteredTransactions.length > 20) {
        text += `... et ${filteredTransactions.length - 20} autres transactions\n\n`;
      }
    }

    // STATISTIQUES PAR CATÉGORIE
    const categoryStats = {};
    filteredTransactions.forEach((tx) => {
      const cat = tx.category || 'Non catégorisé';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { income: 0, expense: 0, count: 0 };
      }
      categoryStats[cat].count++;
      if (tx.type === 'income') {
        categoryStats[cat].income += parseFloat(tx.amount || 0);
      } else if (tx.type === 'expense') {
        categoryStats[cat].expense += parseFloat(tx.amount || 0);
      }
    });

    if (Object.keys(categoryStats).length > 0) {
      text += `📊 STATISTIQUES PAR CATÉGORIE\n`;
      text += `───────────────────────────────────────────────\n`;
      Object.entries(categoryStats)
        .sort((a, b) => b[1].income + b[1].expense - (a[1].income + a[1].expense))
        .slice(0, 10)
        .forEach(([category, stats]) => {
          text += `${category}:\n`;
          if (stats.income > 0) text += `  Revenus:  ${formatCurrency(stats.income)}\n`;
          if (stats.expense > 0) text += `  Dépenses: ${formatCurrency(stats.expense)}\n`;
          text += `  Net:      ${formatCurrency(stats.income - stats.expense)}\n`;
          text += `  Trans:    ${stats.count}\n`;
        });
      text += `\n`;
    }

    text += `═══════════════════════════════════════════════\n`;
    text += `Généré par Money Tracker • ${new Date().toLocaleTimeString('fr-FR')}\n`;

    return text;
  };

  // Transactions filtrées (bloc tableau)
  const filteredTransactions = useMemo(() => {
    let list = transactions || [];

    if (selectedAccountId) {
      list = list.filter((t) => String(t.account_id) === String(selectedAccountId));
    }
    if (selectedProjectId) {
      list = list.filter((t) => String(t.project_id) === String(selectedProjectId));
    }
    if (dateRange.from) {
      list = list.filter(
        (t) => new Date(t.date || t.transactiondate) >= new Date(dateRange.from)
      );
    }
    if (dateRange.to) {
      list = list.filter(
        (t) => new Date(t.date || t.transactiondate) <= new Date(dateRange.to)
      );
    }

    return list;
  }, [transactions, selectedAccountId, selectedProjectId, dateRange]);

  const { filteredIncome, filteredExpense } = useMemo(() => {
    return (filteredTransactions || []).reduce(
      (tot, t) => {
        const a = parseFloat(t.amount || 0);
        if (t.type === 'income') tot.filteredIncome += a;
        else if (t.type === 'expense') tot.filteredExpense += a;
        return tot;
      },
      { filteredIncome: 0, filteredExpense: 0 }
    );
  }, [filteredTransactions]);

  const filteredTotalBalance = useMemo(
    () => (accounts || []).reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0),
    [accounts]
  );

  // Impacts à venir : calcul simplifié par projet
  const projectTimelines = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    return projects.map((project) => {
      const accountTimelines = (project.revenueLines || [])
        .filter((line) => !!line.transactionDate)
        .map((line) => ({
          accountId: null, // si tu veux, tu peux mapper vers un compte plus tard
          accountName: project.name || 'Projet',
          events: [
            {
              date: line.transactionDate,
              description: line.description || 'Revenu projet',
              type: 'income',
              amount: parseFloat(line.projectedAmount || line.actualAmount || 0),
            },
          ],
        }));

      return {
        projectId: project.id,
        projectName: project.name,
        accountTimelines,
      };
    });
  }, [projects]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border-4 border-blue-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
              📊 Bookkeeper Dashboard
            </h1>
            <p className="text-blue-100 text-sm">
              What I don't track can't grow • {transactions.length} transactions
            </p>
          </div>

          <div className="flex items-center gap-4">
            <CopyButton getText={generateCopyText} />
            <button
              onClick={onClose}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-3 rounded-xl transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs période (cosmétique) */}
        <div className="bg-white border-b-2 border-blue-200 px-6 py-3 flex gap-2">
          {['week', 'month', 'quarter', 'year'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period === 'week'
                ? 'Semaine'
                : period === 'month'
                  ? 'Mois'
                  : period === 'quarter'
                    ? 'Trimestre'
                    : 'Année'}
            </button>
          ))}
        </div>

        <div className="p-6 h-[70vh] overflow-y-auto">
          {/* Résumé global + filtres + table */}
          <div className="space-y-4 mb-6">
            {/* Résumé global */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-indigo-700 font-medium">Solde total</span>
                  <Wallet className="w-4 h-4 text-indigo-700" />
                </div>
                <p className="text-xl font-bold text-indigo-900">
                  {filteredTotalBalance.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'MGA',
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  {accounts.length} comptes suivis
                </p>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-emerald-700 font-medium">
                    Encaissements (filtrés)
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                </div>
                <p className="text-xl font-bold text-emerald-900">
                  {filteredIncome.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'MGA',
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {(filteredTransactions || []).filter((t) => t.type === 'income').length}{' '}
                  transactions
                </p>
              </div>

              <div className="bg-rose-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-rose-700 font-medium">
                    Dépenses (filtrées)
                  </span>
                  <TrendingDown className="w-4 h-4 text-rose-700" />
                </div>
                <p className="text-xl font-bold text-rose-900">
                  {filteredExpense.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'MGA',
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-rose-600 mt-1">
                  {
                    (filteredTransactions || []).filter((t) => t.type === 'expense')
                      .length
                  }{' '}
                  transactions
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-700 font-medium">Projets</span>
                  <PieChart className="w-4 h-4 text-slate-700" />
                </div>
                <p className="text-xl font-bold text-slate-900">{projects.length}</p>
                <p className="text-xs text-slate-600 mt-1">Avec transactions associées</p>
              </div>
            </div>

            {/* Impacts à venir (résumé) */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-blue-700">
                    Impacts à venir (projets)
                  </p>
                  <p className="text-[11px] text-blue-600">
                    Somme des revenus projetés sur tous les projets actifs.
                  </p>
                </div>
              </div>

              <p className="text-lg font-bold text-blue-900">
                {formatCurrency(
                  projectTimelines.reduce((sum, project) => {
                    return (
                      sum +
                      project.accountTimelines.reduce((accSum, acc) => {
                        return (
                          accSum +
                          acc.events.reduce(
                            (evSum, ev) =>
                              ev.type === 'income' ? evSum + (ev.amount || 0) : evSum,
                            0
                          )
                        );
                      }, 0)
                    );
                  }, 0)
                )}
              </p>
              <p className="text-[11px] text-blue-700 mt-1">
                Gain futur brut (hors transferts internes et dépenses).
              </p>
            </div>

            {/* Filtres */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                <Filter className="w-4 h-4" />
                Filtres
              </div>

              <select
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(e.target.value || null)}
                className="text-sm border rounded-lg px-2 py-1"
              >
                <option value="">Tous les comptes</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="text-sm border rounded-lg px-2 py-1"
              >
                <option value="">Tous les projets</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                <span>Période (optionnel)</span>
              </div>

              {/* Dates simples, sans lib externe */}
              <input
                type="date"
                className="text-sm border rounded-lg px-2 py-1"
                value={dateRange.from || ''}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    from: e.target.value || null,
                  }))
                }
              />
              <span className="text-xs text-slate-500">→</span>
              <input
                type="date"
                className="text-sm border rounded-lg px-2 py-1"
                value={dateRange.to || ''}
                onChange={(e) =>
                  setDateRange((prev) => ({
                    ...prev,
                    to: e.target.value || null,
                  }))
                }
              />

              {(selectedAccountId ||
                selectedProjectId ||
                dateRange.from ||
                dateRange.to) && (
                <button
                  onClick={() => {
                    setSelectedAccountId(null);
                    setSelectedProjectId(null);
                    setDateRange({ from: null, to: null });
                  }}
                  className="text-xs text-blue-600 hover:underline ml-auto"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>

          {/* Tableau des transactions filtrées */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">
                Transactions filtrées
              </h2>
              <span className="text-xs text-slate-500">
                {filteredTransactions.length} ligne
                {filteredTransactions.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Compte</th>
                    <th className="px-3 py-2 text-left font-medium">Projet</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-right font-medium">Montant</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                        Aucune transaction ne correspond aux filtres
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const acc = accounts.find((a) => a.id === tx.account_id);
                      const proj = projects.find((p) => p.id === tx.project_id);
                      return (
                        <tr
                          key={tx.id}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2">
                            {String(tx.date || tx.transactiondate || '')
                              .split('T')[0]
                              .replace(/-/g, '/')}
                          </td>
                          <td className="px-3 py-2">{acc ? acc.name : '—'}</td>
                          <td className="px-3 py-2">{proj ? proj.name : '—'}</td>
                          <td className="px-3 py-2">
                            {tx.type === 'income' ? 'Encaissement' : 'Dépense'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-3 py-2">{tx.description || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
