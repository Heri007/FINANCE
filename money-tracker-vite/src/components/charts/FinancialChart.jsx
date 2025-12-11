import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function FinancialChart({ transactions }) {
  // Préparation des données : Grouper par date (30 derniers jours)
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
      const dateKey =
        typeof t.date === "string" ? t.date.substring(0, 10) : "";
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

  const data = processData();

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="incomeColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenseColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="shortDate" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value) =>
              `${Number(value).toLocaleString("fr-FR")} Ar`
            }
            labelFormatter={(label) => `Date : ${label}`}
          />

          <Area
            type="monotone"
            dataKey="income"
            name="Encaissements"
            stroke="#16a34a"
            fill="url(#incomeColor)"
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Dépenses"
            stroke="#dc2626"
            fill="url(#expenseColor)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
