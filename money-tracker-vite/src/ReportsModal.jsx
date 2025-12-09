// ReportsModal.jsx - VERSION COMPLÈTE AVEC BOUTON COPIER
import React, { useState, useMemo } from 'react';
import { 
  X, Calendar, TrendingUp, TrendingDown, DollarSign, 
  PieChart, BarChart3, Download, Filter, ArrowUpRight, 
  ArrowDownRight, Wallet, CreditCard
} from 'lucide-react';
import { CopyButton } from './components/common/CopyButton';

// Utilitaires
const formatCurrency = (amount) => 
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount || 0) + " Ar";

const formatDate = (str) =>
  new Date(str).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric"
  });

const categoryIcons = {
  "Transport": "🚗", "Dons": "🎁", "Goûters": "🍪", "Hébergement": "🏠",
  "VINA": "💼", "Quotidienne": "🛒", "Frais": "💸", "Automobile": "🚙",
  "Autres": "📋", "Recettes": "💰", "Afterwork": "🍻", "Accessoires": "🕶️",
  "Crédits Phone": "📱", "Habillements": "👕", "Soins personnels": "🧼",
  "HOME MJG": "🏡", "Aide": "🤝", "DOIT": "🧾", "Extra Solde": "💵",
  "Transfer (Inward)": "📥", "@TAHIANA": "👩", "Transfert": "↔️",
  "Alimentation": "🍔", "Logement": "🏠", "Loisirs": "🎮", "Santé": "💊",
  "Éducation": "📚", "Salaire": "💰", "Vente": "💵", "Investissement": "📈"
};

