// src/components/transactions/CategoryBreakdown.jsx
import React, { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { categoryIcons } from '../../utils/constants';

export default function CategoryBreakdown({ transactions = [], type = 'expense' }) {
  // ✅ Ajout de type = 'expense' dans les props
  
  const breakdown = useMemo(() => {
    // Vérification de sécurité
    if (!transactions || !Array.isArray(transactions)) {
      return [];
    }

    const filteredTransactions = transactions.filter(t => t.type === type);
    const byCategory = {};

    filteredTransactions.forEach(t => {
      const cat = t.category || 'Non catégorisé';
      if (!byCategory[cat]) {
        byCategory[cat] = 0;
      }
      byCategory[cat] += parseFloat(t.amount) || 0;
    });

    return Object.entries(byCategory)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, type]); // ✅ Ajouter type dans les dépendances

  const total = breakdown.reduce((sum, c) => sum + c.total, 0);

  if (breakdown.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        Aucune {type === 'expense' ? 'dépense' : 'revenu'} à afficher.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {breakdown.map(item => {
        const percentage = total > 0 ? ((item.total / total) * 100).toFixed(1) : 0;
        
        return (
          <div key={item.category} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{categoryIcons[item.category]}</span>
                <span className="font-medium text-gray-800">{item.category}</span>
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
                className={`h-full ${type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Total */}
      <div className="border-t pt-3 mt-3">
        <div className="flex justify-between items-center font-bold">
          <span className="text-gray-800">Total</span>
          <span className={type === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
