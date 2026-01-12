// FICHIER: src/components/layout/Navigation.jsx

import React from 'react';
import { Activity } from 'lucide-react'; // ← OBLIGATOIRE

export function Navigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'transactions', label: 'Transactions' },
    { id: 'receivables', label: 'Receivables' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
  ];

  return (
    <nav className="px-8 pt-4 border-b border-gray-200 bg-white/60 backdrop-blur">
      <ul className="flex gap-4 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={[
                  'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
                  isActive
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-600 hover:bg-indigo-200',
                ].join(' ')}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
