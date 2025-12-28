// FICHIER: src/components/layout/Navigation.jsx

import React from "react";
import { Calendar } from "lucide-react";

export function Navigation({ activeTab, onTabChange, onOpenGanttTimeline, isGanttOpen }) {
  const tabs = [
    { id: "overview", label: "Vue d'ensemble" },
    { id: "transactions", label: "Transactions" },
    { id: "receivables", label: "Receivables" },
  ];

  return (
    <nav className="px-8 pt-4 border-b border-gray-200 bg-white/60 backdrop-blur">
      <ul className="flex gap-4 items-center">
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
                    : "text-gray-600 hover:bg-indigo-200"
                ].join(" ")}
              >
                {tab.label}
              </button>
            </li>
          );
        })}

        {/* Bouton Gantt Timeline */}
        <li>
          <button
            type="button"
            onClick={() => {
              console.log('🖱️ CLIC sur bouton Gantt Timeline');
              if (onOpenGanttTimeline) {
                onOpenGanttTimeline();
              }
              console.log('✅ Gantt Timeline ouvert');
            }}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md",
              isGanttOpen
                ? "bg-purple-600 text-white shadow-lg"
                : "bg-purple-500 text-white hover:bg-purple-600"
            ].join(" ")}
          >
            <Calendar size={18} />
            Gantt Timeline
          </button>
        </li>
      </ul>
    </nav>
  );
}
