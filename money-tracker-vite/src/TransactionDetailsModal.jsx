import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, DollarSign, Tag, FileText, Search } from 'lucide-react';

export function TransactionDetailsModal({ type, transactions, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // all, today, week, month, year

  // Filtrer les transactions selon le type (income/expense)
  const filteredByType = transactions.filter(t => t.type === type);

  // Extraire les catégories uniques
  const categories = useMemo(() => {
    const cats = [...new Set(filteredByType.map(t => t.category))];
    return cats.sort();
  }, [filteredByType]);

  // Appliquer les filtres
  const filteredTransactions = useMemo(() => {
    let result = [...filteredByType];

    // Filtre par recherche
    if (searchTerm) {
      result = result.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtre par catégorie
    if (selectedCategory !== 'all') {
      result = result.filter(t => t.category === selectedCategory);
    }

    // Filtre par période
    if (selectedPeriod !== 'all') {
      const now = new Date();
      result = result.filter(t => {
        const txDate = new Date(t.transaction_date);
        switch (selectedPeriod) {
          case 'today':
            return txDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return txDate >= weekAgo;
          case 'month':
            return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
          case 'year':
            return txDate.getFullYear() === now.getFullYear();
          default:
            return true;
        }
      });
    }

    return result.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  }, [filteredByType, searchTerm, selectedCategory, selectedPeriod]);

  // Calculs statistiques
  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const count = filteredTransactions.length;
    const average = count > 0 ? total / count : 0;
    const max = count > 0 ? Math.max(...filteredTransactions.map(t => parseFloat(t.amount))) : 0;
    const min = count > 0 ? Math.min(...filteredTransactions.map(t => parseFloat(t.amount))) : 0;

    // Stats par catégorie
    const byCategory = {};
    filteredTransactions.forEach(t => {
      if (!byCategory[t.category]) {
        byCategory[t.category] = { total: 0, count: 0 };
      }
      byCategory[t.category].total += parseFloat(t.amount);
      byCategory[t.category].count += 1;
    });

    return { total, count, average, max, min, byCategory };
  }, [filteredTransactions]);

  const isIncome = type === 'income';
  const title = isIncome ? 'Encaissements' : 'Dépenses';
  const colorClass = isIncome ? 'text-green-600' : 'text-red-600';
  const bgClass = isIncome ? 'bg-green-50' : 'bg-red-50';
  const Icon = isIncome ? TrendingUp : TrendingDown;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className={`${bgClass} border-b border-gray-200 p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`w-8 h-8 ${colorClass}`} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
                <p className="text-sm text-gray-600">{stats.count} transactions trouvées</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Stats Cards avec dégradé subtil */}
<div className="grid grid-cols-5 gap-4 p-6 bg-gray-50 border-b">
  {/* Total - Plus foncé */}
  <div className={`p-4 rounded-lg shadow-md ${isIncome ? 'bg-gradient-to-br from-green-600 to-green-500' : 'bg-gradient-to-br from-red-600 to-red-500'}`}>
    <p className="text-xs text-gray-700 uppercase font-semibold">Total</p>
    <p className="text-xl font-bold text-gray-700">
      {stats.total.toLocaleString('fr-FR')} Ar
    </p>
  </div>

  {/* Nombre */}
  <div className={`p-4 rounded-lg shadow-md ${isIncome ? 'bg-gradient-to-br from-green-500 to-green-400' : 'bg-gradient-to-br from-red-500 to-red-400'}`}>
    <p className="text-xs text-gray-700 uppercase font-semibold">Nombre</p>
    <p className="text-xl font-bold text-gray-700">{stats.count}</p>
  </div>

  {/* Moyenne */}
  <div className={`p-4 rounded-lg shadow-md ${isIncome ? 'bg-gradient-to-br from-green-400 to-green-300' : 'bg-gradient-to-br from-red-400 to-red-300'}`}>
    <p className="text-xs text-gray-700 uppercase font-semibold">Moyenne</p>
    <p className="text-xl font-bold text-gray-700">
      {stats.average.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ar
    </p>
  </div>

  {/* Maximum */}
  <div className={`p-4 rounded-lg shadow-md ${isIncome ? 'bg-gradient-to-br from-green-300 to-green-200' : 'bg-gradient-to-br from-red-300 to-red-200'}`}>
    <p className="text-xs text-gray-700 uppercase font-semibold">Maximum</p>
    <p className="text-xl font-bold text-gray-900">
      {stats.max.toLocaleString('fr-FR')} Ar
    </p>
  </div>

  {/* Minimum - Plus clair */}
  <div className={`p-4 rounded-lg shadow-md ${isIncome ? 'bg-gradient-to-br from-green-200 to-green-100' : 'bg-gradient-to-br from-red-200 to-red-100'}`}>
    <p className="text-xs text-gray-700 uppercase font-semibold">Minimum</p>
    <p className="text-xl font-bold text-gray-900">
      {stats.min.toLocaleString('fr-FR')} Ar
    </p>
  </div>
</div>

        {/* Filtres */}
        <div className="p-6 bg-white border-b space-y-4">
          {/* Barre de recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par description ou catégorie..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-4">
            {/* Filtre par catégorie */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Toutes les catégories ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Filtre par période */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Toutes les périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois-ci</option>
              <option value="year">Cette année</option>
            </select>
          </div>
        </div>

        {/* Liste des transactions */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune transaction trouvée</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center`}>
                      <Tag className={`w-5 h-5 ${colorClass}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{transaction.description}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {transaction.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(transaction.transaction_date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-gray-400">
                          {transaction.account_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${colorClass}`}>
                    {parseFloat(transaction.amount).toLocaleString('fr-FR')} Ar
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Top catégories */}
        <div className="border-t bg-gray-50 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Top 5 Catégories</h3>
          <div className="grid grid-cols-5 gap-3">
            {Object.entries(stats.byCategory)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 5)
              .map(([category, data]) => (
                <div key={category} className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-xs text-gray-500 truncate">{category}</p>
                  <p className={`text-lg font-bold ${colorClass}`}>
                    {data.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ar
                  </p>
                  <p className="text-xs text-gray-400">{data.count} transactions</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
