// FICHIER: src/components/layout/Navigation.jsx

import React from "react";

export function Navigation({ activeTab, onTabChange }) {
  const tabs = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "transactions", label: "Transactions" },
    { id: "receivables", label: "Avoirs" },         // ✅ nouvel onglet
  ];

  return (
    <nav className="px-8 pt-4 border-b border-gray-200 bg-white/60 backdrop-blur">
      <ul className="flex gap-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={[
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  isActive
                    ? "bg-indigo-600 text-white shadow"
                    : "text-gray-600 hover:bg-gray-100"
                ].join(" ")}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
