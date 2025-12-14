// ProjectDetailsModal.jsx - VERSION AVEC SÉPARATION PAYÉ / RESTE À FAIRE
import React, { useMemo, useState } from 'react';
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
  ShoppingBag,
  CheckCircle,
  Clock
} from 'lucide-react';
import { formatCurrency, formatDate } from './utils/formatters';
import { TransactionDetailsModal } from './TransactionDetailsModal';


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

  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [showUnpaidDetails, setShowUnpaidDetails] = useState(false);
  const [showRealTransactions, setShowRealTransactions] = useState(false);
  const [transactionType, setTransactionType] = useState('expense'); // 'expense' ou 'income'

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

  // --- 2. SÉPARATION PAYÉ / NON PAYÉ ---
  const { 
    paidExpenses, 
    unpaidExpenses, 
    paidRevenues, 
    unpaidRevenues,
    totalPaidExpenses,
    totalUnpaidExpenses,
    totalPaidRevenues,
    totalUnpaidRevenues,
    paymentProgressExpenses,
    paymentProgressRevenues
  } = useMemo(() => {
    const paidExp = expenses.filter(e => e.isPaid === true);
    const unpaidExp = expenses.filter(e => !e.isPaid);
    const paidRev = revenues.filter(r => r.isPaid === true);
    const unpaidRev = revenues.filter(r => !r.isPaid);
    
    const totalPaid = paidExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalUnpaid = unpaidExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalPaidRev = paidRev.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const totalUnpaidRev = unpaidRev.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    
    const total = totalPaid + totalUnpaid;
    const totalRev = totalPaidRev + totalUnpaidRev;
    
    return {
      paidExpenses: paidExp,
      unpaidExpenses: unpaidExp,
      paidRevenues: paidRev,
      unpaidRevenues: unpaidRev,
      totalPaidExpenses: totalPaid,
      totalUnpaidExpenses: totalUnpaid,
      totalPaidRevenues: totalPaidRev,
      totalUnpaidRevenues: totalUnpaidRev,
      paymentProgressExpenses: total > 0 ? (totalPaid / total * 100).toFixed(1) : 0,
      paymentProgressRevenues: totalRev > 0 ? (totalPaidRev / totalRev * 100).toFixed(1) : 0
    };
  }, [expenses, revenues]);

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

  // --- 4. TRANSACTIONS RÉELLES LIÉES AU PROJET ---
  const projectTransactions = (transactions || []).filter(
    t => t.project_id === project.id
  );

  const realExpenses = projectTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const realRevenues = projectTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const realProfit = realRevenues - realExpenses;
  const realRoi = realExpenses > 0 ? (realProfit / realExpenses) * 100 : 0;

  // --- 5. MÉTRIQUES DB + SOLDE FINAL ---
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

  // --- 6. DATES & STATUT ---
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
    text += `💎 Profit prévu: ${formatCurrency(netProfit)} (ROI: ${roi.toFixed(1)}%)\n`;
    text += `\n--- État d'avancement ---\n`;
    text += `✅ Dépenses payées: ${formatCurrency(totalPaidExpenses)} (${paymentProgressExpenses}%)\n`;
    text += `⏳ Dépenses restantes: ${formatCurrency(totalUnpaidExpenses)}\n`;
    text += `💸 Dépenses réelles (transactions): ${formatCurrency(realExpenses)}\n`;
    text += `💰 Revenus réels: ${formatCurrency(realRevenues)}\n`;
    text += `💼 Solde total comptes: ${formatCurrency(safeTotalBalance)}\n`;
    text += `💼 Solde total si projet fini: ${formatCurrency(finalTotalIfCompleted)}`;
    navigator.clipboard.writeText(text).then(() => alert('Copié !'));
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
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
            {/* KPI HEADER */}
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
                </div>
                <TrendingUp className="absolute -right-8 -bottom-8 w-24 h-24 text-red-100 opacity-50" />
              </div>

              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="text-sm text-green-600 mb-1 font-medium">
                  Revenus prévus
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(totalRevenues)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="text-sm text-indigo-600 mb-1 font-medium">
                  Profit prévu
                </div>
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </div>
                <div className="text-xs text-indigo-500 mt-1">
                  ROI: {roi.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* ✅ NOUVELLE SECTION : ÉTAT D'AVANCEMENT DÉPENSES */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border-2 border-slate-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                État d'avancement - Dépenses
              </h3>

                            {/* Barre de progression */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 mb-2">
                  <span>✅ Payé: {formatCurrency(totalPaidExpenses)}</span>
                  <span className="font-bold">{paymentProgressExpenses}%</span>
                  <span>⏳ Reste: {formatCurrency(totalUnpaidExpenses)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${paymentProgressExpenses}%` }}
                  />
                </div>
              </div>

              {/* Deux colonnes : Payé vs À régler */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Colonne 1 : PAYÉ */}
                <div className="bg-white rounded-lg border-2 border-emerald-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-emerald-800">Dépenses Payées</h4>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">
                      {paidExpenses.length} lignes
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-emerald-700 mb-3">
                    {formatCurrency(totalPaidExpenses)}
                  </div>

                  {paidExpenses.length > 0 ? (
                    <>
                      <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                        {paidExpenses.slice(0, 5).map((exp, i) => (
                          <div key={i} className="flex justify-between items-center text-xs bg-emerald-50 p-2 rounded">
                            <span className="truncate flex-1 text-gray-700">
                              {exp.description || exp.category}
                            </span>
                            <span className="font-mono font-semibold text-emerald-800 ml-2">
                              {formatCurrency(exp.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {paidExpenses.length > 5 && (
                        <button
                          onClick={() => setShowPaidDetails(true)}
                          className="w-full text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                        >
                          Voir tout ({paidExpenses.length} lignes)
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucune dépense payée</p>
                  )}
                </div>

                {/* Colonne 2 : À RÉGLER */}
                <div className="bg-white rounded-lg border-2 border-orange-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      <h4 className="font-bold text-orange-800">Reste à Régler</h4>
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                      {unpaidExpenses.length} lignes
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-orange-700 mb-3">
                    {formatCurrency(totalUnpaidExpenses)}
                  </div>

                  {unpaidExpenses.length > 0 ? (
                    <>
                      <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                        {unpaidExpenses.slice(0, 5).map((exp, i) => (
                          <div key={i} className="flex justify-between items-center text-xs bg-orange-50 p-2 rounded">
                            <span className="truncate flex-1 text-gray-700">
                              {exp.description || exp.category}
                            </span>
                            <span className="font-mono font-semibold text-orange-800 ml-2">
                              {formatCurrency(exp.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {unpaidExpenses.length > 5 && (
                        <button
                          onClick={() => setShowUnpaidDetails(true)}
                          className="w-full text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline"
                        >
                          Voir tout ({unpaidExpenses.length} lignes)
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Toutes les dépenses sont payées ✅</p>
                  )}
                </div>
              </div>
            </div>

            {/* ✅ SECTION REVENUS (AJOUTÉE) */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-emerald-200 p-5 mt-4">
              <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                État d'avancement - Revenus
              </h3>

              {/* Barre de progression Revenus */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 mb-2">
                  <span>✅ Encaissé: {formatCurrency(totalPaidRevenues)}</span>
                  <span className="font-bold">{paymentProgressRevenues}%</span>
                  <span>⏳ Reste: {formatCurrency(totalUnpaidRevenues)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-green-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${paymentProgressRevenues}%` }}
                  />
                </div>
              </div>

              {/* Deux colonnes : Encaissé vs À Recevoir */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Colonne 1 : ENCAISSÉ */}
                <div className="bg-white rounded-lg border-2 border-green-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h4 className="font-bold text-green-800">Revenus Encaissés</h4>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                      {paidRevenues.length} lignes
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-green-700 mb-3">
                    {formatCurrency(totalPaidRevenues)}
                  </div>

                  {paidRevenues.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {paidRevenues.map((rev, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-green-50 p-2 rounded">
                          <span className="truncate flex-1 text-gray-700">{rev.description}</span>
                          <span className="font-mono font-semibold text-green-800 ml-2">
                            {formatCurrency(rev.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Aucun revenu encaissé</p>
                  )}
                </div>

                {/* Colonne 2 : À RECEVOIR */}
                <div className="bg-white rounded-lg border-2 border-blue-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-800">À Recevoir</h4>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                      {unpaidRevenues.length} lignes
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-blue-700 mb-3">
                    {formatCurrency(totalUnpaidRevenues)}
                  </div>

                  {unpaidRevenues.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {unpaidRevenues.map((rev, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-blue-50 p-2 rounded">
                          <span className="truncate flex-1 text-gray-700">{rev.description}</span>
                          <span className="font-mono font-semibold text-blue-800 ml-2">
                            {formatCurrency(rev.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Tout a été encaissé ! 💰</p>
                  )}
                </div>
              </div>
            </div>

            {/* TRANSACTIONS RÉELLES (de la BD) */}
            <div className="bg-blue-50 rounded-xl border-2 border-blue-200 p-5">
              <h3 className="text-sm font-bold text-blue-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Transactions Réelles Validées (Base de données)
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setTransactionType('expense');
                    setShowRealTransactions(true);
                  }}
                  className="bg-white rounded-lg border border-red-200 p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="text-xs text-red-600 mb-1 font-medium">Dépenses réelles</div>
                  <div className="text-xl font-bold text-red-700">
                    {formatCurrency(realExpenses)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {projectTransactions.filter(t => t.type === 'expense').length} transactions
                  </div>
                </button>

                <button
                  onClick={() => {
                    setTransactionType('income');
                    setShowRealTransactions(true);
                  }}
                  className="bg-white rounded-lg border border-green-200 p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="text-xs text-green-600 mb-1 font-medium">Recettes réelles</div>
                  <div className="text-xl font-bold text-green-700">
                    {formatCurrency(realRevenues)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {projectTransactions.filter(t => t.type === 'income').length} transactions
                  </div>
                </button>
              </div>

              <div className="mt-4 bg-white rounded-lg p-3 border border-blue-100">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Profit réel:</span>
                    <span className={`ml-2 font-bold ${realProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {realProfit >= 0 ? '+' : ''}{formatCurrency(realProfit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">ROI réel:</span>
                    <span className={`ml-2 font-bold ${realRoi >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {realExpenses > 0 ? `${realRoi.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MÉTRIQUES COMPARATIVES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white border border-gray-200">
                <div className="text-sm text-gray-600 mb-1 font-medium">
                  Comparaison Budget vs Réel
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs text-gray-400 uppercase">Budget prévu</div>
                    <div className="text-lg font-bold text-gray-800">
                      {formatCurrency(totalCost)}
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
                  Métriques Base de Données
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Coût prévu (DB):</span>
                    <strong>{formatCurrency(project.total_cost || project.totalCost)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenus prévus (DB):</span>
                    <strong>{formatCurrency(project.total_revenues || project.totalRevenues)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit net prévu (DB):</span>
                    <strong>{formatCurrency(netProfitDb)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>ROI estimé (DB):</span>
                    {dbRoi != null ? (
                      <strong className="text-indigo-600">
                        {dbRoi.toFixed(1)}%
                      </strong>
                    ) : (
                      <span>–</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SOLDES */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Solde total comptes:</span>
                  <div className="text-xl font-bold text-indigo-700">
                    {formatCurrency(safeTotalBalance)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Solde si projet fini:</span>
                  <div className="text-xl font-bold text-purple-700">
                    {formatCurrency(finalTotalIfCompleted)}
                  </div>
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

      {/* MODALS DÉTAILLÉS */}
      {/* Modal : Détail des dépenses PAYÉES */}
      {showPaidDetails && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-emerald-50 border-b border-emerald-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Dépenses Payées
                </h3>
                <p className="text-sm text-emerald-600 mt-1">
                  {paidExpenses.length} lignes • {formatCurrency(totalPaidExpenses)}
                </p>
              </div>
              <button
                onClick={() => setShowPaidDetails(false)}
                className="p-2 hover:bg-emerald-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-emerald-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {paidExpenses.map((exp, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {exp.description || exp.category}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      {exp.category && (
                        <span className="bg-white px-2 py-0.5 rounded">{exp.category}</span>
                      )}
                      {exp.account && (
                        <span className="text-emerald-600">Compte: {exp.account}</span>
                      )}
                      {exp.date && (
                        <span>{new Date(exp.date).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-emerald-700 ml-4">
                    {formatCurrency(exp.amount)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t bg-gray-50 p-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total payé: <span className="font-bold text-emerald-700 text-lg ml-2">{formatCurrency(totalPaidExpenses)}</span>
              </div>
              <button
                onClick={() => setShowPaidDetails(false)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Détail des dépenses NON PAYÉES (À régler) */}
      {showUnpaidDetails && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-orange-50 border-b border-orange-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-orange-800 flex items-center gap-2">
                  <Clock className="w-6 h-6" />
                  Dépenses à Régler
                </h3>
                <p className="text-sm text-orange-600 mt-1">
                  {unpaidExpenses.length} lignes • {formatCurrency(totalUnpaidExpenses)}
                </p>
              </div>
              <button
                onClick={() => setShowUnpaidDetails(false)}
                className="p-2 hover:bg-orange-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-orange-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {unpaidExpenses.map((exp, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {exp.description || exp.category}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      {exp.category && (
                        <span className="bg-white px-2 py-0.5 rounded">{exp.category}</span>
                      )}
                      {exp.account && (
                        <span className="text-orange-600">Compte prévu: {exp.account}</span>
                      )}
                      {exp.date && (
                        <span>{new Date(exp.date).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xl font-bold text-orange-700 ml-4">
                    {formatCurrency(exp.amount)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t bg-gray-50 p-4 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total à régler: <span className="font-bold text-orange-700 text-lg ml-2">{formatCurrency(totalUnpaidExpenses)}</span>
              </div>
              <button
                onClick={() => setShowUnpaidDetails(false)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Transactions réelles (avec TransactionDetailsModal) */}
      {showRealTransactions && (
        <TransactionDetailsModal
          type={transactionType}
          transactions={projectTransactions}
          onClose={() => setShowRealTransactions(false)}
        />
      )}
    </>
  );
}

