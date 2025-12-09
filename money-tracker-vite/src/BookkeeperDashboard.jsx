// BookkeeperDashboard.jsx - VERSION COMPLÈTE CORRIGÉE

import React, { useState, useMemo, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Calendar, Clock, Target, ArrowRight, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { CopyButton } from './components/common/CopyButton';

const formatCurrency = (amount) => 
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount || 0) + " Ar";

// Fonction pour formater les dates
const formatEventDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const dateFormatted = date.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  
  return { diffDays, dateFormatted };
};

export function BookkeeperDashboard({ 
  onClose, 
  transactions: propTransactions = [], 
  accounts = [],
  projects = []  // ✅ AJOUT : Recevoir les projets en props
}) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const transactions = propTransactions;

  useEffect(() => {
    console.log('📊 BookkeeperDashboard - Transactions reçues:', transactions.length);
    console.log('📊 BookkeeperDashboard - Comptes reçus:', accounts.length);
    console.log('📊 BookkeeperDashboard - Projets reçus:', projects.length);
    if (transactions.length > 0) {
      console.log('📊 Exemple de transaction:', transactions[0]);
    }
    if (projects.length > 0) {
      console.log('📊 Exemple de projet:', projects[0]);
    }
  }, [transactions, accounts, projects]);

  // ✅ FONCTION : Encaisser un revenu planifié
  const handleEncaisserRevenu = async (event) => {
    if (!confirm(`Encaisser ce revenu maintenant ?\n\n${event.description}\nMontant : ${formatCurrency(event.amount)}`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      console.log('🔄 Encaissement en cours...', {
        transactionId: event.transactionId,
        amount: event.amount,
        description: event.description
      });
      
      // Utiliser la date locale au format YYYY-MM-DD
      const today = new Date();
      const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      console.log('📅 Date d\'encaissement:', localDate);
      
      const response = await fetch(`http://localhost:5002/api/transactions/${event.transactionId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_posted: true,
          transaction_date: localDate
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Erreur serveur:', data);
        throw new Error(data.error || data.details || 'Erreur lors de l\'encaissement');
      }

      console.log('✅ Réponse serveur:', data);

      alert(`✅ Revenu encaissé !\n\n${formatCurrency(event.amount)} ont été ajoutés au compte.\n\nLe solde a été mis à jour.`);
      
      window.location.reload();
    } catch (error) {
      console.error('❌ Erreur encaissement:', error);
      alert(`❌ Erreur lors de l'encaissement :\n${error.message}`);
    }
  };

  // ✅ FONCTION : Dés-encaisser (annuler l'encaissement)
  const handleDesencaisser = async (event) => {
    if (!confirm(`Annuler l'encaissement de ce revenu ?\n\n${event.description}\nMontant : ${formatCurrency(event.amount)}\n\n⚠️ Le revenu sera remis en "planifié" et le solde sera restauré.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      console.log('⏪ Annulation encaissement...', {
        transactionId: event.transactionId,
        amount: event.amount,
        description: event.description
      });
      
      const response = await fetch(`http://localhost:5002/api/transactions/${event.transactionId}/unpost`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('❌ Erreur serveur:', data);
        throw new Error(data.error || data.details || 'Erreur lors de l\'annulation');
      }

      console.log('✅ Réponse serveur:', data);

      alert(`✅ Encaissement annulé !\n\n${formatCurrency(event.amount)} ont été retirés du compte.\n\nLe revenu est de nouveau planifié.`);
      
      window.location.reload();
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      alert(`❌ Erreur lors de l'annulation :\n${error.message}`);
    }
  };

  // Calculs financiers principaux
const financialMetrics = useMemo(() => {
  const now = new Date();
  let startDate;

  switch(selectedPeriod) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Inclure les transactions POSTÉES même si elles sont planifiées
// ✅ NOUVEAU : Exclure les transferts internes
const periodTransactions = transactions.filter(t => {
  const tDate = new Date(t.date || t.transaction_date);
  const isInPeriod = tDate >= startDate;
  const isPlanned = t.is_planned || t.isPlanned;
  const isPosted = t.is_posted || t.isPosted;
  
  // ✅ NOUVEAU : Détecter les transferts
  const isTransfer = t.type === 'transfer' || 
                     t.category === 'Transfert Interne' ||
                     /transfert vers/i.test(t.description) ||
                     /transfert depuis/i.test(t.description) ||
                     /retrait \d+/i.test(t.description);
  
  const shouldInclude = isInPeriod && 
                        (!isPlanned || (isPlanned && isPosted)) &&
                        !isTransfer; // ← EXCLUSION DES TRANSFERTS
  
  return shouldInclude;
});

// Compter les transferts exclus
const transfersCount = transactions.filter(t => {
  const tDate = new Date(t.date || t.transaction_date);
  const isInPeriod = tDate >= startDate;
  const isTransfer = t.type === 'transfer' || 
                     t.category === 'Transfert Interne' ||
                     /transfert vers/i.test(t.description) ||
                     /transfert depuis/i.test(t.description) ||
                     /retrait \d+/i.test(t.description);
  return isInPeriod && isTransfer;
}).length;

const transfersAmount = transactions
  .filter(t => {
    const tDate = new Date(t.date || t.transaction_date);
    const isInPeriod = tDate >= startDate;
    const isTransfer = t.type === 'transfer' || 
                       t.category === 'Transfert Interne' ||
                       /transfert vers/i.test(t.description) ||
                       /transfert depuis/i.test(t.description) ||
                       /retrait \d+/i.test(t.description);
    return isInPeriod && isTransfer && t.type === 'expense';
  })
  .reduce((sum, t) => sum + parseFloat(t.amount), 0);

console.log('📊 Période:', selectedPeriod, 'depuis', startDate.toLocaleDateString());
console.log('📊 Transactions filtrées:', periodTransactions.length);
console.log('🚫 Transferts exclus:', transfersCount, '→', transfersAmount.toLocaleString('fr-FR'), 'Ar');
console.log('📊 Exemple:', periodTransactions.slice(0, 3));

const income = periodTransactions
  .filter(t => t.type === 'income')
  .reduce((sum, t) => sum + parseFloat(t.amount), 0);

const expenses = periodTransactions
  .filter(t => t.type === 'expense')
  .reduce((sum, t) => sum + parseFloat(t.amount), 0);

console.log('💰 Revenus calculés:', income);
console.log('💸 Dépenses calculées:', expenses);
console.log('💸 Dépenses corrigées (sans transferts):', expenses);

// ✅ CORRECTION : Calculer currentCash AVANT de l'utiliser
const currentCash = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

// ✅ CORRECTION : Calculer le burn mensuel selon la période
const periodDays = (() => {
  switch(selectedPeriod) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 30;
  }
})();

  const dailyBurn = expenses / periodDays;
  const monthlyBurn = dailyBurn * 30;
  const runway = monthlyBurn > 0 ? (currentCash / monthlyBurn) : Infinity;

  console.log('🔥 Daily Burn:', dailyBurn.toFixed(0), 'Ar/jour');
  console.log('🔥 Monthly Burn:', monthlyBurn.toFixed(0), 'Ar/mois');
  console.log('✈️ Runway:', runway === Infinity ? '∞' : `${runway.toFixed(1)} mois`);

  const expensesByCategory = periodTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const topExpenseCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const revenueByCategory = periodTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const topRevenueCategories = Object.entries(revenueByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const dailyActivity = {};
  transactions
    .filter(t => {
      const tDate = new Date(t.date || t.transaction_date);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const isPlanned = t.is_planned || t.isPlanned;
      const isPosted = t.is_posted || t.isPosted;
      return tDate >= thirtyDaysAgo && (!isPlanned || (isPlanned && isPosted));
    })
    .forEach(t => {
      const dateKey = (t.date || t.transaction_date).substring(0, 10);
      if (!dailyActivity[dateKey]) {
        dailyActivity[dateKey] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        dailyActivity[dateKey].income += parseFloat(t.amount);
      } else {
        dailyActivity[dateKey].expense += parseFloat(t.amount);
      }
    });

  return {
    income,
    expenses,
    netCashflow: income - expenses,
    monthlyBurn,
    currentCash,
    runway,
    topExpenseCategories,
    topRevenueCategories,
    dailyActivity: Object.entries(dailyActivity).sort((a, b) => a[0].localeCompare(b[0]))
  };
}, [transactions, accounts, selectedPeriod]);

// ✅ Résumé projets (à partir des colonnes DB)
  const projectSummary = useMemo(() => {
  if (!projects || projects.length === 0) {
    return { count: 0, totalCost: 0, totalRev: 0, profit: 0, roi: 0, activeProjects: [] };
  }

  const active = projects.filter(p => p.status === 'active' || p.status === 'Actif');
  const totalCost = active.reduce((s, p) => s + parseFloat(p.total_cost || p.totalCost || 0), 0);
  const totalRev  = active.reduce((s, p) => s + parseFloat(p.total_revenues || p.totalRevenues || 0), 0);
  const profit    = totalRev - totalCost;
  const roi       = totalCost > 0 ? (profit / totalCost) * 100 : 0;

  return {
    count: active.length,
    totalCost,
    totalRev,
    profit,
    roi,
    activeProjects: active
  };
  }, [projects]);

  // Revenus encaissés récemment (pour dés-encaisser)
  const encaissedRevenues = useMemo(() => {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return transactions
      .filter(t => {
        const tDate = new Date(t.transaction_date || t.date);
        return (
          t.is_planned &&
          t.is_posted &&
          t.type === 'income' &&
          tDate >= last30Days
        );
      })
      .map(t => {
        const accountName = accounts.find(a => a.id === t.account_id)?.name || 'Compte inconnu';
        return {
          transactionId: t.id,
          date: t.transaction_date || t.date,
          description: t.description,
          amount: parseFloat(t.amount),
          type: t.type,
          category: t.category,
          accountName: accountName
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, accounts]);

  // ✅ CORRECTION : Calculer la timeline complète des projets
  const calculateProjectTimeline = () => {
    const now = new Date();
    const plannedTransactions = transactions.filter(t => {
      const isPlanned = t.is_planned || t.isPlanned;
      const isPosted = t.is_posted || t.isPosted;
      return isPlanned && !isPosted;
    });

    console.log('📅 Transactions planifiées non postées:', plannedTransactions.length);

    if (plannedTransactions.length === 0) {
      return [];
    }

    const projectGroups = {};
    
    plannedTransactions.forEach(trans => {
      if (trans.project_id) {
        // ✅ CORRECTION : Vérifier que le projet existe et n'est pas inactif/archivé
        const project = projects.find(p => p.id === trans.project_id);
        
        console.log(`📋 Transaction ${trans.id} pour projet ${trans.project_id}:`, project ? `${project.name} (${project.status})` : 'introuvable');
        
        if (project) {
          // ✅ Exclure les projets Inactif ET Archivé
          if (project.status !== 'Inactif' && project.status !== 'Archivé') {
            if (!projectGroups[trans.project_id]) {
              projectGroups[trans.project_id] = {
                projectId: trans.project_id,
                projectName: trans.description.match(/\[(.*?)\]/)?.[1] || project.name || 'Projet',
                transactions: []
              };
            }
            projectGroups[trans.project_id].transactions.push(trans);
          } else {
            console.log(`⚠️ Projet ${project.name} exclu (statut: ${project.status})`);
          }
        } else {
          console.warn(`⚠️ Projet ${trans.project_id} introuvable pour la transaction ${trans.id}`);
        }
      }
    });

    console.log('📊 Groupes de projets actifs:', Object.keys(projectGroups).length);

    const timelines = [];

    Object.values(projectGroups).forEach(project => {
      const sortedTransactions = [...project.transactions].sort((a, b) => 
        new Date(a.transaction_date || a.date) - new Date(b.transaction_date || b.date)
      );

      const accountTimelines = {};

      sortedTransactions.forEach(trans => {
        const accountName = accounts.find(a => a.id === trans.account_id)?.name || 'Compte inconnu';
        
        if (!accountTimelines[accountName]) {
          const currentAccount = accounts.find(a => a.name === accountName);
          accountTimelines[accountName] = {
            accountName,
            currentBalance: parseFloat(currentAccount?.balance || 0),
            events: []
          };
        }

        accountTimelines[accountName].events.push({
          date: trans.transaction_date || trans.date,
          type: trans.type,
          amount: parseFloat(trans.amount),
          description: trans.description,
          transactionId: trans.id
        });
      });

      Object.values(accountTimelines).forEach(timeline => {
        let runningBalance = timeline.currentBalance;
        
        timeline.events.forEach(event => {
          const impact = event.type === 'income' ? event.amount : -event.amount;
          runningBalance += impact;
          event.balanceAfter = runningBalance;
        });
      });

      timelines.push({
        projectName: project.projectName,
        projectId: project.projectId,
        accountTimelines: Object.values(accountTimelines)
      });
    });

    return timelines;
  };

  const projectTimelines = useMemo(() => calculateProjectTimeline(), [transactions, accounts, projects]);

  // Alertes financières
  const alerts = useMemo(() => {
    const alertList = [];

    if (financialMetrics.runway < 3 && financialMetrics.runway !== Infinity) {
      alertList.push({
        type: 'critical',
        message: `Runway critique : ${financialMetrics.runway.toFixed(1)} mois restants`,
        action: 'Réduire les dépenses ou augmenter les revenus immédiatement'
      });
    } else if (financialMetrics.runway < 6 && financialMetrics.runway !== Infinity) {
      alertList.push({
        type: 'warning',
        message: `Runway modéré : ${financialMetrics.runway.toFixed(1)} mois restants`,
        action: 'Surveiller de près et planifier les actions'
      });
    }

    if (financialMetrics.netCashflow < 0) {
      alertList.push({
        type: 'warning',
        message: `Cashflow négatif : ${formatCurrency(Math.abs(financialMetrics.netCashflow))}`,
        action: 'Analyser les dépenses et trouver des économies'
      });
    }
    return alertList;
  }, [financialMetrics]);

  // Fonction pour générer le texte à copier
  const generateCopyText = () => {
    const now = new Date().toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    let text = `📊 BOOKKEEPER DASHBOARD\n`;
    text += `═══════════════════════════════════════════════\n`;
    text += `Date: ${now}\n`;
    text += `Période: ${selectedPeriod === 'week' ? 'Semaine' : selectedPeriod === 'month' ? 'Mois' : selectedPeriod === 'quarter' ? 'Trimestre' : 'Année'}\n`;
    text += `Transactions analysées: ${transactions.length}\n`;
    text += `\n`;

    // KPIs Principaux
    text += `💰 INDICATEURS CLÉS\n`;
    text += `───────────────────────────────────────────────\n`;
    text += `Revenus:           ${formatCurrency(financialMetrics.income)}\n`;
    text += `Dépenses (Burn):   ${formatCurrency(financialMetrics.expenses)}\n`;
    text += `Cashflow Net:      ${formatCurrency(financialMetrics.netCashflow)}\n`;
    text += `Runway:            ${financialMetrics.runway === Infinity ? '∞' : `${financialMetrics.runway.toFixed(1)} mois`}\n`;
    text += `Cash Disponible:   ${formatCurrency(financialMetrics.currentCash)}\n`;
    text += `\n`;

    // Alertes
    if (alerts.length > 0) {
      text += `⚠️ ALERTES\n`;
      text += `───────────────────────────────────────────────\n`;
      alerts.forEach(alert => {
        text += `• [${alert.type.toUpperCase()}] ${alert.message}\n`;
        text += `  → ${alert.action}\n`;
      });
      text += `\n`;
    }

    // Revenus Encaissés (30 derniers jours)
    if (encaissedRevenues && encaissedRevenues.length > 0) {
      text += `✅ REVENUS ENCAISSÉS (30 DERNIERS JOURS)\n`;
      text += `───────────────────────────────────────────────\n`;
      
      encaissedRevenues.forEach(event => {
        const { diffDays, dateFormatted } = formatEventDate(event.date);
        const daysAgo = Math.abs(diffDays);
        
        text += `• ${dateFormatted} (il y a ${daysAgo} jour${daysAgo > 1 ? 's' : ''})\n`;
        text += `  ${event.description}\n`;
        text += `  +${formatCurrency(event.amount)} → ${event.accountName}\n`;
      });
      
      const totalEncaisse = encaissedRevenues.reduce((sum, e) => sum + e.amount, 0);
      text += `\n  TOTAL ENCAISSÉ: ${formatCurrency(totalEncaisse)}\n`;
      text += `\n`;
    }

    // Impacts à venir
    if (projectTimelines && projectTimelines.length > 0) {
      text += `📅 IMPACTS À VENIR\n`;
      text += `───────────────────────────────────────────────\n`;
      
      projectTimelines.forEach(project => {
        text += `\n📋 ${project.projectName}\n`;
        
        if (project.accountTimelines && project.accountTimelines.length > 0) {
          project.accountTimelines.forEach(accountTimeline => {
            text += `\n  💳 ${accountTimeline.accountName}\n`;
            text += `  Solde actuel: ${formatCurrency(accountTimeline.currentBalance)}\n`;
            
            if (accountTimeline.events && accountTimeline.events.length > 0) {
              accountTimeline.events.forEach(event => {
                const { diffDays, dateFormatted } = formatEventDate(event.date);
                const daysLabel = diffDays === 0 ? "Aujourd'hui" : 
                                 diffDays < 0 ? `J${diffDays}` : `J+${diffDays}`;
                
                text += `    • [${daysLabel}] ${dateFormatted} - ${event.type === 'income' ? '+' : '-'}${formatCurrency(event.amount)}\n`;
                text += `      ${event.description}\n`;
                text += `      Solde après: ${formatCurrency(event.balanceAfter)}\n`;
              });
              
              const finalBalance = accountTimeline.events[accountTimeline.events.length - 1]?.balanceAfter || accountTimeline.currentBalance;
              text += `  Solde final: ${formatCurrency(finalBalance)}\n`;
            }
          });
        }
      });
      
      text += `\n`;
    }

    // Top Dépenses
    if (financialMetrics.topExpenseCategories && financialMetrics.topExpenseCategories.length > 0) {
      text += `💸 TOP 5 DÉPENSES\n`;
      text += `───────────────────────────────────────────────\n`;
      financialMetrics.topExpenseCategories.forEach(([category, amount], idx) => {
        const percentage = financialMetrics.expenses > 0 ? (amount / financialMetrics.expenses) * 100 : 0;
        text += `${idx + 1}. ${category}: ${formatCurrency(amount)} (${percentage.toFixed(1)}%)\n`;
      });
      text += `\n`;
    }

    // Top Revenus
    if (financialMetrics.topRevenueCategories && financialMetrics.topRevenueCategories.length > 0) {
      text += `💰 SOURCES DE REVENUS\n`;
      text += `───────────────────────────────────────────────\n`;
      financialMetrics.topRevenueCategories.forEach(([category, amount], idx) => {
        const percentage = financialMetrics.income > 0 ? (amount / financialMetrics.income) * 100 : 0;
        text += `${idx + 1}. ${category}: ${formatCurrency(amount)} (${percentage.toFixed(1)}%)\n`;
      });
      text += `\n`;
    }

    // Activité récente
    if (financialMetrics.dailyActivity && financialMetrics.dailyActivity.length > 0) {
      text += `📆 ACTIVITÉ RÉCENTE (10 derniers jours)\n`;
      text += `───────────────────────────────────────────────\n`;
      const recentActivity = financialMetrics.dailyActivity.slice(-10).reverse();
      
      recentActivity.forEach(([date, data]) => {
        if (date && data) {
          const net = data.income - data.expense;
          text += `${date}: +${formatCurrency(data.income)} / -${formatCurrency(data.expense)} = ${formatCurrency(net)}\n`;
        }
      });
      text += `\n`;
    }

    text += `═══════════════════════════════════════════════\n`;
    text += `Généré par Money Tracker • ${new Date().toLocaleTimeString('fr-FR')}\n`;
    
    return text;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-blue-50 to-white rounded-3xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden border-4 border-blue-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
              📊 Bookkeeper Dashboard
            </h1>
            <p className="text-blue-100 text-sm">
              What I don't track can't grow • {transactions.length} transactions
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <CopyButton getText={generateCopyText} />
            <button 
              onClick={onClose}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-3 rounded-xl transition-all"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b-2 border-blue-200 px-6 py-3 flex gap-2">
          {['week', 'month', 'quarter', 'year'].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period === 'week' ? 'Semaine' : period === 'month' ? 'Mois' : period === 'quarter' ? 'Trimestre' : 'Année'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          
          {/* Alertes */}
          {alerts.length > 0 && (
            <div className="mb-6 space-y-3">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`p-4 rounded-xl border-2 ${
                  alert.type === 'critical' ? 'bg-red-50 border-red-300' :
                  alert.type === 'warning' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-blue-50 border-blue-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`${
                      alert.type === 'critical' ? 'text-red-600' :
                      alert.type === 'warning' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} size={24} />
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{alert.message}</div>
                      <div className="text-sm text-gray-600 mt-1">{alert.action}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
{/* 📁 Projets actifs */}
<div className="mb-6 p-4 rounded-xl border-2 bg-indigo-100 border-red-300">
  <div className="flex items-start gap-3">
    <CheckCircle className="text-black-500" size={24} />
    <div className="flex-1">
      <div className="mb-1 font-bold text-black-900">
        Projets actifs : <span className="text-sm font-black">{projectSummary.count}</span>
      </div>

      {projectSummary.count === 0 ? (
        <div className="text-sm text-black-700">
          Aucun projet actif. Utilise le Planificateur pour en créer ou en activer un.
        </div>
      ) : (
        <>
          <div className="text-sm text-black-800 mb-2">
            Investi: <span className="font-bold">{formatCurrency(projectSummary.totalCost)}</span> ·{' '}
            CA prévu: <span className="font-bold">{formatCurrency(projectSummary.totalRev)}</span> ·{' '}
            ROI: <span className="font-bold">{projectSummary.roi.toFixed(1)}%</span>
          </div>

          <div className="mt-2 space-y-1 text-sm text-black-900 font-bold">
            {projectSummary.activeProjects.slice(0, 3).map(p => (
              <div
                key={p.id}
                className="flex items-baseline justify-start border-t border-green-100 pt-1 first:border-t-0 first:pt-0"
              >
                <span className="truncate mr-3">“{p.name}”</span>
                <span className="font-bold text-red-800 tabular-nums whitespace-nowrap">
                  {formatCurrency(p.total_cost || p.totalCost || 0)} →{' '}
                  {formatCurrency(p.total_revenues || p.totalRevenues || 0)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
</div>

          {/* Revenus Encaissés Récemment */}
          {encaissedRevenues.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={24} />
                Revenus Encaissés (30 derniers jours)
              </h3>
              <div className="space-y-3">
                {encaissedRevenues.map((event, idx) => {
                  const { diffDays, dateFormatted } = formatEventDate(event.date);
                  
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="bg-green-100 p-3 rounded-xl">
                          <CheckCircle className="text-green-600" size={24} />
                        </div>
                        
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{event.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {dateFormatted}
                              {diffDays > -7 && (
                                <span className="text-xs text-green-600 ml-1">
                                  (il y a {Math.abs(diffDays)} jour{Math.abs(diffDays) > 1 ? 's' : ''})
                                </span>
                              )}
                            </span>
                            <span className="bg-green-100 px-2 py-0.5 rounded text-xs font-medium">
                              {event.accountName}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            +{formatCurrency(event.amount)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDesencaisser(event)}
                        className="ml-4 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition flex items-center gap-2 font-semibold"
                      >
                        <XCircle size={18} />
                        Annuler
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ✅ NOUVEAU : Card Solde Total Futur - Comme dans le Dashboard */}
{projectTimelines && projectTimelines.length > 0 && (
  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl shadow-xl border-2 border-indigo-200 mb-6">
    {/* Solde Total Actuel */}
    <div className="mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="bg-indigo-500 p-3 rounded-xl">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">Solde Total Actuel</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0))}
          </p>
          <p className="text-xs text-gray-500 mt-1">{accounts.length} compte{accounts.length > 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>

    {/* Flèche indicatrice */}
    <div className="flex items-center justify-center my-4">
      <div className="flex items-center space-x-2">
        <div className="h-0.5 w-20 bg-gradient-to-r from-indigo-300 to-green-300"></div>
        <TrendingUp className="w-6 h-6 text-green-500" />
        <div className="h-0.5 w-20 bg-gradient-to-r from-green-300 to-emerald-300"></div>
      </div>
    </div>

    {/* Solde Total Futur */}
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border-2 border-green-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-green-500 p-3 rounded-xl animate-pulse">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-green-700 mb-1">
              Solde Total après encaissements
            </h3>
            <p className="text-4xl font-bold text-green-600">
              {formatCurrency(
                accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0) + 
                projectTimelines.reduce((sum, project) => 
                  sum + project.accountTimelines.reduce((accSum, acc) => 
                    accSum + acc.events.reduce((evSum, ev) => 
                      evSum + (ev.type === 'income' ? ev.amount : -ev.amount), 0
                    ), 0
                  ), 0
                )
              )}
            </p>
            <p className="text-sm text-green-600 mt-2">
              <span className="font-semibold">
                +{formatCurrency(
                  projectTimelines.reduce((sum, project) => 
                    sum + project.accountTimelines.reduce((accSum, acc) => 
                      accSum + acc.events.reduce((evSum, ev) => 
                        evSum + (ev.type === 'income' ? ev.amount : 0), 0
                      ), 0
                    ), 0
                  )
                )}
              </span> à venir
            </p>
          </div>
        </div>
        
        {/* Badge de gain */}
        <div className="text-right">
          <div className="bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <p className="text-xs font-medium">Gain prévu</p>
            <p className="text-2xl font-bold">
              +{(() => {
                const currentTotal = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
                const futureRevenues = projectTimelines.reduce((sum, project) => 
                  sum + project.accountTimelines.reduce((accSum, acc) => 
                    accSum + acc.events.reduce((evSum, ev) => 
                      evSum + (ev.type === 'income' ? ev.amount : 0), 0
                    ), 0
                  ), 0
                );
                return currentTotal > 0 ? Math.round((futureRevenues / currentTotal) * 100) : 0;
              })()}%
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Timeline */}
    <div className="mt-4 pt-4 border-t-2 border-indigo-200">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-gray-600 font-medium">Aujourd'hui</span>
        </div>
        <div className="flex-1 mx-4">
          <div className="relative">
            <div className="h-0.5 bg-gradient-to-r from-gray-300 via-indigo-300 to-green-400"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-indigo-500 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                {projectTimelines.reduce((sum, p) => sum + p.accountTimelines.reduce((s, a) => s + a.events.length, 0), 0)} encaissement{projectTimelines.reduce((sum, p) => sum + p.accountTimelines.reduce((s, a) => s + a.events.length, 0), 0) > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-semibold text-green-600">
            J+{(() => {
              const allDates = projectTimelines.flatMap(p => 
                p.accountTimelines.flatMap(a => 
                  a.events.map(e => Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24)))
                )
              );
              return Math.max(...allDates, 0);
            })()}
          </span>
        </div>
      </div>
    </div>
  </div>
)}

          {/* Impacts à Venir */}
          {projectTimelines.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 mb-6">
              <h2 className="text-2xl font-bold mb-6 text-blue-900 flex items-center gap-3">
                📅 Impacts à Venir
              </h2>

              <div className="space-y-8">
                {projectTimelines.map(timeline => (
                  <div key={timeline.projectId} className="mb-8 pb-8 border-b-2 border-blue-100 last:border-0">
                    <h3 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                      📋 {timeline.projectName}
                    </h3>

                    {timeline.accountTimelines.map(accountTimeline => (
                      <div key={accountTimeline.accountName} className="mb-6 bg-gradient-to-r from-blue-50 to-transparent p-4 rounded-lg">
                        <h4 className="font-bold text-lg text-blue-800 mb-3 flex items-center gap-2">
                          💳 {accountTimeline.accountName}
                        </h4>
                        
                        <div className="text-sm text-gray-700 mb-4">
                          Solde actuel: <span className="font-bold text-blue-900">
                            {formatCurrency(accountTimeline.currentBalance)}
                          </span>
                        </div>

                        <div className="space-y-3 ml-4">
                          {accountTimeline.events.map((event, idx) => {
                            const { diffDays, dateFormatted } = formatEventDate(event.date);
                            const daysLabel = diffDays === 0 ? "Aujourd'hui" : 
                                             diffDays < 0 ? `J${diffDays}` : `J+${diffDays}`;
                            
                            return (
                              <div key={idx} className="border-l-4 border-blue-300 pl-4 py-2">
                                <div className="flex items-start gap-2 flex-wrap justify-between">
                                  <div className="flex items-start gap-2 flex-wrap flex-1">
                                    <span className="font-mono text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      [{daysLabel}]
                                    </span>
                                    <span className="font-medium text-gray-600">
                                      {dateFormatted}
                                    </span>
                                    <span className={`font-bold ${event.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                      {event.type === 'income' ? '+' : '-'}{formatCurrency(event.amount)}
                                    </span>
                                  </div>
                                  
                                  {event.type === 'income' && (
                                    <button
                                      onClick={() => handleEncaisserRevenu(event)}
                                      className="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition text-xs font-semibold flex items-center gap-1"
                                      title="Encaisser ce revenu maintenant"
                                    >
                                      <CheckCircle size={14} />
                                      Encaisser
                                    </button>
                                  )}
                                </div>
                                
                                <div className="text-sm text-gray-600 mt-1">
                                  {event.description}
                                </div>
                                
                                <div className="text-xs text-blue-600 mt-1">
                                  Solde après: <span className="font-bold">
                                    {formatCurrency(event.balanceAfter)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-3 border-t-2 border-blue-200 text-sm">
                          Solde final: <span className="font-bold text-blue-900 text-lg">
                            {formatCurrency(accountTimeline.events[accountTimeline.events.length - 1]?.balanceAfter || accountTimeline.currentBalance)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPIs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-white p-6 rounded-2xl border-2 border-green-200 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">Revenus</span>
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div className="text-2xl font-black text-green-700">
                {formatCurrency(financialMetrics.income)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-white p-6 rounded-2xl border-2 border-red-200 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">Dépenses</span>
                <TrendingDown className="text-red-600" size={24} />
              </div>
              <div className="text-2xl font-black text-red-700">
                {formatCurrency(financialMetrics.expenses)}
              </div>
            </div>

            <div className={`bg-gradient-to-br p-6 rounded-2xl border-2 shadow-lg ${
              financialMetrics.netCashflow >= 0 
                ? 'from-blue-50 to-white border-blue-200' 
                : 'from-orange-50 to-white border-orange-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">Cashflow Net</span>
                <DollarSign className={financialMetrics.netCashflow >= 0 ? 'text-blue-600' : 'text-orange-600'} size={24} />
              </div>
              <div className={`text-2xl font-black ${financialMetrics.netCashflow >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {formatCurrency(financialMetrics.netCashflow)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border-2 border-purple-200 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 font-medium">Runway</span>
                <Clock className="text-purple-600" size={24} />
              </div>
              <div className="text-2xl font-black text-purple-700">
                {financialMetrics.runway === Infinity ? '∞' : `${financialMetrics.runway.toFixed(1)}m`}
              </div>
            </div>
          </div>

          {/* Top Dépenses et Revenus */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-200">
              <h2 className="text-xl font-bold mb-4 text-red-900 flex items-center gap-2">
                💸 Top 5 Dépenses
              </h2>
              {financialMetrics.topExpenseCategories && financialMetrics.topExpenseCategories.length > 0 ? (
                <div className="space-y-3">
                  {financialMetrics.topExpenseCategories.map(([category, amount], idx) => {
                    const percentage = (amount / financialMetrics.expenses) * 100;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-700">{idx + 1}</span>
                          <span className="text-gray-700">{category}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-900">{formatCurrency(amount)}</div>
                          <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">Aucune dépense enregistrée</p>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-green-200">
              <h2 className="text-xl font-bold mb-4 text-green-900 flex items-center gap-2">
                💰 Sources de Revenus
              </h2>
              {financialMetrics.topRevenueCategories && financialMetrics.topRevenueCategories.length > 0 ? (
                <div className="space-y-3">
                  {financialMetrics.topRevenueCategories.map(([category, amount], idx) => {
                    const percentage = (amount / financialMetrics.income) * 100;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-green-700">{idx + 1}</span>
                          <span className="text-gray-700">{category}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-900">{formatCurrency(amount)}</div>
                          <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">Aucun revenu enregistré</p>
              )}
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-6 border-2 border-indigo-200">
            <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">
              💡 Bonnes Pratiques
            </h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <Target className="text-indigo-600 flex-shrink-0 mt-1" size={20} />
                <span>Réviser les 3 plus grosses catégories de dépenses mensuellement</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="text-indigo-600 flex-shrink-0 mt-1" size={20} />
                <span>Maintenir un runway minimum de 6 mois</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="text-indigo-600 flex-shrink-0 mt-1" size={20} />
                <span>Automatiser la capture des factures (scan → catégorisation)</span>
              </li>
              <li className="flex items-start gap-2">
                <Calendar className="text-indigo-600 flex-shrink-0 mt-1" size={20} />
                <span>Revue hebdomadaire de 15-30 min pour rapprochement</span>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
