// src/components/accounts/AccountDetails.jsx
import React from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { categoryIcons } from '../../utils/constants';

export function AccountDetails({ account, transactions, onClose, onSelectTransaction }) {
  // Filtrer les transactions de ce compte
  const accountTransactions = transactions
    .filter(t => (t.account_id || t.accountId) === account.id)
    .sort((a, b) => new Date(b.transaction_date || b.date) - new Date(a.transaction_date || a.date));

  // Calculer les statistiques
  const stats = accountTransactions.reduce((acc, t) => {
    if (t.type === 'income') {
      acc.income += parseFloat(t.amount);
    } else {
      acc.expense += parseFloat(t.amount);
    }
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{account.name}</h2>
              <p className="text-3xl font-bold mt-2">
                {formatCurrency(account.balance)}
              </p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Statistiques */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/20 rounded-xl p-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-300" />
                <span className="text-sm">Revenus</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.income)}</p>
            </div>
            <div className="bg-white/20 rounded-xl p-3">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-5 h-5 text-rose-300" />
                <span className="text-sm">Dépenses</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(stats.expense)}</p>
            </div>
          </div>
        </div>

        {/* Liste des transactions */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <h3 className="font-semibold text-gray-800 mb-4">
            Transactions ({accountTransactions.length})
          </h3>
          
          {accountTransactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucune transaction pour ce compte.
            </p>
          ) : (
            <div className="space-y-2">
              {accountTransactions.map(t => (
                <div
                  key={t.id}
                  onClick={() => onSelectTransaction?.(t)}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">
                      {categoryIcons[t.category] || '📝'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{t.description}</p>
                      <p className="text-sm text-gray-500">
                        {t.category} • {formatDate(t.transaction_date || t.date)}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountDetails;
