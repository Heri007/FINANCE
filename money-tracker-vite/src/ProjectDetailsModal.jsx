// ProjectDetailsModal.jsx - VERSION PHASES + RÉELS
import React, { useMemo } from 'react';
import { 
  X, 
  Copy, 
  AlertCircle, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  PieChart,
  Anchor,
  Truck,
  ShoppingBag
} from 'lucide-react';
import { formatCurrency, formatDate } from './utils/formatters';

export function ProjectDetailsModal({
  project,
  isOpen,
  onClose,
  onActivateProject,
  onCompleteProject,
  accounts,
  transactions,
  totalBalance
}) {

  if (!isOpen || !project) return null;

  // --- 1. PARSING ULTRA-ROBUSTE JSON ---
  const parseJSONSafe = (data, fieldName) => {
    console.log(`🔍 RAW ${fieldName}:`, data, 'type:', typeof data);
    
    if (!data || data === null || data === undefined || data === 'null') {
      console.warn(`⚠️ ${fieldName} NULL → []`);
      return [];
    }
    
    try {
      if (typeof data === 'string') {
        if (data.trim() === '[]' || data.trim() === '') return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      if (typeof data === 'object') {
        if (Array.isArray(data)) return data;
        return [data];
      }
      
      return [];
    } catch (e) {
      console.error(`❌ Parse ${fieldName} FAILED:`, e, data);
      return [];
    }
  };

  const expenses = useMemo(
    () => parseJSONSafe(project.expenses, 'expenses'),
    [project.expenses]
  );
  const revenues = useMemo(
    () => parseJSONSafe(project.revenues, 'revenues'),
    [project.revenues]
  );

  // --- 2. DEBUG LOGS ---
  console.log('🔍 DEBUG PROJECT:', {
    name: project.name,
    expensesCount: expenses.length,
    firstExpense: expenses[0],
    sampleExpenses: expenses.slice(0, 3).map(e => ({
      desc: e.description,
      phase: e.phase,
      account: e.account
    })),
    totalCostDB: project.total_cost,
    phasesPresent: [...new Set(expenses.map(e => e.phase).filter(Boolean))]
  });

  // --- 3. CALCULS TOTAUX PRÉVISIONNELS ---
  const occurrences = parseInt(
    project.occurrences_count || project.occurrencesCount || 1
  );
  const isRecurrent = project.type === 'recurrent';

  const calculatedTotalCost = expenses.reduce((sum, item) => {
    const amount = parseFloat(item.amount || 0);
    const multiplier = isRecurrent && item.isRecurring ? occurrences : 1;
    return sum + amount * multiplier;
  }, 0);

  const calculatedTotalRev = revenues.reduce((sum, item) => {
    const amount = parseFloat(item.amount || 0);
    const multiplier = isRecurrent && item.isRecurring ? occurrences : 1;
    return sum + amount * multiplier;
  }, 0);

  const totalCost =
    calculatedTotalCost > 0
      ? calculatedTotalCost
      : parseFloat(project.total_cost || project.totalCost || 0);
  const totalRevenues =
    calculatedTotalRev > 0
      ? calculatedTotalRev
      : parseFloat(project.total_revenues || project.totalRevenues || 0);
  const netProfit = totalRevenues - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  // --- 5. TRANSACTIONS RÉELLES LIÉES AU PROJET ---
  const projectTransactions = (transactions || []).filter(
    t => t.project_id === project.id
  );

  console.log(
    '🔎 PROJECT TX',
    project.id,
    projectTransactions.map(t => ({
      id: t.id,
      category: t.category,
      amount: t.amount,
      project_id: t.project_id
    }))
  );

  const realExpenses = projectTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const realRevenues = projectTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const realProfit = realRevenues - realExpenses;
  const realRoi = realExpenses > 0 ? (realProfit / realExpenses) * 100 : 0;

  // --- 8. MÉTRIQUES DB + SOLDE FINAL ---
const rawNetProfitDb = project.net_profit ?? project.netProfit ?? 0;
const netProfitDb = Number(rawNetProfitDb) || 0;

const dbRoi =
  project.roi != null
    ? Number(project.roi)
    : project.roi_value != null
    ? Number(project.roi_value)
    : null;

const safeTotalBalance = Number(totalBalance) || 0;

const finalTotalIfCompleted = safeTotalBalance + netProfitDb;


  // --- 6. GROUPPING PHASES INTELLIGENT ---
  const phaseIcons = {
    investissement: <Anchor className="w-4 h-4" />,
    logistique: <Truck className="w-4 h-4" />,
    ventes: <ShoppingBag className="w-4 h-4" />
  };

  const phaseLabels = {
    investissement: '💰 Investissement',
    logistique: '🚚 Logistique',
    ventes: '📈 Ventes'
  };

  const statusLabels = {
    payé: { label: '✓ Payé', color: 'emerald' },
    futur: { label: '⏳ Futur', color: 'blue' },
    planifié: { label: '📋 Planifié', color: 'orange' }
  };

  const expensesByPhaseStatus = expenses.reduce((acc, exp) => {
    const phase = exp.phase || 'investissement';
    const status =
      exp.account === 'Déjà Payé'
        ? 'payé'
        : exp.account === 'Futur'
        ? 'futur'
        : 'planifié';
    const key = `${phase}-${status}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(exp);
    return acc;
  }, {});

  const phaseOrder = [
    'investissement-payé',
    'investissement-planifié',
    'logistique-futur',
    'logistique-payé',
    'ventes-futur',
    'ventes-payé'
  ];

  // --- 7. DATES & STATUT ---
  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;

  const formatDateSafe = dateStr => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : formatDate(dateStr);
  };

  const dateDisplay = formatDateSafe(endDate)
    ? `${formatDateSafe(startDate)} → ${formatDateSafe(endDate)}`
    : `Depuis ${formatDateSafe(startDate)}`;

  const getStatusLabel = status => {
    const labels = {
      active: 'En cours',
      completed: 'Terminé',
      draft: 'Brouillon',
      'Phase logistique Activée': 'Logistique OK',
      'Phase ventes Activée': 'Ventes OK'
    };
    return labels[status] || status || 'Brouillon';
  };


const handleCopyToClipboard = () => {
  let text = `📋 ${project.name}\n`;
  text += `💰 Coût prévu: ${formatCurrency(totalCost)}\n`;
  text += `📈 Revenus prévus: ${formatCurrency(totalRevenues)}\n`;
  text += `💎 Profit prévu: ${formatCurrency(
    netProfit
  )} (ROI: ${roi.toFixed(1)}%)\n`;
  text += `💸 Dépenses réelles: ${formatCurrency(realExpenses)}\n`;
  text += `💰 Revenus réels: ${formatCurrency(realRevenues)}\n`;
  text += `📊 Phases: ${Object.keys(expensesByPhaseStatus).length}\n`;
  text += `💼 Solde total comptes: ${formatCurrency(safeTotalBalance)}\n`;
  text += `💼 Solde total si projet fini: ${formatCurrency(finalTotalIfCompleted)}`;
  navigator.clipboard.writeText(text).then(() => alert('Copié !'));
};


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-start bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              {project.name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  isRecurrent
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {isRecurrent ? `Récurrent (${project.frequency})` : 'Ponctuel'}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  project.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : project.status === 'active'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {getStatusLabel(project.status)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-all"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* BUDGET / PAYÉ / EN COURS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200 relative overflow-hidden">
              <div className="relative z-10">
                <div className="text-sm text-red-600 mb-1 font-medium flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Budget prévu
                </div>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(totalCost)}
                </div>
                {expenses.length === 0 && totalCost === 0 && (
                  <p className="text-xs text-red-400 mt-1">
                    ⚠️ Aucune dépense
                  </p>
                )}
              </div>
              <TrendingUp className="absolute -right-8 -bottom-8 w-24 h-24 text-red-100 opacity-50" />
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-sm text-blue-600 mb-1 font-medium">
                Transactions réelles validées
              </div>
              <div className="text-xs text-gray-500">Dépenses en cours</div>
              <div className="text-lg font-bold text-blue-800">
                {formatCurrency(realExpenses)}
              </div>
              <div className="text-xs text-gray-500 mt-2">Recettes en cours</div>
              <div className="text-lg font-bold text-blue-800">
                {formatCurrency(realRevenues)}
              </div>
            </div>
          </div>

          {/* COÛT RÉEL / DÉTAIL PRÉVISIONNEL + SOLDE COMPTES */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white border border-gray-200">
              <div className="text-sm text-gray-600 mb-1 font-medium">
                Coût prévu vs réel (transactions)
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-400 uppercase">Prévu</div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatCurrency(totalCost)}
                  </div>
                  <div className="mt-3 text-xs text-gray-600 space-y-1">
                    <div>
                      Coût prévu (DB):{' '}
                      <strong>{formatCurrency(project.total_cost || project.totalCost)}</strong>
                    </div>
                    <div>
                      Revenus prévus (DB):{' '}
                      <strong>{formatCurrency(
                        project.total_revenues || project.totalRevenues
                      )}</strong>
                    </div>
                    <div>
                      Profit net prévu (DB): <strong>{formatCurrency(netProfitDb)}</strong>
                    </div>
                    <div>
  ROI estimé (DB):{' '}
  {dbRoi != null ? (
    <strong className="text-red-600">
      {dbRoi.toFixed(1)}%
    </strong>
  ) : (
    '–'
  )}
</div>
                    <div>
  Solde total comptes:{' '}
  <strong>{formatCurrency(safeTotalBalance)}</strong>
</div>
                    <div>
  Solde total si projet fini:{' '}
  <strong>{formatCurrency(finalTotalIfCompleted)}</strong>
</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase">
                    Dépensé (réel)
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      realExpenses > totalCost
                        ? 'text-red-600'
                        : 'text-emerald-600'
                    }`}
                  >
                    {formatCurrency(realExpenses)}
                  </div>
                  {totalCost > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {((realExpenses / totalCost) * 100).toFixed(1)}% du budget
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-gray-200">
              <div className="text-sm text-gray-600 mb-1 font-medium">
                Profit / ROI réels (transactions)
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-400 uppercase">
                    Profit réel
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      realProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {realProfit >= 0 ? '+' : ''}
                    {formatCurrency(realProfit)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase">
                    ROI réel
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      realRoi >= 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}
                  >
                    {realExpenses > 0 ? `${realRoi.toFixed(1)}%` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PROFIT & ROI PRÉVISIONNELS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-blue-50 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">Profit Net prévu</div>
              <div
                className={`text-xl font-bold ${
                  netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {netProfit >= 0 ? '+' : ''}
                {formatCurrency(netProfit)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-200">
              <div className="text-sm text-gray-600 mb-1">ROI estimé</div>
              <div
                className={`text-xl font-bold ${
                  roi >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}
              >
                {roi.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* INFO */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-4 rounded-xl text-sm space-y-2 border">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="font-medium text-gray-800">Période</div>
                <div className="text-gray-600">{dateDisplay}</div>
              </div>
            </div>
            {project.description && (
              <div className="flex items-start gap-2">
                <div className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0">
                  📝
                </div>
                <div>
                  <div className="font-medium text-gray-800">Description</div>
                  <div className="text-gray-600">{project.description}</div>
                </div>
              </div>
            )}
          </div>

          {/* PHASES / DÉPENSES */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Phases & Dépenses
              <span className="text-xs text-gray-500 font-normal ml-auto">
                {expenses.length} lignes
              </span>
            </h3>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {phaseOrder.map(phaseKey => {
                const phaseExpenses = expensesByPhaseStatus[phaseKey] || [];
                if (phaseExpenses.length === 0) return null;

                const [phase, status] = phaseKey.split('-');
                const phaseLabel =
                  phaseLabels[phase] ||
                  phase.charAt(0).toUpperCase() + phase.slice(1);
                const statusInfo = statusLabels[status];

                return (
                  <div
                    key={phaseKey}
                    className={`p-4 rounded-xl border ${
                      status === 'payé'
                        ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {phaseIcons[phase]}
                        <span className="font-semibold text-sm">
                          {phaseLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            status === 'payé'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="font-bold text-lg text-gray-900">
                        {formatCurrency(
                          phaseExpenses.reduce(
                            (sum, e) => sum + parseFloat(e.amount || 0),
                            0
                          )
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {phaseExpenses.map((exp, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-2 text-xs bg-white/60 rounded-lg hover:bg-white transition-all"
                        >
                          <span className="truncate font-medium text-gray-800">
                            {exp.description || exp.category}
                          </span>
                          <span className="font-mono text-sm font-bold text-gray-900">
                            {formatCurrency(exp.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {expenses.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Aucune dépense détaillée</p>
                  <p className="text-xs mt-1 opacity-75">
                    Vérifiez ProjectPlannerModal → PLG 3 Phases
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t bg-gradient-to-r from-gray-50 to-slate-50 rounded-b-2xl flex gap-3 justify-end items-center">
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl hover:shadow-sm hover:bg-gray-50 transition-all"
          >
            <Copy className="w-4 h-4" />
            Copier Résumé
          </button>

          {onActivateProject && project.status !== 'active' && (
            <button
              onClick={() => onActivateProject(project.id)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              🚀 Activer Projet
            </button>
          )}

          {onCompleteProject && project.status === 'active' && (
  <button
    onClick={() => onCompleteProject(project.id)}
    className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
  >
    ✅ Terminer
  </button>
  )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
