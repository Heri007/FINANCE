// src/components/transactions/CategoryBreakdown.jsx
import React, { useMemo, useState } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { categoryIcons } from '../../utils/constants';

// ✅ COMPOSANT MODAL POUR AFFICHER LES TRANSACTIONS D'UNE CATÉGORIE
const CategoryTransactionsModal = ({ 
  category, 
  transactions, 
  type, 
  onClose,
  onTransactionClick 
}) => {
  if (!transactions || transactions.length === 0) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className={`p-6 border-b border-gray-100 bg-gradient-to-r ${
          type === 'income' ? 'from-green-50 to-emerald-50' : 'from-red-50 to-rose-50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                type === 'income' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {categoryIcons[category] || '📦'}
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {category}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {transactions.length} transaction{transactions.length > 1 ? 's' : ''} • {formatCurrency(total)}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Liste des transactions scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => {
                  onClose();
                  if (onTransactionClick) onTransactionClick(tx);
                }}
                className="flex justify-between items-center p-4 hover:bg-gray-50 rounded-xl cursor-pointer transition-all border border-gray-100 hover:border-gray-200 hover:shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {tx.description || tx.category}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {formatDate(tx.transactiondate || tx.date || tx.transaction_date)}
                  </p>
                </div>
                
                <div className="text-right ml-4 flex-shrink-0">
                  <p className={`font-bold text-lg ${
                    type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                  {!tx.is_posted && !tx.isposted && (
                    <span className="text-xs text-orange-500">⚠ Non validé</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-6 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-semibold">Total</span>
            <span className={`text-2xl font-bold ${
              type === 'income' ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ COMPOSANT PRINCIPAL CategoryBreakdown
export default function CategoryBreakdown({ 
  transactions = [], 
  type = 'expense',
  onTransactionClick  // ✅ Nouveau prop
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const breakdown = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const filteredTransactions = transactions.filter(t => t.type === type);
    const byCategory = {};

    filteredTransactions.forEach(t => {
      const cat = t.category || 'Non catégorisé';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          total: 0,
          transactions: []
        };
      }
      byCategory[cat].total += parseFloat(t.amount) || 0;
      byCategory[cat].transactions.push(t);
    });

    return Object.entries(byCategory)
      .map(([category, data]) => ({ 
        category, 
        total: data.total,
        transactions: data.transactions
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, type]);

  const total = breakdown.reduce((sum, c) => sum + c.total, 0);

  if (breakdown.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          Répartition par catégorie
        </h3>
        <div className="text-center text-gray-500 py-8">
          Aucune {type === 'expense' ? 'dépense' : 'revenu'} à afficher.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Header fixe */}
        <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Transaction par catégorie
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {breakdown.length} {breakdown.length > 1 ? 'catégories' : 'catégorie'} • {formatCurrency(total)}
              </p>
            </div>
            
            <div className={`p-3 rounded-xl ${
              type === 'income' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {type === 'income' ? (
                <TrendingUp className={`w-6 h-6 ${type === 'income' ? 'text-green-600' : 'text-red-600'}`} />
              ) : (
                <TrendingDown className={`w-6 h-6 text-red-600`} />
              )}
            </div>
          </div>
        </div>

        {/* Conteneur avec scroll indépendant */}
        <div className="overflow-y-auto max-h-96 p-6 pt-4">
          <div className="space-y-3">
            {breakdown.map(item => {
              const percentage = total > 0 ? ((item.total / total) * 100).toFixed(1) : 0;
              
              return (
                <button
                  key={item.category}
                  onClick={() => setSelectedCategory(item)}
                  className="w-full bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-all cursor-pointer text-left hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{categoryIcons[item.category] || '📦'}</span>
                      <span className="font-medium text-gray-800">{item.category}</span>
                      <span className="text-xs text-gray-500">
                        ({item.transactions.length} trx)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`font-bold ${type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(item.total)}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {percentage}%
                      </span>
                    </div>
                  </div>
                  {/* Barre de progression */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer fixe */}
        <div className="border-t border-gray-100 p-6 pt-4 bg-gray-50">
          <div className="flex justify-between items-center font-bold">
            <span className="text-gray-800">Total des {type === 'expense' ? 'dépenses' : 'revenus'}</span>
            <span className={`text-xl ${type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Modal des transactions */}
      {selectedCategory && (
        <CategoryTransactionsModal
          category={selectedCategory.category}
          transactions={selectedCategory.transactions}
          type={type}
          onClose={() => setSelectedCategory(null)}
          onTransactionClick={onTransactionClick}
        />
      )}
    </>
  );
}