export function ReportsModal({ onClose, transactions = [], accounts = [] }) {
  const [reportType, setReportType] = useState('summary'); // summary, category, account, timeline
  const [dateRange, setDateRange] = useState('all'); // all, month, quarter, year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('all');

  // Filtrage des transactions selon les critères
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Filtre par compte
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(t => 
        String(t.account_id || t.accountId) === String(selectedAccount)
      );
    }

    // Filtre par date
    const now = new Date();
    let startDate = null;

    switch(dateRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (customStartDate) startDate = new Date(customStartDate);
        break;
    }

    if (startDate) {
      filtered = filtered.filter(t => {
        const tDate = new Date(t.date || t.transaction_date);
        if (dateRange === 'custom' && customEndDate) {
          const endDate = new Date(customEndDate);
          return tDate >= startDate && tDate <= endDate;
        }
        return tDate >= startDate;
      });
    }

    return filtered;
  }, [transactions, dateRange, customStartDate, customEndDate, selectedAccount]);

  // Calculs des statistiques
  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const byCategory = filteredTransactions.reduce((acc, t) => {
      if (!acc[t.category]) {
        acc[t.category] = { income: 0, expense: 0, count: 0 };
      }
      acc[t.category].count++;
      if (t.type === 'income') {
        acc[t.category].income += parseFloat(t.amount);
      } else {
        acc[t.category].expense += parseFloat(t.amount);
      }
      return acc;
    }, {});

    const byAccount = filteredTransactions.reduce((acc, t) => {
      const accId = t.account_id || t.accountId;
      const account = accounts.find(a => a.id === accId);
      const accName = account ? account.name : 'Inconnu';
      
      if (!acc[accName]) {
        acc[accName] = { income: 0, expense: 0, count: 0 };
      }
      acc[accName].count++;
      if (t.type === 'income') {
        acc[accName].income += parseFloat(t.amount);
      } else {
        acc[accName].expense += parseFloat(t.amount);
      }
      return acc;
    }, {});

    // Timeline (par mois)
    const byMonth = filteredTransactions.reduce((acc, t) => {
      const date = new Date(t.date || t.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { income: 0, expense: 0, net: 0 };
      }
      if (t.type === 'income') {
        acc[monthKey].income += parseFloat(t.amount);
      } else {
        acc[monthKey].expense += parseFloat(t.amount);
      }
      acc[monthKey].net = acc[monthKey].income - acc[monthKey].expense;
      return acc;
    }, {});

    return {
      income,
      expense,
      net: income - expense,
      totalTransactions: filteredTransactions.length,
      byCategory,
      byAccount,
      byMonth: Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]))
    };
  }, [filteredTransactions, accounts]);

  // Export CSV
  const handleExportCSV = () => {
    let csvContent = "Date,Description,Catégorie,Type,Montant,Compte\n";
    
    filteredTransactions.forEach(t => {
      const account = accounts.find(a => a.id === (t.account_id || t.accountId));
      const row = [
        t.date || t.transaction_date,
        `"${t.description}"`,
        t.category,
        t.type === 'income' ? 'Revenu' : 'Dépense',
        t.amount,
        account ? account.name : 'Inconnu'
      ].join(',');
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rapport_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // ✅ Fonction pour générer le texte à copier
  const generateCopyText = () => {
    const now = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });

    let text = `📄 RAPPORT FINANCIER\n`;
    text += `═══════════════════════════════════════════════\n`;
    text += `Date: ${now}\n`;
    text += `Période: ${dateRange === 'all' ? 'Toutes' : dateRange === 'month' ? 'Mois en cours' : dateRange === 'quarter' ? 'Trimestre' : dateRange === 'year' ? 'Année' : 'Personnalisée'}\n`;
    text += `Type de rapport: ${reportType === 'summary' ? 'Vue d\'ensemble' : reportType === 'category' ? 'Par catégorie' : reportType === 'account' ? 'Par compte' : 'Chronologie'}\n`;
    text += `\n`;

    // Résumé financier
    text += `💰 RÉSUMÉ FINANCIER\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `Revenus totaux:    ${formatCurrency(stats.income)}\n`;
    text += `Dépenses totales:  ${formatCurrency(stats.expense)}\n`;
    text += `Solde net:         ${formatCurrency(stats.net)}\n`;
    text += `Transactions:      ${stats.totalTransactions}\n`;
    if (stats.income > 0) {
      text += `Taux d'épargne:    ${((stats.net / stats.income) * 100).toFixed(1)}%\n`;
    }
    text += `\n`;

    // Par catégorie
    if (Object.keys(stats.byCategory).length > 0) {
      text += `📊 PAR CATÉGORIE\n`;
      text += `───────────────────────────────────────────────\n`;
      Object.entries(stats.byCategory)
        .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
        .slice(0, 10)
        .forEach(([category, data]) => {
          text += `${category}:\n`;
          if (data.income > 0) text += `  Revenus:  ${formatCurrency(data.income)}\n`;
          if (data.expense > 0) text += `  Dépenses: ${formatCurrency(data.expense)}\n`;
          text += `  Net:      ${formatCurrency(data.income - data.expense)}\n`;
          text += `  Trans:    ${data.count}\n`;
        });
      text += `\n`;
    }

    // Par compte
    if (Object.keys(stats.byAccount).length > 0) {
      text += `💳 PAR COMPTE\n`;
      text += `───────────────────────────────────────────────\n`;
      Object.entries(stats.byAccount)
        .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
        .forEach(([accountName, data]) => {
          text += `${accountName}:\n`;
          text += `  Revenus:  ${formatCurrency(data.income)}\n`;
          text += `  Dépenses: ${formatCurrency(data.expense)}\n`;
          text += `  Flux net: ${formatCurrency(data.income - data.expense)}\n`;
          text += `  Trans:    ${data.count}\n`;
        });
      text += `\n`;
    }

    // Timeline
    if (stats.byMonth.length > 0) {
      text += `📆 ÉVOLUTION MENSUELLE\n`;
      text += `───────────────────────────────────────────────\n`;
      stats.byMonth.forEach(([month, data]) => {
        const monthName = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        text += `${monthName}:\n`;
        text += `  Revenus:  ${formatCurrency(data.income)}\n`;
        text += `  Dépenses: ${formatCurrency(data.expense)}\n`;
        text += `  Net:      ${formatCurrency(data.net)}\n`;
      });
      text += `\n`;
    }

    text += `═══════════════════════════════════════════════\n`;
    text += `Généré par Money Tracker • ${new Date().toLocaleTimeString('fr-FR')}\n`;

    return text;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">📄 Rapports Financiers</h2>
              <p className="text-indigo-100 text-sm mt-1">
                Analyse détaillée de vos finances
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* ✅ Bouton Copier */}
              <CopyButton textToCopy={generateCopyText()} />
              
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-gray-50 border-b p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Type de rapport */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type de rapport</label>
              <select 
                value={reportType} 
                onChange={e => setReportType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="summary">Vue d'ensemble</option>
                <option value="category">Par catégorie</option>
                <option value="account">Par compte</option>
                <option value="timeline">Chronologie</option>
              </select>
            </div>

            {/* Période */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Période</label>
              <select 
                value={dateRange} 
                onChange={e => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">Tout</option>
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
                <option value="custom">Personnalisé</option>
              </select>
            </div>

            {/* Compte */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Compte</label>
              <select 
                value={selectedAccount} 
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="all">Tous les comptes</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>

            {/* Export */}
            <div className="flex items-end">
              <button 
                onClick={handleExportCSV}
                className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition flex items-center justify-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Exporter CSV</span>
              </button>
            </div>
          </div>

          {/* Dates personnalisées */}
          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date de début</label>
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date de fin</label>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Vue d'ensemble */}
          {reportType === 'summary' && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm opacity-90">Revenus</span>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.income)}</p>
                </div>

                <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm opacity-90">Dépenses</span>
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.expense)}</p>
                </div>

                <div className={`bg-gradient-to-br ${stats.net >= 0 ? 'from-indigo-500 to-purple-600' : 'from-orange-500 to-red-600'} rounded-xl p-4 text-white`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm opacity-90">Bilan</span>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.net)}</p>
                </div>

                <div className="bg-gradient-to-br from-gray-700 to-gray-900 rounded-xl p-4 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm opacity-90">Transactions</span>
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-bold">{stats.totalTransactions}</p>
                </div>
              </div>

              {/* Graphique de répartition */}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Répartition des dépenses</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byCategory)
                    .filter(([_, data]) => data.expense > 0)
                    .sort((a, b) => b[1].expense - a[1].expense)
                    .slice(0, 10)
                    .map(([category, data]) => {
                      const percentage = (data.expense / stats.expense) * 100;
                      return (
                        <div key={category}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium flex items-center space-x-2">
                              <span className="text-xl">{categoryIcons[category] || '📦'}</span>
                              <span>{category}</span>
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {formatCurrency(data.expense)} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-rose-500 to-red-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Top transactions */}
              <div className="bg-white rounded-xl border p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Plus grosses transactions</h3>
                <div className="space-y-2">
                  {filteredTransactions
                    .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
                    .slice(0, 10)
                    .map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{categoryIcons[t.category] || '📦'}</span>
                          <div>
                            <p className="font-semibold text-gray-900">{t.description}</p>
                            <p className="text-xs text-gray-500">{formatDate(t.date || t.transaction_date)} • {t.category}</p>
                          </div>
                        </div>
                        <span className={`text-lg font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Par catégorie */}
          {reportType === 'category' && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">Analyse par catégorie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(stats.byCategory)
                  .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
                  .map(([category, data]) => (
                    <div key={category} className="bg-white border rounded-xl p-5 hover:shadow-lg transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-3xl">{categoryIcons[category] || '📦'}</span>
                          <h4 className="font-bold text-lg">{category}</h4>
                        </div>
                        <span className="text-sm text-gray-500">{data.count} trans.</span>
                      </div>
                      <div className="space-y-2">
                        {data.income > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center">
                              <ArrowUpRight className="w-4 h-4 text-emerald-600 mr-1" />
                              Revenus
                            </span>
                            <span className="font-bold text-emerald-600">{formatCurrency(data.income)}</span>
                          </div>
                        )}
                        {data.expense > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 flex items-center">
                              <ArrowDownRight className="w-4 h-4 text-rose-600 mr-1" />
                              Dépenses
                            </span>
                            <span className="font-bold text-rose-600">{formatCurrency(data.expense)}</span>
                          </div>
                        )}
                        <div className="border-t pt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">Net</span>
                          <span className={`font-bold ${data.income - data.expense >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                            {formatCurrency(data.income - data.expense)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Par compte */}
          {reportType === 'account' && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">Analyse par compte</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(stats.byAccount)
                  .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
                  .map(([accountName, data]) => (
                    <div key={accountName} className="bg-white border rounded-xl p-5 hover:shadow-lg transition">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Wallet className="w-6 h-6 text-indigo-600" />
                          <h4 className="font-bold text-lg">{accountName}</h4>
                        </div>
                        <span className="text-sm text-gray-500">{data.count} trans.</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 flex items-center">
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 mr-1" />
                            Revenus
                          </span>
                          <span className="font-bold text-emerald-600">{formatCurrency(data.income)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 flex items-center">
                            <ArrowDownRight className="w-4 h-4 text-rose-600 mr-1" />
                            Dépenses
                          </span>
                          <span className="font-bold text-rose-600">{formatCurrency(data.expense)}</span>
                        </div>
                        <div className="border-t pt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">Flux net</span>
                          <span className={`font-bold ${data.income - data.expense >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                            {formatCurrency(data.income - data.expense)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {reportType === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">Évolution mensuelle</h3>
              <div className="bg-white border rounded-xl p-6">
                <div className="space-y-4">
                  {stats.byMonth.map(([month, data]) => {
                    const maxValue = Math.max(...stats.byMonth.map(([_, d]) => Math.max(d.income, d.expense)));
                    return (
                      <div key={month} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900">
                            {new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                          </span>
                          <span className={`font-bold ${data.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            Net: {formatCurrency(data.net)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-emerald-600">Revenus</span>
                              <span className="font-semibold">{formatCurrency(data.income)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${(data.income / maxValue) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-rose-600">Dépenses</span>
                              <span className="font-semibold">{formatCurrency(data.expense)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-rose-500 h-2 rounded-full transition-all"
                                style={{ width: `${(data.expense / maxValue) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
