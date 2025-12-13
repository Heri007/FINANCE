import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function FinancialChart({ transactions }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Forcer un re-render après le montage complet
    const timer = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const processData = () => {
    const last30Days = new Array(30).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split("T")[0];
    });

    const dataMap = last30Days.reduce((acc, date) => {
      acc[date] = { date, income: 0, expense: 0 };
      return acc;
    }, {});

    transactions.forEach((t) => {
      const dateKey = typeof t.date === "string" ? t.date.substring(0, 10) : "";
      if (!dataMap[dateKey]) return;

      const amount = parseFloat(t.amount) || 0;
      if (t.type === "income") dataMap[dateKey].income += amount;
      else if (t.type === "expense") dataMap[dateKey].expense += amount;
    });

    return Object.values(dataMap).map((item) => ({
      ...item,
      shortDate: new Date(item.date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
    }));
  };

  // Ne pas traiter les données tant que non monté
  if (!mounted) {
    return (
      <div className="w-full h-80 flex items-center justify-center bg-slate-50 rounded-lg">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const data = processData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-semibold text-slate-700 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {Number(entry.value).toLocaleString("fr-FR")} Ar
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="shortDate" 
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
          />
          <YAxis 
            tick={{ fontSize: 11, fill: "#64748b" }}
            stroke="#cbd5e1"
            tickFormatter={(value) => 
              value >= 1000000 
                ? `${(value / 1000000).toFixed(1)}M` 
                : value >= 1000 
                ? `${(value / 1000).toFixed(0)}K` 
                : value
            }
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
          />

          <Area
            type="monotone"
            dataKey="income"
            name="Encaissements"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#incomeColor)"
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Dépenses"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#expenseColor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
