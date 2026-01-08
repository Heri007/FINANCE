// src/components/transactions/CategoryBreakdown.jsx
import React, { useMemo, useState } from 'react';
import { X, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { categoryIcons } from '../../utils/constants';

// ✅ COMPOSANT MODAL POUR AFFICHER LES TRANSACTIONS D'UNE CATÉGORIE
const CategoryTransactionsModal = ({
  category,
  transactions,
  type,
  onClose,
  onTransactionClick,
}) => {
  if (!transactions || transactions.length === 0) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col border-2 border-slate-300">
        {/* Header */}
        <div
          className={`p-6 border-b-2 border-slate-200 bg-gradient-to-r ${
            type === 'income'
              ? 'from-emerald-100 to-teal-100'
              : 'from-rose-100 to-pink-100'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`
                w-16 h-16 
                rounded-2xl 
                flex items-center justify-center 
                text-3xl
                border-2
                ${
                  type === 'income'
                    ? 'bg-gradient-to-br from-emerald-100 to-teal-100 border-emerald-300'
                    : 'bg-gradient-to-br from-rose-100 to-pink-100 border-rose-300'
                }
              `}
              >
                {categoryIcons[category] || '📦'}
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900">{category}</h2>
                <p className="text-sm text-slate-600 mt-1 font-semibold">
                  {transactions.length} transaction{transactions.length > 1 ? 's' : ''} •{' '}
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="
                p-2.5 
                hover:bg-slate-100 
                rounded-lg 
                transition-all
                border-2 border-transparent
                hover:border-slate-300
              "
            >
              <X className="w-6 h-6 text-slate-600" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Liste des transactions scrollable */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => {
                  onClose();
                  if (onTransactionClick) onTransactionClick(tx);
                }}
                className="
                  flex justify-between items-center 
                  p-4 
                  hover:bg-slate-50 
                  rounded-xl 
                  cursor-pointer 
                  transition-all duration-200
                  border-2 border-transparent
                  hover:border-slate-200 
                  hover:shadow-md
                  group
                "
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {tx.description || tx.category}
                  </p>
                  <p className="text-sm text-slate-600 truncate font-semibold">
                    {formatDate(tx.transactiondate || tx.date || tx.transaction_date)}
                  </p>
                </div>

                <div className="text-right ml-4 flex-shrink-0">
                  <div className="flex items-center justify-end gap-2">
                    {type === 'income' ? (
                      <ArrowUpRight
                        className="text-emerald-600"
                        size={18}
                        strokeWidth={3}
                      />
                    ) : (
                      <ArrowDownRight
                        className="text-rose-600"
                        size={18}
                        strokeWidth={3}
                      />
                    )}
                    <p
                      className={`
                      font-black text-lg tracking-tight
                      ${type === 'income' ? 'text-emerald-700' : 'text-rose-700'}
                    `}
                    >
                      {type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                  {!tx.is_posted && !tx.isposted && (
                    <span
                      className="
                      inline-flex items-center gap-1
                      text-xs font-bold 
                      text-amber-700 
                      bg-amber-100 
                      border border-amber-300
                      px-2 py-0.5 
                      rounded-md 
                      mt-1
                    "
                    >
                      ⚠ Non validé
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-slate-200 p-6 bg-slate-50">
          <div className="flex justify-between items-center">
            <span className="text-slate-700 font-bold text-base">Total</span>
            <span
              className={`
              text-3xl font-black tracking-tight
              ${type === 'income' ? 'text-emerald-700' : 'text-rose-700'}
            `}
            >
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
  onTransactionClick,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const breakdown = useMemo(() => {
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const filteredTransactions = transactions.filter((t) => t.type === type);
    const byCategory = {};

    filteredTransactions.forEach((t) => {
      const cat = t.category || 'Non catégorisé';
      if (!byCategory[cat]) {
        byCategory[cat] = {
          total: 0,
          transactions: [],
        };
      }
      byCategory[cat].total += parseFloat(t.amount) || 0;
      byCategory[cat].transactions.push(t);
    });

    return Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        total: data.total,
        transactions: data.transactions,
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, type]);

  const total = breakdown.reduce((sum, c) => sum + c.total, 0);

  if (breakdown.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-2 border-slate-200 p-8">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          📊 Répartition par catégorie
        </h3>
        <div className="flex flex-col items-center justify-center py-8">
          <div
            className="
            bg-slate-100 
            w-20 h-20 
            rounded-full 
            flex items-center justify-center 
            mb-4
            border-2 border-slate-300
          "
          >
            <span className="text-4xl">📭</span>
          </div>
          <p className="text-slate-600 font-semibold">
            Aucune {type === 'expense' ? 'dépense' : 'revenu'} à afficher
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
        {/* Header fixe */}
        <div
          className={`
          p-6 pb-4 
          border-b-2 border-slate-200 
          bg-gradient-to-r 
          ${type === 'income' ? 'from-emerald-50 to-teal-50' : 'from-rose-50 to-pink-50'}
        `}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                📊 Transaction par catégorie
              </h3>
              <p className="text-sm text-slate-600 mt-1 font-semibold">
                {breakdown.length} {breakdown.length > 1 ? 'catégories' : 'catégorie'} •{' '}
                {formatCurrency(total)}
              </p>
            </div>

            <div
              className={`
              p-3 rounded-xl border-2
              ${
                type === 'income'
                  ? 'bg-emerald-100 border-emerald-300'
                  : 'bg-rose-100 border-rose-300'
              }
            `}
            >
              {type === 'income' ? (
                <TrendingUp className="w-6 h-6 text-emerald-700" strokeWidth={2.5} />
              ) : (
                <TrendingDown className="w-6 h-6 text-rose-700" strokeWidth={2.5} />
              )}
            </div>
          </div>
        </div>

        {/* Conteneur avec scroll indépendant */}
        <div className="overflow-y-auto max-h-96 p-6 pt-4 custom-scrollbar">
          <div className="space-y-3">
            {breakdown.map((item) => {
              const percentage = total > 0 ? ((item.total / total) * 100).toFixed(1) : 0;

              return (
                <button
                  key={item.category}
                  onClick={() => setSelectedCategory(item)}
                  className="
                    w-full 
                    bg-slate-50 
                    rounded-xl 
                    p-4 
                    hover:bg-slate-100 
                    transition-all duration-200
                    cursor-pointer 
                    text-left 
                    hover:shadow-md
                    border-2 border-transparent
                    hover:border-slate-200
                    group
                  "
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="
                        text-2xl 
                        group-hover:scale-110 
                        transition-transform duration-200
                      "
                      >
                        {categoryIcons[item.category] || '📦'}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 text-base">
                          {item.category}
                        </span>
                        <span
                          className="
                          text-xs 
                          text-slate-600 
                          ml-2 
                          bg-slate-200 
                          px-2 py-0.5 
                          rounded-md
                          font-semibold
                        "
                        >
                          {item.transactions.length} trx
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`
                          font-black text-lg tracking-tight
                          ${type === 'income' ? 'text-emerald-700' : 'text-rose-700'}
                        `}
                        >
                          {formatCurrency(item.total)}
                        </span>
                        <span
                          className="
                          text-sm 
                          font-bold 
                          text-slate-500
                          bg-slate-200
                          px-2 py-0.5
                          rounded-md
                        "
                        >
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression */}
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300">
                    <div
                      className={`
                        h-full 
                        transition-all duration-500 
                        ${
                          type === 'income'
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-gradient-to-r from-rose-500 to-pink-500'
                        }
                      `}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer fixe */}
        <div
          className="border-t-2 border-slate-200 p-6 pt-4 bg-gradient-to-r 
          from-rose-50 to-pink-50"
        >
          <div className="flex justify-between items-center">
            <span className="text-slate-800 font-bold text-base">
              Total des {type === 'expense' ? 'dépenses' : 'revenus'}
            </span>
            <span
              className={`
              text-2xl font-black tracking-tight
              ${type === 'income' ? 'text-emerald-700' : 'text-rose-700'}
            `}
            >
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
