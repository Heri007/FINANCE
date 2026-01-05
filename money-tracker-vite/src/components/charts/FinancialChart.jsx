// src/components/charts/FinancialChart.jsx
import React, { useMemo } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

const FinancialChart = ({ transactions = [] }) => {
  const chartData = useMemo(() => {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return [];
    }

    const grouped = {};
    transactions.forEach((t) => {
      const date = t.date?.split('T')[0] || t.transaction_date?.split('T')[0];
      if (!date) return;

      if (!grouped[date]) {
        grouped[date] = { date, income: 0, expense: 0, net: 0 };
      }

      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        grouped[date].income += amount;
      } else {
        grouped[date].expense += amount;
      }
      grouped[date].net = grouped[date].income - grouped[date].expense;
    });

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-30);
  }, [transactions]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="bg-slate-100 p-6 rounded-xl border-2 border-slate-300">
          <p className="text-slate-600 font-semibold text-center mb-2">
            📊 Aucune transaction à afficher
          </p>
          <p className="text-slate-500 text-sm text-center">
            Les données apparaîtront ici une fois les transactions enregistrées
          </p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border-2 border-slate-300 rounded-xl p-4 shadow-xl">
          <p className="font-bold text-slate-900 mb-2 text-sm">
            📅{' '}
            {new Date(label).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-emerald-700">↗️ Revenus:</span>
              <span className="text-sm font-black text-emerald-900">
                {parseFloat(payload[0]?.value || 0).toLocaleString('fr-FR')} Ar
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-rose-700">↘️ Dépenses:</span>
              <span className="text-sm font-black text-rose-900">
                {parseFloat(payload[1]?.value || 0).toLocaleString('fr-FR')} Ar
              </span>
            </div>
            <div className="pt-2 mt-2 border-t-2 border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-slate-700">💰 Net:</span>
                <span
                  className={`text-sm font-black ${
                    payload[0]?.value - payload[1]?.value >= 0
                      ? 'text-emerald-900'
                      : 'text-rose-900'
                  }`}
                >
                  {(payload[0]?.value - payload[1]?.value || 0).toLocaleString('fr-FR')}{' '}
                  Ar
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />

        {/* ✅ AXES SANS PROPRIÉTÉS PROBLÉMATIQUES */}
        <XAxis
          dataKey="date"
          stroke="#cbd5e1"
          tick={{ fill: '#64748b' }}
          tickFormatter={(date) => {
            const d = new Date(date);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
        />
        <YAxis
          stroke="#cbd5e1"
          tick={{ fill: '#64748b' }}
          tickFormatter={(value) => {
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
            return value;
          }}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend wrapperStyle={{ paddingTop: '15px' }} iconType="line" iconSize={16} />

        {/* ✅ LIGNES SIMPLES SANS GRADIENTS */}
        <Line
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: '#10b981', strokeWidth: 2, stroke: '#fff', r: 5 }}
          activeDot={{ r: 7, fill: '#059669', stroke: '#fff', strokeWidth: 3 }}
          name="💰 Revenus"
        />

        <Line
          type="monotone"
          dataKey="expense"
          stroke="#f43f5e"
          strokeWidth={3}
          dot={{ fill: '#f43f5e', strokeWidth: 2, stroke: '#fff', r: 5 }}
          activeDot={{ r: 7, fill: '#e11d48', stroke: '#fff', strokeWidth: 3 }}
          name="💸 Dépenses"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default FinancialChart;
