// src/ProjectDetailsModal.jsx - VERSION CORRIGÉE (AFFICHAGE DONNÉES)

import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Calendar,
  DollarSign,
  PieChart,
  CheckCircle,
  Clock,
  ArrowRight,
  Briefcase,
  Link2,
  AlertCircle,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { formatCurrency, formatDate } from './utils/formatters';
import { API_BASE } from './services/api';
import { CopyButton } from './components/common/CopyButton';

export function ProjectDetailsModal({
  project,
  isOpen,
  onClose,
  onActivateProject,
  onCompleteProject,
  accounts,
  totalBalance,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  // États pour les modales de détails ("Voir tout")
  const [showPaidDetails, setShowPaidDetails] = useState(false);
  const [showUnpaidDetails, setShowUnpaidDetails] = useState(false);
  const [showReceivedDetails, setShowReceivedDetails] = useState(false);
  const [showPendingDetails, setShowPendingDetails] = useState(false);

  // États pour la Réconciliation
  const [unlinkedTransactions, setUnlinkedTransactions] = useState([]);
  const [linkingStats, setLinkingStats] = useState(null);
  const [selectedTxToLink, setSelectedTxToLink] = useState(null);
  const [loadingLink, setLoadingLink] = useState(false);

  // ✅ VERSION MINIMALISTE - 1 seule ligne propre
useEffect(() => {
  if (!project) return;
  console.log('📋', project.name);
}, [project]);

if (!isOpen || !project) return null;


  // =======================================================================
// 1. NORMALISATION DES DONNÉES (Le Cœur du Correctif)
// =======================================================================
const normalizeData = useMemo(() => {

  // Fonction pour parser et nettoyer n'importe quelle liste
const cleanList = (jsonOrArray, type) => {
  let list = [];

  if (Array.isArray(jsonOrArray)) {
    list = jsonOrArray;
  } else if (typeof jsonOrArray === 'string') {
    try {
      list = JSON.parse(jsonOrArray);
    } catch (e) {
      console.warn(`❌ Erreur parsing ${type}:`, e);
      list = [];
    }
  }

  return list
  .map((item) => {
    const isNormalizedLine = item.id && Number.isInteger(item.id);
    
    const accountIndicatesPaid = 
      item.account?.toLowerCase().includes('déjà') || 
      item.account?.toLowerCase().includes('deja') ||
      item.account?.toLowerCase().includes('payé') ||
      item.account?.toLowerCase().includes('paye');

    const isPaid = !!(
      item.isPaid || 
      item.ispaid || 
      item.is_paid ||
      item.isReceived || 
      item.isreceived ||
      item.is_received ||
      accountIndicatesPaid
    );

    const amount = parseFloat(
      item.amount ||
        item.projectedAmount ||
        item.projectedamount ||
        item.projected_amount ||
        item.actualAmount ||
        item.actualamount ||
        item.actual_amount ||
        item.montant ||
        0
    );

    // 🔥 FILTRER LES LIGNES À 0 AR
    if (amount === 0) {
      return null;
    }

    return {
      id: isNormalizedLine
        ? item.id
        : item.id || `temp-${Math.random().toString(36)}`,
      description: item.description || item.category || 'Sans description',
      category: item.category || 'Autre',
      amount: amount,
      isPaid: isPaid,
      date: item.date || item.transactionDate || item.transactiondate || item.transaction_date || new Date(),
      plannedDate: item.plannedDate || item.planned_date || null,
      realDate: item.realDate || item.real_date || item.transactionDate || item.transaction_date || null,
      account: item.account || 'Coffre',
      phase: item.phase,
      isRecurring: !!item.isRecurring,
      dbLineId: item.id && Number.isInteger(item.id) ? item.id : item.dbLineId || null,
    };
  })
  .filter(item => item !== null);  // 🔥 SUPPRIMER LES null
};

  // ✅ CORRECTION: Prioriser les données DB (is_paid) sur le JSON
let expenses = [];
if (project.expenses) {
  expenses = cleanList(project.expenses, 'expenses');
  
  // ✅ DEBUG : Vérifier détection "Déjà Payé"
  const dejaPaye = expenses.filter(e => 
    e.account?.toLowerCase().includes('déjà') || 
    e.account?.toLowerCase().includes('payé')
  );
}

  let revenues = [];
  // 1. Charger depuis JSON comme base
  if (project.expenses) {
    expenses = cleanList(project.expenses, 'expenses');
  }

  // 2. ✅ FUSIONNER avec expenseLines en PRIORITÉ pour isPaid depuis DB
if (project.expenseLines && project.expenseLines.length > 0) {
  const linesFromDB = cleanList(project.expenseLines, 'expenseLines');

  linesFromDB.forEach((dbLine) => {
    const normalizeDesc = (str) => 
      (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    const jsonIndex = expenses.findIndex((jsonExp) => {
      const descMatch = 
        normalizeDesc(jsonExp.description) === normalizeDesc(dbLine.description);
      
      const tolerance = Math.max(dbLine.amount * 0.01, 1);
      const amountMatch = Math.abs(jsonExp.amount - dbLine.amount) < tolerance;
      
      return descMatch && amountMatch;
    });

    if (jsonIndex >= 0) {
      // ✅ CORRECTION : GARDER le isPaid du JSON s'il est true
      const jsonIsPaid = expenses[jsonIndex].isPaid;
      const dbIsPaid = !!(dbLine.isPaid || dbLine.ispaid || dbLine.is_paid);
      
      expenses[jsonIndex] = {
        ...expenses[jsonIndex],
        id: dbLine.id,
        dbLineId: dbLine.id,
        actualAmount: dbLine.amount,
        // ✅ NE PAS ÉCRASER si déjà true (depuis "Déjà Payé")
        isPaid: jsonIsPaid || dbIsPaid,  // PRIORITÉ AU TRUE
        realDate: dbLine.realDate || dbLine.transaction_date || expenses[jsonIndex].realDate,
        account: dbLine.account || expenses[jsonIndex].account,
      };
    } else {
      console.warn(`⚠️ Ligne DB sans match JSON: ${dbLine.description} (${dbLine.amount})`);
      
      expenses.push({
        ...dbLine,
        dbLineId: dbLine.id,
        isPaid: !!(dbLine.isPaid || dbLine.ispaid || dbLine.is_paid),
      });
    }
  });
}
  // Même logique pour revenues
  if (project.revenues) {
    revenues = cleanList(project.revenues, 'revenues');
  }

  if (project.revenueLines && project.revenueLines.length > 0) {
  const linesFromDB = cleanList(project.revenueLines, 'revenueLines');

  linesFromDB.forEach((dbLine) => {
    const normalizeDesc = (str) => 
      (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    const jsonIndex = revenues.findIndex((jsonRev) => {
      const descMatch = 
        normalizeDesc(jsonRev.description) === normalizeDesc(dbLine.description);
      
      const tolerance = Math.max(dbLine.amount * 0.01, 1);
      const amountMatch = Math.abs(jsonRev.amount - dbLine.amount) < tolerance;
      
      return descMatch && amountMatch;
    });

    if (jsonIndex >= 0) {
      // ✅ CORRECTION : GARDER le isPaid du JSON s'il est true
      const jsonIsPaid = revenues[jsonIndex].isPaid;
      const dbIsPaid = !!(
        dbLine.isPaid || dbLine.ispaid || dbLine.is_paid || 
        dbLine.isReceived || dbLine.is_received
      );
      
      revenues[jsonIndex] = {
        ...revenues[jsonIndex],
        id: dbLine.id,
        dbLineId: dbLine.id,
        actualAmount: dbLine.amount,
        // ✅ NE PAS ÉCRASER si déjà true
        isPaid: jsonIsPaid || dbIsPaid,  // PRIORITÉ AU TRUE
        realDate: dbLine.realDate || dbLine.transaction_date || revenues[jsonIndex].realDate,
        account: dbLine.account || revenues[jsonIndex].account,
      };
    } else {
      console.warn(`⚠️ Ligne revenue DB sans match JSON: ${dbLine.description}`);
      revenues.push({
        ...dbLine,
        dbLineId: dbLine.id,
        isPaid: !!(
          dbLine.isPaid || dbLine.ispaid || dbLine.is_paid || 
          dbLine.isReceived || dbLine.is_received
        ),
      });
    }
  });
}

  return { expenses, revenues };
}, [project]);

  const { expenses, revenues } = normalizeData;

  // =======================================================================
  // 2. CALCULS FINANCIERS
  // =======================================================================

  // ✅ LIGNES 193-210 - REMPLACER PAR
const {
  paidExpenses,
  unpaidExpenses,
  totalPaidExpenses,
  totalUnpaidExpenses,
  progressExp,
} = useMemo(() => {
  // ✅ Filtre explicite : vérifier strictement isPaid === true
  const paid = expenses.filter((e) => e.isPaid === true);
  const unpaid = expenses.filter((e) => e.isPaid !== true);
  
  const totalP = paid.reduce((s, e) => s + e.amount, 0);
  const totalU = unpaid.reduce((s, e) => s + e.amount, 0);
  const total = totalP + totalU;

  return {
    paidExpenses: paid,
    unpaidExpenses: unpaid,
    totalPaidExpenses: totalP,
    totalUnpaidExpenses: totalU,
    progressExp: total > 0 ? ((totalP / total) * 100).toFixed(0) : 0,
  };
}, [expenses]);


 // ✅ LIGNE 223 - APPLIQUER LA MÊME CORRECTION
const { receivedRevenues, pendingRevenues, totalReceived, totalPending, progressRev } =
  useMemo(() => {
    // ✅ Filtre explicite
    const received = revenues.filter((r) => r.isPaid === true);
    const pending = revenues.filter((r) => r.isPaid !== true);
    
    const totalR = received.reduce((s, e) => s + e.amount, 0);
    const totalP = pending.reduce((s, e) => s + e.amount, 0);
    const total = totalR + totalP;

    return {
      receivedRevenues: received,
      pendingRevenues: pending,
      totalReceived: totalR,
      totalPending: totalP,
      progressRev: total > 0 ? ((totalR / total) * 100).toFixed(0) : 0,
    };
  }, [revenues]);


  // Totaux Globaux
  const totalBudget = totalPaidExpenses + totalUnpaidExpenses;
  const totalRevenuePrev = totalReceived + totalPending;
  const netProfit = totalRevenuePrev - totalBudget;
  const roi = totalBudget > 0 ? ((netProfit / totalBudget) * 100).toFixed(1) : 0;

  // Dates
  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;
  const dateDisplay = endDate
    ? `${formatDate(startDate)} → ${formatDate(endDate)}`
    : `Depuis ${formatDate(startDate)}`;

  const finalTotalIfCompleted = (parseFloat(totalBalance) || 0) + netProfit;

  // ✅ CALCULS SPÉCIFIQUES COFFRE
  const coffreAccount = accounts.find(
    (a) =>
      a.name.toLowerCase().trim() === 'coffre' || a.name.toLowerCase().includes('coffre')
  );
  const coffreBalance = parseFloat(coffreAccount?.balance || 0);
  const coffreProjected = coffreBalance + netProfit;

  // =======================================================================
  // 3. LOGIQUE LIAISON (LINKING)
  // =======================================================================

  useEffect(() => {
    if (activeTab === 'linking') {
      loadUnlinkedTransactions();
      loadLinkingStats();
    }
  }, [activeTab]);

  const loadUnlinkedTransactions = async () => {
    setLoadingLink(true);
    try {
      const res = await fetch(
        `${API_BASE}/transaction-linking/unlinked?projectId=${project.id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }
      );
      const data = await res.json();
      if (data.success) setUnlinkedTransactions(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLink(false);
    }
  };

  const loadLinkingStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/transaction-linking/stats/${project.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success) setLinkingStats(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLink = async (lineId) => {
    if (!selectedTxToLink) return alert("Sélectionnez une transaction à gauche d'abord");
    try {
      const res = await fetch(`${API_BASE}/transaction-linking/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ transactionId: selectedTxToLink.transaction_id, lineId }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Lié avec succès !');
        setSelectedTxToLink(null);
        loadUnlinkedTransactions();
        loadLinkingStats();
      } else {
        alert('Erreur: ' + data.error);
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  };


  const generateCopyText = () => {
    return `
📋 PROJET: ${project.name}
Type: ${project.type || 'N/A'}
Statut: ${project.status || 'actif'}

📅 DATES:
Début: ${project.startDate ? new Date(project.startDate).toLocaleDateString('fr-FR') : 'N/A'}
Fin: ${project.endDate ? new Date(project.endDate).toLocaleDateString('fr-FR') : 'Non définie'}

💰 RÉSUMÉ FINANCIER:
Budget total: ${formatCurrency(totalBudget)}
Revenus prévus: ${formatCurrency(totalRevenuePrev)}
Profit net: ${formatCurrency(netProfit)}
ROI: ${project.roi || 0}%

📊 DÉTAILS:
${
  project.metadata
    ? `
Métadonnées:
${Object.entries(
  typeof project.metadata === 'string' ? JSON.parse(project.metadata) : project.metadata
)
  .map(([key, value]) => `  ${key}: ${value}`)
  .join('\n')}
`
    : ''
}

💸 CHARGES (${project.expenses?.length || 0}):
${
  (project.expenses || [])
    .map(
      (exp) =>
        `- ${exp.description}: ${formatCurrency(exp.amount)} [${exp.category}]${exp.isPaid ? ' ✅ Payé' : ' ⏳ Non payé'}`
    )
    .join('\n') || 'Aucune charge'
}

💵 REVENUS (${project.revenues?.length || 0}):
${
  (project.revenues || [])
    .map(
      (rev) =>
        `- ${rev.description}: ${formatCurrency(rev.amount)} [${rev.category}]${rev.isPaid ? ' ✅ Reçu' : ' ⏳ Non reçu'}`
    )
    .join('\n') || 'Aucun revenu'
}

⏰ Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
  `.trim();
  };

  // =======================================================================
  // 4. RENDER
  // =======================================================================

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
          style={{ maxHeight: 'calc(100vh - 2rem)', minHeight: '500px' }}
        >
          {/* HEADER */}
          <div className="p-6 border-b flex justify-between items-start bg-gradient-to-r from-gray-50 to-slate-50 rounded-t-2xl">
            {' '}
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">{project.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 text-xs font-medium">
                  {project.type || 'PROJET'}
                </span>
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                  {project.status === 'active' ? 'En cours' : project.status}
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

          {/* TABS */}
          <div className="flex px-6 border-b border-gray-100 bg-white sticky top-0">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition ${activeTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('linking')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${activeTab === 'linking' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Link2 size={14} />
              Réconciliation
            </button>
          </div>

          {/* BODY CORRIGÉ : Structure flex à deux niveaux */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50/30">
              {/* --- VUE GÉNÉRALE --- */}
              {activeTab === 'overview' && (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                      <div className="text-sm text-red-600 mb-1 font-medium flex items-center gap-1">
                        <DollarSign className="w-4 h-4" /> Budget Prévu
                      </div>
                      <div className="text-2xl font-bold text-red-700">
                        {formatCurrency(totalBudget)}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                      <div className="text-sm text-green-600 mb-1 font-medium flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Revenus Prévus
                      </div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(totalRevenuePrev)}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                      <div className="text-sm text-indigo-600 mb-1 font-medium">
                        Profit Net
                      </div>
                      <div className="text-2xl font-bold text-indigo-700">
                        {formatCurrency(netProfit)}
                      </div>
                      <div className="text-xs text-indigo-500 mt-1">ROI: {roi}%</div>
                    </div>
                  </div>

                  {/* SOLDES & TRÉSORERIE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* VUE GLOBALE (Tous comptes) */}
                    <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
                      <div className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <Briefcase className="w-3 h-3" /> Patrimoine Global
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                          <span className="text-sm text-gray-600">Actuel</span>
                          <span className="font-bold text-gray-800">
                            {formatCurrency(parseFloat(totalBalance))}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-gray-600">Après Projet</span>
                          <span
                            className={`font-bold ${netProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}
                          >
                            {formatCurrency(finalTotalIfCompleted)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* VUE COFFRE (Cash) - CE QUE VOUS AVEZ DEMANDÉ */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-sm">
                      <div className="text-xs font-bold text-amber-700 uppercase mb-3 flex items-center gap-2">
                        <DollarSign className="w-3 h-3" /> Trésorerie Coffre
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-end border-b border-amber-200/50 pb-2">
                          <span className="text-sm text-amber-800">
                            Solde Coffre Actuel
                          </span>
                          <span className="font-bold text-amber-900 text-lg">
                            {formatCurrency(coffreBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-amber-800">
                            Coffre Fin de Projet
                          </span>
                          <span
                            className={`font-bold text-lg ${coffreProjected >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                          >
                            {formatCurrency(coffreProjected)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DÉPENSES */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-red-500" /> Dépenses (
                      {progressExp}%)
                      {/* DEBUG */}
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                        {expenses.length} total / {paidExpenses.length} payées
                      </span>
                    </h3>

                    <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${progressExp}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Colonne Payés */}
                      <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                        <div className="flex justify-between text-xs font-bold text-red-700 mb-2">
                          <span>PAYÉES</span>
                          <span>{paidExpenses.length}</span>
                        </div>
                        <div className="text-lg font-bold text-red-800">
                          {formatCurrency(totalPaidExpenses)}
                        </div>

                        {/* Liste aperçu */}
                        <div className="mt-2 space-y-1">
                          {paidExpenses.slice(0, 3).map((e, i) => (
                            <div
                              key={i}
                              className="text-xs flex justify-between text-red-600 bg-white/50 p-1 rounded"
                            >
                              <span className="truncate w-32">{e.description}</span>
                              <span>{formatCurrency(e.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {paidExpenses.length > 3 && (
                          <button
                            onClick={() => setShowPaidDetails(true)}
                            className="text-xs text-red-600 underline mt-2 w-full text-center"
                          >
                            Voir tout
                          </button>
                        )}
                      </div>

                      {/* Colonne À Payer */}
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div className="flex justify-between text-xs font-bold text-gray-600 mb-2">
                          <span>À PAYER</span>
                          <span>{unpaidExpenses.length}</span>
                        </div>
                        <div className="text-lg font-bold text-gray-700">
                          {formatCurrency(totalUnpaidExpenses)}
                        </div>

                        {/* Liste aperçu */}
                        <div className="mt-2 space-y-1">
                          {unpaidExpenses.slice(0, 3).map((e, i) => (
                            <div
                              key={i}
                              className="text-xs flex justify-between text-gray-500 bg-white p-1 rounded border border-gray-100"
                            >
                              <span className="truncate w-32">{e.description}</span>
                              <span>{formatCurrency(e.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {unpaidExpenses.length > 3 && (
                          <button
                            onClick={() => setShowUnpaidDetails(true)}
                            className="text-xs text-gray-500 underline mt-2 w-full text-center"
                          >
                            Voir tout
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* REVENUS */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" /> Revenus (
                      {progressRev}%)
                    </h3>

                    <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${progressRev}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Colonne Encaissés */}
                      <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                        <div className="flex justify-between text-xs font-bold text-green-700 mb-2">
                          <span>ENCAISSÉS</span>
                          <span>{receivedRevenues.length}</span>
                        </div>
                        <div className="text-lg font-bold text-green-800">
                          {formatCurrency(totalReceived)}
                        </div>

                        <div className="mt-2 space-y-1">
                          {receivedRevenues.slice(0, 3).map((r, i) => (
                            <div
                              key={i}
                              className="text-xs flex justify-between text-green-600 bg-white/50 p-1 rounded"
                            >
                              <span className="truncate w-32">{r.description}</span>
                              <span>{formatCurrency(r.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {receivedRevenues.length > 3 && (
                          <button
                            onClick={() => setShowReceivedDetails(true)}
                            className="text-xs text-green-600 underline mt-2 w-full text-center"
                          >
                            Voir tout
                          </button>
                        )}
                      </div>

                      {/* Colonne À Recevoir */}
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex justify-between text-xs font-bold text-blue-600 mb-2">
                          <span>À RECEVOIR</span>
                          <span>{pendingRevenues.length}</span>
                        </div>
                        <div className="text-lg font-bold text-blue-700">
                          {formatCurrency(totalPending)}
                        </div>

                        <div className="mt-2 space-y-1">
                          {pendingRevenues.slice(0, 3).map((r, i) => (
                            <div
                              key={i}
                              className="text-xs flex justify-between text-blue-500 bg-white/50 p-1 rounded"
                            >
                              <span className="truncate w-32">{r.description}</span>
                              <span>{formatCurrency(r.amount)}</span>
                            </div>
                          ))}
                        </div>
                        {pendingRevenues.length > 3 && (
                          <button
                            onClick={() => setShowPendingDetails(true)}
                            className="text-xs text-blue-500 underline mt-2 w-full text-center"
                          >
                            Voir tout
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="bg-gray-50 p-4 rounded-xl text-sm space-y-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{dateDisplay}</span>
                    </div>
                    {project.description && (
                      <p className="text-gray-500 text-xs italic border-t pt-2 mt-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* --- ONGLET LIAISONS --- */}
              {activeTab === 'linking' && (
                <div className="flex flex-col h-[500px]">
                  <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4 flex justify-between items-center">
                    <div className="text-sm text-yellow-800 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Sélectionnez une transaction à gauche, puis une ligne à droite.
                    </div>
                    <button
                      onClick={() => {
                        loadUnlinkedTransactions();
                        loadLinkingStats();
                      }}
                      className="p-1 hover:bg-yellow-200 rounded"
                    >
                      <RefreshCw
                        size={14}
                        className={loadingLink ? 'animate-spin' : ''}
                      />
                    </button>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    {/* Gauche: Transactions */}
                    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
                      <div className="p-2 bg-gray-50 font-bold text-xs uppercase border-b">
                        Transactions Bancaires ({unlinkedTransactions.length})
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {unlinkedTransactions.map((tx) => (
                          <div
                            key={tx.transaction_id}
                            onClick={() => setSelectedTxToLink(tx)}
                            className={`p-3 rounded border cursor-pointer transition-all ${
                              selectedTxToLink?.transaction_id === tx.transaction_id
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-bold text-xs text-gray-800">
                              {tx.transaction_description}
                            </div>
                            <div className="flex justify-between mt-1">
                              <span
                                className={`text-sm font-bold ${tx.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}
                              >
                                {formatCurrency(tx.amount)}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {new Date(tx.transaction_date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Droite: Lignes Budget */}
                    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col">
                      <div className="p-2 bg-gray-50 font-bold text-xs uppercase border-b">
                        Lignes Budget
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {/* Afficher Dépenses OU Revenus selon la transaction sélectionnée */}
                        {(() => {
                          const targetList =
                            selectedTxToLink?.type === 'income' ? revenues : expenses;

                          return targetList.map((line, idx) => {
                            const isMatch =
                              selectedTxToLink &&
                              Math.abs(
                                line.amount - parseFloat(selectedTxToLink.amount)
                              ) <
                                line.amount * 0.1;
                            return (
                              <div
                                key={idx}
                                className={`p-3 rounded border ${isMatch ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                              >
                                <div className="flex justify-between items-start">
                                  <span className="text-xs font-medium text-gray-800">
                                    {line.description}
                                  </span>
                                  {selectedTxToLink && !line.isPaid && (
                                    <button
                                      onClick={() => handleLink(line.id)}
                                      className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded shadow hover:bg-indigo-700"
                                    >
                                      Lier
                                    </button>
                                  )}
                                </div>
                                <div className="text-right text-xs text-gray-500 mt-1">
                                  Prévu: <strong>{formatCurrency(line.amount)}</strong>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* FOOTER */}
          <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex justify-end gap-3">
            <CopyButton getText={generateCopyText} size="default" className="px-4 py-2" />

            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* --- SOUS-MODALS --- */}
      {showPaidDetails && (
        <DetailListModal
          title="Dépenses Payées"
          items={paidExpenses}
          onClose={() => setShowPaidDetails(false)}
          color="emerald"
        />
      )}
      {showUnpaidDetails && (
        <DetailListModal
          title="Dépenses À Régler"
          items={unpaidExpenses}
          onClose={() => setShowUnpaidDetails(false)}
          color="gray"
        />
      )}
      {showReceivedDetails && (
        <DetailListModal
          title="Revenus Encaissés"
          items={receivedRevenues}
          onClose={() => setShowReceivedDetails(false)}
          color="green"
        />
      )}
      {showPendingDetails && (
        <DetailListModal
          title="Revenus À Recevoir"
          items={pendingRevenues}
          onClose={() => setShowPendingDetails(false)}
          color="blue"
        />
      )}
    </>
  );
}

// Sous-composant pour les listes détaillées
function DetailListModal({ title, items, onClose, color }) {
  const colors = {
    emerald: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    gray: 'text-gray-800 bg-gray-50 border-gray-200',
    green: 'text-green-800 bg-green-50 border-green-200',
    blue: 'text-blue-800 bg-blue-50 border-blue-200',
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div
          className={`p-4 border-b font-bold text-lg flex justify-between items-center ${colors[color]}`}
        >
          {title}
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="p-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold text-sm">{item.description}</div>
                <div className="text-xs text-gray-500">
                  {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                </div>
              </div>
              <div className="font-bold text-gray-800">{formatCurrency(item.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
