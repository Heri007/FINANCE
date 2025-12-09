// FICHIER: src/components/common/StatCard.jsx
import React from 'react';

export const StatCard = ({ title, value, icon, trend, color = 'blue' }) => {
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
  };

  const bgColors = {
    blue: 'bg-blue-50',
    green: 'bg-green-50',
    red: 'bg-red-50',
    purple: 'bg-purple-50',
    amber: 'bg-amber-50',
  };

  const iconColors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600',
  };

  return (
    <div className={`${bgColors[color] || bgColors.blue} rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
        <div className={`${iconColors[color] || iconColors.blue}`}>
          {icon}
        </div>
      </div>
      
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-gray-900">
          {value}
        </div>
        {trend && (
          <div className={`text-lg font-bold ${trendColors[trend]}`}>
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
    </div>
  );
};
