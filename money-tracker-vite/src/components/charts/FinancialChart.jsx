// src/components/charts/FinancialChart.jsx
import React, { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

const FinancialChart = ({ transactions = [] }) => {
  console.log('🔵 FinancialChart chargé !', new Date().toISOString());
  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    // Grouper par date
    const grouped = {};
    transactions.forEach(t => {
      const date = t.date?.split('T')[0] || t.transaction_date?.split('T')[0];
      if (!date) return;

      if (!grouped[date]) {
        grouped[date] = { date, income: 0, expense: 0 };
      }

      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        grouped[date].income += amount;
      } else {
        grouped[date].expense += amount;
      }
    });

    // Trier par date et prendre les 30 derniers jours
    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30);
  }, [transactions]);

  // Afficher un message si pas de données
  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        Aucune transaction à afficher
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="date" 
          tick={{ fill: '#6b7280', fontSize: '12px' }}  // ✅ CORRIGÉ
          tickFormatter={(date) => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
        />
        <YAxis 
          tick={{ fill: '#6b7280', fontSize: '12px' }}  // ✅ CORRIGÉ
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
          formatter={(value) => `${parseFloat(value).toLocaleString('fr-FR')} Ar`}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '10px' }}
          iconType="line"
        />
        <Line 
          type="monotone" 
          dataKey="income" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Revenus"
        />
        <Line 
          type="monotone" 
          dataKey="expense" 
          stroke="#ef4444" 
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 4 }}
          activeDot={{ r: 6 }}
          name="Dépenses"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default FinancialChart;
