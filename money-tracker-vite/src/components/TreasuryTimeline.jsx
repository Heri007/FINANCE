// src/components/TreasuryTimeline.jsx
import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Calendar,
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
  const pageSize = 2;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  /* =========================
     0. Solde initial sécurisé
     ========================= */
  const balance =
    typeof currentCashBalance === 'string'
      ? Number(currentCashBalance)
      : currentCashBalance;

  console.log('💰 DEBUG TreasuryTimeline props:', {
    currentCashBalance,
    balance,
    startDate,
    endDate,
  });

  /* =========================
     1. Cash flow journalier
     ========================= */
  const cashFlowData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ CORRECTION : Le solde du compte est DÉJÀ le solde réel actuel
    const realBalanceToday = balance || 0;

    console.log('💰 Solde Coffre actuel (depuis compte):', realBalanceToday);
    console.log('📅 Date du jour:', today.toLocaleDateString());
    console.log('📅 startDate:', new Date(startDate).toLocaleDateString());

    // ✅ DEBUG : Vérifier les transactions prévisionnelles
    const futureTransactions = transactions.filter((tx) => {
      const txDate = new Date(tx.transaction_date || tx.date);
      txDate.setHours(0, 0, 0, 0);
      return (
        !tx.is_posted && txDate > today && (tx.account_name || tx.account) === 'Coffre'
      );
    });

    const futurePlanned = plannedTransactions.filter((tx) => {
      const txDate = new Date(tx.plannedDate || tx.transaction_date || tx.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate > today && (tx.account_name || tx.account) === 'Coffre';
    });

    console.log('🔮 DEBUG Timeline:', {
      aujourdhui: today.toLocaleDateString(),
      startDate: new Date(startDate).toLocaleDateString(),
      endDate: new Date(endDate).toLocaleDateString(),
      soldeCoffreActuel: realBalanceToday,
      transactionsNonPosteesFutures: futureTransactions.length,
      plannedTransactionsFutures: futurePlanned.length,
    });

    let current = new Date(startDate);
    const end = new Date(endDate);

    // ✅ CORRECTION : Partir du solde réel actuel
    let runningCoffreReal = realBalanceToday;
    let runningCoffreProjected = realBalanceToday;

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const currentDate = new Date(current);
      currentDate.setHours(0, 0, 0, 0);

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

      // --- Transactions RÉELLES POSTÉES (FUTURES seulement) ---
      // ✅ Ne traiter QUE les transactions futures qui seront postées
      transactions.forEach((tx) => {
        const txDate = new Date(tx.transaction_date || tx.date);
        txDate.setHours(0, 0, 0, 0);

        if (txDate.getTime() !== currentDate.getTime()) return;
        if (currentDate <= today && tx.is_posted) return; // ✅ Ignorer passé déjà dans le solde
        if (!tx.is_posted) return; // ✅ Seulement transactions postées

        const amount = Number(tx.amount) || 0;
        const isIncome = String(tx.type).toLowerCase() === 'income';
        const account = tx.account_name || tx.accountName || tx.account || '';
        const isCoffre = account === 'Coffre';

        if (!isCoffre) return;

        const projectId = tx.project_id || tx.projectId || tx.projectid || null;
        const projectName =
          projects.find((p) => String(p.id) === String(projectId))?.name ||
          tx.project_name ||
          tx.projectName ||
          null;

        if (isIncome) {
          day.revenues += amount;
          day.coffreIn += amount;
        } else {
          day.expenses += amount;
          day.coffreOut += amount;
        }

        day.projectReal.push({
          project_id: projectId,
          project_name: projectName,
          type: isIncome ? 'income' : 'expense',
          amount,
          label: tx.description || '',
          account,
          isCoffre,
        });
      });

      // --- Transactions PRÉVISIONNELLES (futures uniquement) ---
      console.log('🔍 DEBUG plannedTransactions:', {
        total: plannedTransactions.length,
        currentDateStr: currentDate.toLocaleDateString(),
        todayStr: today.toLocaleDateString(),
        sample: plannedTransactions.slice(0, 3).map((tx) => {
          const txDate = new Date(tx.plannedDate || tx.transaction_date || tx.date);
          txDate.setHours(0, 0, 0, 0);
          return {
            date: txDate.toLocaleDateString(),
            type: tx.type,
            amount: tx.amount,
            account: tx.account_name || tx.accountName || tx.account,
            isToday: txDate.getTime() === today.getTime(),
            isCurrentDate: txDate.getTime() === currentDate.getTime(),
          };
        }),
      });

      // ========================================
      // --- Transactions PRÉVISIONNELLES (futures uniquement) ---
      // ========================================

      console.log('DEBUG plannedTransactions:', {
        total: plannedTransactions.length,
        currentDateStr: currentDate.toLocaleDateString(),
        todayStr: today.toLocaleDateString(),
        sample: plannedTransactions.slice(0, 3).map((tx) => ({
          date: tx.date,
          type: tx.type,
          amount: tx.amount,
          account: tx.accountname || tx.accountName || tx.account,
          projectname: tx.projectname,
        })),
      });

      plannedTransactions.forEach((tx, index) => {
        // ✅ SIMPLIFICATION: date normalisée au format YYYY-MM-DD
        const txDateStr = tx.date;

        if (!txDateStr) {
          if (index < 3)
            console.log('⚠️ Transaction prév. sans date (index', index, '):', tx);
          return;
        }

        // ✅ Comparaison directe des strings YYYY-MM-DD
        if (txDateStr !== dateStr) return;

        // LOG détaillé seulement pour les 3 premières OU le jour actuel
        const isToday = currentDate.getTime() === today.getTime();
        if (index < 3 || isToday) {
          console.log('Transaction prév. (index', index, '):', {
            dateRaw: txDateStr,
            currentDate: currentDate.toLocaleDateString(),
            today: today.toLocaleDateString(),
            account: tx.accountname || tx.accountName || tx.account,
            amount: tx.amount,
            type: tx.type,
          });
        }

        // ✅ CORRECTION: Ignorer SEULEMENT si currentDate est strictement dans le passé
        if (currentDate < today) {
          if (index < 3)
            console.log(
              'Rejet date passée (index',
              index,
              '):',
              currentDate.toLocaleDateString(),
              '<',
              today.toLocaleDateString()
            );
          return;
        }

        const amount = Number(tx.amount || 0);
        const isIncome = String(tx.type).toLowerCase().includes('income');
        const account = tx.accountname || tx.accountName || tx.account;
        const isCoffre = account === 'Coffre';

        // LOG si pas Coffre
        if (!isCoffre) {
          if (index < 3)
            console.log(
              'Rejet pas Coffre (index',
              index,
              '):',
              account,
              'expected: Coffre'
            );
          return;
        }

        const projectId = tx.projectid || tx.projectId || null;
        const projectName =
          projects.find((p) => String(p.id) === String(projectId))?.name ||
          tx.projectname ||
          null;

        // LOG transaction acceptée
        if (index < 3 || isToday) {
          console.log('✅ Transaction prév. ACCEPTÉE (index', index, '):', {
            date: txDateStr,
            type: isIncome ? 'income' : 'expense',
            amount,
            account,
            project: projectName,
          });
        }

        if (isIncome) {
          day.plannedRevenues += amount;
          day.coffrePlannedIn += amount;
        } else {
          day.plannedExpenses += amount;
          day.coffrePlannedOut += amount;
        }

        day.projectPlanned.push({
          projectid: projectId,
          projectname: projectName,
          type: isIncome ? 'income' : 'expense',
          amount,
          description: tx.description || tx.label || '', // ✅ AJOUT
          category: tx.category || '', // ✅ BONUS
        });
      });

      const netRealCoffre = (day.coffreIn || 0) - (day.coffreOut || 0);
      const netPlannedCoffre = (day.coffrePlannedIn || 0) - (day.coffrePlannedOut || 0);

      // ✅ Soldes cumulatifs (uniquement pour les dates futures)
      if (currentDate > today) {
        runningCoffreReal += netRealCoffre;
        runningCoffreProjected += netRealCoffre + netPlannedCoffre;
      }

      day.coffreBalance = runningCoffreReal;
      day.coffreProjectedBalance = runningCoffreProjected;

      days.push(day);
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [transactions, plannedTransactions, projects, startDate, endDate, balance]);

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
      avgBalance: balances.reduce((a, b) => a + b, 0) / balances.length,
      negativeDays: balances.filter((b) => b < 0).length,
      totalInflows: cashFlowData.reduce((s, d) => s + (d.revenues || 0), 0),
      totalOutflows: cashFlowData.reduce((s, d) => s + (d.expenses || 0), 0),
    };
  }, [cashFlowData, balance]);

  const criticalDays = useMemo(
    () =>
      cashFlowData.filter(
        (d) => d.coffreBalance < 0 || d.coffreBalance < (balance || 0) * 0.2
      ),
    [cashFlowData, balance]
  );

  if (!startDate || !endDate) return null;

  const maxIndex = Math.max(0, cashFlowData.length - pageSize);
  const visibleDays = cashFlowData.slice(currentIndex, currentIndex + pageSize);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - pageSize));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + pageSize));
  };

  /* =========================
     3. RENDER (Updated Style)
     ========================= */
  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5 max-h-[650px] overflow-hidden flex flex-col font-sans">
      {/*Header Section */}
      <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </span>
            Timeline Coffre & Prévisions
          </h3>
          <p className="text-slate-500 text-xs mt-1 ml-11">
            Suivi journalier des flux réels et prévisionnels
          </p>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Solde Coffre actuel
          </div>
          <div className="text-xl font-bold text-blue-600">
            {Number(currentCashBalance || 0).toLocaleString()} Ar
          </div>
          <div className="text-slate-400 text-[10px] mt-0.5 bg-slate-50 px-2 py-0.5 rounded-full inline-block">
            Min historique:{' '}
            <span className="font-medium text-slate-600">
              {stats.minBalance.toLocaleString()} Ar
            </span>
          </div>
        </div>
      </div>

      {/* Barre de contrôle: pagination + date */}
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 disabled:opacity-40 transition-all flex items-center gap-1"
          >
            ← <span className="hidden sm:inline">Précédent</span>
          </button>
          <span className="px-2 text-slate-400 font-medium border-l border-r border-slate-200">
            {cashFlowData.length > 0 &&
              `${currentIndex + 1}-${Math.min(
                currentIndex + pageSize,
                cashFlowData.length
              )} / ${cashFlowData.length}`}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex >= maxIndex}
            className="px-3 py-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 disabled:opacity-40 transition-all flex items-center gap-1"
          >
            <span className="hidden sm:inline">Suivant</span> →
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span className="text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
            </span>
            <span className="font-medium">
              {selectedDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 z-20 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
              <DatePicker
                inline
                selected={selectedDate}
                onChange={(date) => {
                  if (!date) return;
                  setSelectedDate(date);
                  setIsDatePickerOpen(false);
                  const dateStr = date.toISOString().split('T')[0];
                  const idx = cashFlowData.findIndex((d) => d.date === dateStr);
                  if (idx !== -1) {
                    const newIndex = Math.floor(idx / pageSize) * pageSize;
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
        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3">
          <div className="p-1.5 bg-rose-100 rounded-full text-rose-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-rose-700 text-xs">Alerte Trésorerie</div>
            <div className="text-rose-600 text-[11px]">
              {stats.negativeDays} jour(s) avec solde négatif détecté(s)
            </div>
          </div>
        </div>
      )}

      {/* Cards Container - Scrollable si l'écran est petit, mais ici on gère le scroll interne */}
      <div className="flex-grow overflow-y-auto pr-1 pb-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleDays.map((day) => {
            const netPlanned = (day.plannedRevenues || 0) - (day.plannedExpenses || 0);
            const netReal = (day.revenues || 0) - (day.expenses || 0);
            const highlight =
              netPlanned !== 0 || netReal !== 0 ? 'bg-slate-50/50' : 'bg-white';
            const isNegative = (day.coffreProjectedBalance || 0) < 0;

            const dateLabel = new Date(day.date).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: '2-digit',
              month: 'short',
            });

            return (
              <div
                key={day.date}
                className={`group border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all h-[270px] flex flex-col ${highlight}`}
              >
                {/* --- Card Header: Date & Solde --- */}
                <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 capitalize text-lg">
                      {dateLabel}
                    </span>
                    <span className="text-[10px] text-red-400 font-medium">
                      Fin de journée
                    </span>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold leading-none ${isNegative ? 'text-rose-600' : 'text-slate-800'}`}
                    >
                      {(day.coffreProjectedBalance || 0).toLocaleString()}
                      <span className="text-[18px] font-normal text-blue-800">Ar</span>
                    </div>
                    {/* ✅ Afficher aussi le solde réel si différent */}
                    {day.coffreBalance !== day.coffreProjectedBalance && (
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Réel: {day.coffreBalance.toLocaleString()} Ar
                      </div>
                    )}
                  </div>
                </div>

                {/* --- Card Body: Flux (Grid compacte) --- */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  {/* Prévisions */}
                  <div className="bg-blue-50/50 rounded p-1.5 border border-blue-100/50">
                    <div className="text-[11px] uppercase font-bold text-blue-700 mb-0.5">
                      Prévisions
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Entrées:</span>
                      <span className="font-medium">
                        {(day.plannedRevenues || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Sorties:</span>
                      <span className="font-medium">
                        {(day.plannedExpenses || 0).toLocaleString()}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 pt-0.5 border-t border-blue-100 text-right font-bold ${netPlanned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {netPlanned > 0 ? '+' : ''}
                      {netPlanned.toLocaleString()}
                    </div>
                  </div>

                  {/* Réalisé */}
                  <div className="bg-emerald-50/30 rounded p-1.5 border border-emerald-100/50">
                    <div className="text-[11px] uppercase font-bold text-emerald-700 mb-0.5">
                      Réalisé(s)
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Entrées:</span>
                      <span className="font-medium">
                        {(day.revenues || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Sorties:</span>
                      <span className="font-medium">
                        {(day.expenses || 0).toLocaleString()}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 pt-0.5 border-t border-emerald-100 text-right font-bold ${netReal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {netReal > 0 ? '+' : ''}
                      {netReal.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* --- Card Footer: Projets (Scrollable) --- */}
                <div className="flex-grow overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-1">
                  {day.projectPlanned.length > 0 || day.projectReal.length > 0 ? (
                    <div className="space-y-2">
                      {/* Projets Prévus */}
                      {day.projectPlanned.length > 0 && (
                        <div>
                          <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1 border-b border-blue-50 py-0.5">
                            Projets (Prévu)
                          </div>
                          {day.projectPlanned.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-start text-[10px] py-1 group/item gap-2 hover:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                            >
                              <div className="flex flex-col max-w-[70%] flex-1 gap-0.5">
                                <span
                                  className="text-slate-700 truncate font-semibold leading-tight text-[11px]"
                                  title={p.projectname || `Projet #${p.projectid}`}
                                >
                                  {p.projectname || `Projet #${p.projectid}`}
                                </span>
                                {p.description && (
                                  <span
                                    className="text-[9px] text-slate-600 truncate leading-tight"
                                    title={p.description}
                                  >
                                    📄 {p.description}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[11px] font-bold whitespace-nowrap ${p.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                              >
                                {p.type === 'income' ? '+' : '-'}
                                {p.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Projets Réalisés */}
                      {day.projectReal.length > 0 && (
                        <div>
                          <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 text-[9px] font-bold text-emerald-600 uppercase tracking-wide mb-1 border-b border-emerald-50 py-0.5 mt-1">
                            Projets (Réel)
                          </div>
                          {day.projectReal.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-start text-[10px] py-1 group/item gap-2 hover:bg-emerald-50 rounded px-1 -mx-1 transition-colors"
                            >
                              <div className="flex flex-col max-w-[70%] flex-1 gap-0.5">
                                <span
                                  className="text-slate-700 truncate font-medium leading-tight"
                                  title={p.label || 'Sans libellé'}
                                >
                                  {p.label || 'Sans libellé'}
                                </span>
                                <span
                                  className="text-[8px] text-slate-400 truncate leading-tight"
                                  title={p.project_name || 'Hors projet'}
                                >
                                  {p.project_name || 'Hors projet'}
                                </span>
                              </div>
                              <span
                                className={`font-medium text-[11px] ${p.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
                              >
                                {p.type === 'income' ? '+' : '-'}
                                {p.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-300 text-[10px] italic">
                      Aucune activité projet
                    </div>
                  )}
                </div>
                {/* ✅ FIN de Card Footer */}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer: Résumé global */}
      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 bg-white rounded-full shadow-sm text-emerald-600">
              <TrendingUp size={12} />
            </div>
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wide">
              Entrées Réelles
            </span>
          </div>
          <div className="text-lg font-bold text-emerald-700">
            +{(stats.totalInflows || 0).toLocaleString()} Ar
          </div>
        </div>

        <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 bg-white rounded-full shadow-sm text-rose-600">
              <TrendingDown size={12} />
            </div>
            <span className="text-[10px] uppercase font-bold text-rose-800 tracking-wide">
              Sorties Réelles
            </span>
          </div>
          <div className="text-lg font-bold text-rose-700">
            -{(stats.totalOutflows || 0).toLocaleString()} Ar
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1 bg-white rounded-full shadow-sm text-blue-600">
              <DollarSign size={12} />
            </div>
            <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wide">
              Variation Nette
            </span>
          </div>
          <div
            className={`text-lg font-bold ${(stats.totalInflows || 0) - (stats.totalOutflows || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {((stats.totalInflows || 0) - (stats.totalOutflows || 0)).toLocaleString()} Ar
          </div>
        </div>
      </div>
    </div>
  );
}
