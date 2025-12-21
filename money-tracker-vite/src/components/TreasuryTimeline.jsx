// src/components/TreasuryTimeline.jsx
import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function TreasuryTimeline({
  projects = [],
  currentCashBalance = 0,
  startDate,
  endDate,
  transactions = [],
  plannedTransactions = [],
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const pageSize = 4;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  /* =========================
     0. Solde initial sécurisé
     ========================= */
  const balance =
    typeof currentCashBalance === 'string'
      ? Number(currentCashBalance)
      : currentCashBalance;

  /* =========================
     1. Cash flow journalier
     ========================= */
  const cashFlowData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const days = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    let runningCoffreReal = balance || 0;
    let runningCoffreProjected = balance || 0;

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];

      const day = {
        date: dateStr,
        revenues: 0,
        expenses: 0,
        plannedRevenues: 0,
        plannedExpenses: 0,
        coffreIn: 0,
        coffreOut: 0,
        coffrePlannedIn: 0,
        coffrePlannedOut: 0,
        coffreBalance: runningCoffreReal,
        coffreProjectedBalance: runningCoffreProjected,
        projectReal: [],
        projectPlanned: [],
      };

      // --- Transactions réelles ---
      transactions.forEach((tx) => {
        if (!tx?.date) return;
        const txDateStr = new Date(tx.date)
          .toISOString()
          .split('T')[0];
        if (txDateStr !== dateStr) return;

        const amount = Number(tx.amount) || 0;
        const isIncome =
          String(tx.type).toLowerCase() === 'income';

        const account =
          tx.account_name || tx.accountName || tx.account || '';
        const isCoffre = account === 'Coffre';

        const projectId =
          tx.project_id || tx.projectId || tx.projectid || null;
        const projectName =
          projects.find((p) => String(p.id) === String(projectId))
            ?.name ||
          tx.project_name ||
          tx.projectName ||
          null;

        if (isIncome) day.revenues += amount;
        else day.expenses += amount;

        if (isCoffre) {
          if (isIncome) day.coffreIn += amount;
          else day.coffreOut += amount;
        }

        if (projectId || isCoffre) {
          day.projectReal.push({
            project_id: projectId,
            project_name: projectName,
            type: isIncome ? 'income' : 'expense',
            amount,
            label:
              tx.label ||
              tx.description ||
              tx.note ||
              tx.name ||
              '',
            account,
            isCoffre,
          });
        }
      });

      // --- Transactions prévisionnelles (A PAYER / A RECEVOIR non payées) ---
      plannedTransactions.forEach((tx) => {
        if (!tx?.date) return;
        const txDateStr = new Date(tx.date)
          .toISOString()
          .split('T')[0];
        if (txDateStr !== dateStr) return;

        const amount = Number(tx.amount) || 0;
        const isIncome =
          String(tx.type).toLowerCase() === 'planned_income';

        const account =
          tx.account_name || tx.accountName || tx.account || '';
        const isCoffre = account === 'Coffre';

        const projectId =
          tx.project_id || tx.projectId || tx.projectid || null;
        const projectName =
          projects.find((p) => String(p.id) === String(projectId))
            ?.name ||
          tx.project_name ||
          tx.projectName ||
          null;

        if (isIncome) day.plannedRevenues += amount;
        else day.plannedExpenses += amount;

        if (isCoffre) {
          if (isIncome) day.coffrePlannedIn += amount;
          else day.coffrePlannedOut += amount;
        }

        if (projectId || isCoffre) {
          day.projectPlanned.push({
            project_id: projectId,
            project_name: projectName,
            type: isIncome ? 'income' : 'expense',
            amount,
          });
        }
      });

      const netRealCoffre =
        (day.coffreIn || 0) - (day.coffreOut || 0);
      const netPlannedCoffre =
        (day.coffrePlannedIn || 0) - (day.coffrePlannedOut || 0);

      // 1) solde Coffre RÉEL (running)
      runningCoffreReal += netRealCoffre;
      day.coffreBalance = runningCoffreReal;

      // 2) solde Coffre PRÉVISIONNEL CUMULÉ
      runningCoffreProjected += netRealCoffre + netPlannedCoffre;
      day.coffreProjectedBalance = runningCoffreProjected;

      days.push(day);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [
    transactions,
    plannedTransactions,
    projects,
    startDate,
    endDate,
    balance,
  ]);

  /* =========================
     2. Stats & alertes
     ========================= */
  const stats = useMemo(() => {
    if (cashFlowData.length === 0) {
      return {
        minBalance: balance || 0,
        maxBalance: balance || 0,
        avgBalance: balance || 0,
        negativeDays: 0,
        totalInflows: 0,
        totalOutflows: 0,
      };
    }

    const balances = cashFlowData.map((d) => d.coffreBalance || 0);

    return {
      minBalance: Math.min(...balances),
      maxBalance: Math.max(...balances),
      avgBalance:
        balances.reduce((a, b) => a + b, 0) / balances.length,
      negativeDays: balances.filter((b) => b < 0).length,
      totalInflows: cashFlowData.reduce(
        (s, d) => s + (d.revenues || 0),
        0
      ),
      totalOutflows: cashFlowData.reduce(
        (s, d) => s + (d.expenses || 0),
        0
      ),
    };
  }, [cashFlowData, balance]);

  const criticalDays = useMemo(
    () =>
      cashFlowData.filter(
        (d) =>
          d.coffreBalance < 0 ||
          d.coffreBalance < (balance || 0) * 0.2
      ),
    [cashFlowData, balance]
  );

  if (!startDate || !endDate) return null;

  const maxIndex = Math.max(0, cashFlowData.length - pageSize);
  const visibleDays = cashFlowData.slice(
    currentIndex,
    currentIndex + pageSize
  );

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - pageSize));
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      Math.min(maxIndex, prev + pageSize)
    );
  };

  /* =========================
     3. RENDER
     ========================= */
  return (
    <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4 max-h-[500px] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between mb-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <DollarSign className="w-5 h-5 text-blue-600" />
          Timeline Coffre & Prévisions
        </h3>

        <div className="text-xs text-right">
          <div className="text-gray-500">Solde Coffre actuel</div>
          <div className="font-bold text-blue-700">
            {(balance || 0).toLocaleString()} Ar
          </div>
          <div className="text-gray-500 text-[11px]">
            Min: {stats.minBalance.toLocaleString()} Ar
          </div>
        </div>
      </div>

      {/* Barre de contrôle: pagination + date */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            ← Précédent
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex >= maxIndex}
            className="px-2 py-1 border rounded disabled:opacity-40"
          >
            Suivant →
          </button>
          <span className="text-gray-500">
            {cashFlowData.length > 0 &&
              `${currentIndex + 1}-${Math.min(
                currentIndex + pageSize,
                cashFlowData.length
              )} / ${cashFlowData.length} jours`}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen((v) => !v)}
            className="px-2 py-1 border rounded bg-gray-50"
          >
            Aujourd&apos;hui:{' '}
            {selectedDate.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })}
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-1 z-10 bg-white border rounded shadow">
              <DatePicker
                inline
                selected={selectedDate}
                onChange={(date) => {
                  if (!date) return;
                  setSelectedDate(date);
                  setIsDatePickerOpen(false);

                  const dateStr = date
                    .toISOString()
                    .split('T')[0];
                  const idx = cashFlowData.findIndex(
                    (d) => d.date === dateStr
                  );
                  if (idx !== -1) {
                    const newIndex =
                      Math.floor(idx / pageSize) * pageSize;
                    setCurrentIndex(newIndex);
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Alertes */}
      {criticalDays.length > 0 && (
        <div className="mb-3 p-2 bg-red-50 border rounded text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <div>
            <div className="font-semibold text-red-800">
              Alerte Trésorerie
            </div>
            <div>{stats.negativeDays} jour(s) négatif(s)</div>
          </div>
        </div>
      )}

      {/* Cards: 4 jours visibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleDays.map((day) => {
          const netPlanned =
            (day.plannedRevenues || 0) -
            (day.plannedExpenses || 0);
          const netReal =
            (day.revenues || 0) - (day.expenses || 0);

          const highlight =
            netPlanned !== 0 || netReal !== 0
              ? 'bg-gray-50'
              : 'bg-white';

          const dateLabel = new Date(day.date).toLocaleDateString(
            'fr-FR',
            {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            }
          );

          return (
            <div
              key={day.date}
              className={`p-2 border rounded text-xs shadow-sm ${highlight}`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{dateLabel}</span>
                <div className="text-right text-[11px]">
                  <div className="text-gray-600">
                    Solde Coffre fin (réel):{' '}
                    {(day.coffreBalance || 0).toLocaleString()} Ar
                  </div>
                  <div className="text-gray-600">
                    Solde Coffre fin (prévu):{' '}
                    {(day.coffreProjectedBalance ||
                      0).toLocaleString()}{' '}
                    Ar
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-1">
                <div>
                  <div className="font-semibold text-blue-700 text-[11px]">
                    Flux prévus du jour
                  </div>
                  <div className="text-[11px]">
                    +{(day.plannedRevenues || 0).toLocaleString()} / -
                    {(day.plannedExpenses || 0).toLocaleString()} (
                    {netPlanned >= 0 ? '+' : ''}
                    {netPlanned.toLocaleString()})
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-emerald-700 text-[11px]">
                    Flux réalisés du jour
                  </div>
                  <div className="text-[11px]">
                    +{(day.revenues || 0).toLocaleString()} / -
                    {(day.expenses || 0).toLocaleString()} (
                    {netReal >= 0 ? '+' : ''}
                    {netReal.toLocaleString()})
                  </div>
                </div>
              </div>

              {(day.projectPlanned.length > 0 ||
                day.projectReal.length > 0) && (
                <div className="mt-1 border-t border-gray-100 pt-1">
                  {day.projectPlanned.length > 0 && (
                    <div className="mb-1">
                      <div className="text-[11px] font-semibold text-blue-600">
                        Projets – Prévisions
                      </div>
                      {day.projectPlanned.map((p, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] flex justify-between"
                        >
                          <span className="text-gray-600">
                            {p.project_name ||
                              `Projet #${p.project_id}`}{' '}
                            {p.type === 'income'
                              ? '→ revenu prévu'
                              : '→ charge prévue'}
                          </span>
                          <span
                            className={
                              p.type === 'income'
                                ? 'text-green-700'
                                : 'text-red-700'
                            }
                          >
                            {p.type === 'income' ? '+' : '-'}
                            {p.amount.toLocaleString()} Ar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {day.projectReal.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-emerald-600">
                        Projets – Réalisé
                      </div>
                      {day.projectReal.map((p, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] flex justify-between"
                        >
                          <div className="text-gray-600">
                            <div>{p.label || 'Sans libellé'}</div>
                            <div className="text-[10px] text-gray-500">
                              {p.project_name
                                ? `${p.project_name} `
                                : 'Hors projet '}
                              {p.type === 'income'
                                ? '→ revenu encaissé'
                                : '→ charge payée'}
                              {p.isCoffre && ' (Coffre)'}
                            </div>
                          </div>
                          <span
                            className={
                              p.type === 'income'
                                ? 'text-green-700'
                                : 'text-red-700'
                            }
                          >
                            {p.type === 'income' ? '+' : '-'}
                            {p.amount.toLocaleString()} Ar
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Résumé global */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div className="p-2 bg-green-50 rounded">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">
              Entrées réalisées
            </span>
          </div>
          <div className="text-lg font-bold text-green-700">
            +{(stats.totalInflows || 0).toLocaleString()} Ar
          </div>
        </div>
        <div className="p-2 bg-red-50 rounded">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <span className="font-medium text-red-800">
              Sorties réalisées
            </span>
          </div>
          <div className="text-lg font-bold text-red-700">
            -{(stats.totalOutflows || 0).toLocaleString()} Ar
          </div>
        </div>
        <div className="p-2 bg-blue-50 rounded">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">
              Variation nette réelle
            </span>
          </div>
          <div
            className={`text-lg font-bold ${
              (stats.totalInflows || 0) - (stats.totalOutflows || 0) >= 0
                ? 'text-green-700'
                : 'text-red-700'
            }`}
          >
            {(
              (stats.totalInflows || 0) -
              (stats.totalOutflows || 0)
            ).toLocaleString()}{' '}
            Ar
          </div>
        </div>
      </div>
    </div>
  );
}
