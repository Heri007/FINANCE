// src/components/transactions/CategoryBreakdown.jsx
import React, { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { categoryIcons } from '../../utils/constants';

export function CategoryBreakdown({ transactions, type = 'expense' }) {
  const breakdown = useMemo(() => {
    const filtered = transactions.filter(t => t.type === type);
    
    const byCategory = filtered.reduce((acc, t) => {
      const cat = t.category || 'Autres';
      if (!acc[cat]) {
        acc[cat] = { total: 0, count: 0 };
      }
      acc[cat].total += parseFloat(t.amount);
      acc[cat].count++;
      return acc;
    }, {});

    const total = Object.values(byCategory).reduce((sum, c) => sum + c.total, 0);

    return Object.entries(byCategory)
      .map(([category, data]) => ({
        category,
        ...data,
        percentage: total > 0 ? (data.total / total * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [transactions, type]);

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
      {breakdown.map(item => (
        <div key={item.category} className="bg-gray-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-xl">{categoryIcons[item.category] || '📝'}</span>
              <span className="font-medium text-gray-800">{item.category}</span>
              <span className="text-sm text-gray-500">({item.count})</span>
            </div>
            <div className="text-right">
              <span className={`font-bold ${
                type === 'income' ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {formatCurrency(item.total)}
              </span>
              <span className="text-sm text-gray-500 ml-2">
                ({item.percentage}%)
              </span>
            </div>
          </div>
          
          {/* Barre de progression */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
      
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

export default CategoryBreakdown;
