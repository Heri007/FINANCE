// ProjectsListModal.jsx - VERSION COMPLÈTE CORRIGÉE
import React, { useState } from 'react';
import { X, Plus, Eye, Edit, Trash2, TrendingUp, Calendar, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import TransactionEditModal from './TransactionEditModal';

// ✅ Fonction utilitaire pour parser le JSON en toute sécurité
const safeParseJSON = (data) => {
  if (!data) return [];
  try {
    if (typeof data === 'object') return data;
    const parsed = JSON.parse(data);
    if (typeof parsed === 'string') return JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Erreur parsing JSON projet:", e);
    return [];
  }
};

// ✅ Fonction pour recalculer le coût total à la volée
const calculateTotalCost = (project) => {
  const expenses = safeParseJSON(project.expenses);
  const occurrences = parseInt(project.occurrencesCount || project.occurrences_count || 1);
  const isRecurrent = project.type === 'recurrent';

  return expenses.reduce((sum, item) => {
    const amount = parseFloat(item.amount || 0);
    const multiplier = (isRecurrent && item.isRecurring) ? occurrences : 1;
    return sum + (amount * multiplier);
  }, 0);
};

// ✅ Fonction pour formater une date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (error) { return 'N/A'; }
};

// ✅ Fonction pour formater une devise
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount || 0) + " Ar";
};

export function ProjectsListModal({
  isOpen,
  onClose,
  onNewProject,
  onEditProject,
  onActivateProject,
  onDeleteProject,
  onCompleteProject,
  onProjectUpdate,  // ✅ Nouvelle prop
  onTransactionClick,
  accounts = [],
  projects = [],
  totalBalance = 0,
  transactions = [],
}) {


  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);

  if (!isOpen) return null;

  // Filtrage
  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  // Stats globales (recalculées)
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    draft: projects.filter(p => p.status === 'draft' || !p.status).length,
    totalInvestment: projects.reduce((sum, p) => sum + calculateTotalCost(p), 0),
  };

  // ---------------------------------------------------------------------------
  // CALCULS DES SOLDES
  // ---------------------------------------------------------------------------
  
  // 1. Trouver le compte Coffre (ID 5 ou via le nom)
  const coffreAccount = accounts.find(acc => 
    (acc.name && acc.name.toLowerCase().includes('coffre')) || acc.id === 5
  );
  
  // 2. Solde du Coffre uniquement
  const coffreBalance = coffreAccount ? parseFloat(coffreAccount.balance || 0) : 0;

  // 3. ✅ Solde TOTAL de TOUS les comptes
  const totalBalanceAllAccounts = accounts.reduce((sum, acc) => {
    return sum + parseFloat(acc.balance || 0);
  }, 0);

  // 4. Calcul du coût total restant (somme des coûts de tous les projets)
  const remainingCostSum = projects
  .filter(p => p.status === 'active')
  .reduce((sum, p) => {
    const totalCost = calculateTotalCost(p);
    return sum + totalCost;
  }, 0);

  // 5. Somme des profits nets prévus (DB)
  const totalNetProfitDb = projects
  .filter(p => p.status === 'active' && p.name !== 'PLG FLPT - Campagne Pêche Complete')
  .reduce((sum, p) => {
    const rawNet = p.net_profit ?? p.netProfit ?? 0;
    return sum + (Number(rawNet) || 0);
  }, 0);

  // 6. Solde COFFRE si tout activé (on retire le coût total)
  const balanceIfAllInvested = coffreBalance - remainingCostSum;

  // 7. Solde COFFRE après projets terminés (profit net ajouté)
  const balanceIfAllCompleted = coffreBalance + totalNetProfitDb;

  // 8. ✅ Solde TOTAL GÉNÉRAL après terminaison de tous les projets
  const totalBalanceAfterCompletion = totalBalanceAllAccounts + totalNetProfitDb;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col h-[90vh]">
        
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-start bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              Mes Projets
            </h2>
            <p className="text-sm text-gray-500 mt-1">Gérez et suivez tous vos investissements</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onNewProject} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all">
              <Plus className="w-4 h-4" /> Nouveau Projet
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ✅ STATS BAR - GRID 7 COLONNES CORRIGÉ */}
        <div className="px-6 py-4 bg-white border-b grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
          
          {/* 1. Total Projets */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="text-xs font-bold text-blue-600 uppercase">Total Projets</div>
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
          </div>

          {/* 2. Actifs */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-xs font-bold text-emerald-600 uppercase">Actifs</div>
            <div className="text-2xl font-bold text-emerald-900">{stats.active}</div>
          </div>

          {/* 3. Brouillons */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-xs font-bold text-gray-600 uppercase">Brouillons</div>
            <div className="text-2xl font-bold text-gray-900">{stats.draft}</div>
          </div>

          {/* 4. Investissement Global */}
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
            <div className="text-xs font-bold text-purple-600 uppercase">
              Investissement Global
            </div>
            <div className="text-lg font-bold text-purple-900 truncate" title={formatCurrency(stats.totalInvestment)}>
              {formatCurrency(stats.totalInvestment)}
            </div>
          </div>

          {/* 5. Solde Projeté (COFFRE) */}
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div className="text-xs font-bold text-rose-600 uppercase flex items-center gap-1">
              Solde Projeté (COFFRE)
            </div>
            <div
              className={`text-lg font-bold ${
                balanceIfAllInvested >= 0 ? 'text-rose-900' : 'text-red-600'
              } truncate`}
              title={formatCurrency(balanceIfAllInvested)}
            >
              {formatCurrency(balanceIfAllInvested)}
            </div>
          </div>

          {/* 6. Solde après terminaison (COFFRE) */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-xs font-bold text-emerald-600 uppercase">
              Solde après terminaison (COFFRE)
            </div>
            <div className="text-lg font-bold text-emerald-900 truncate" title={formatCurrency(balanceIfAllCompleted)}>
              {formatCurrency(balanceIfAllCompleted)}
            </div>
          </div>

          {/* Solde Total Général - VERSION 2 LIGNES */}
<div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border-2 border-indigo-200 shadow-md">
  <div className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-1">
    Solde Total (Général)
  </div>
  <div 
    className="text-base font-bold text-indigo-900 break-words" 
    title={formatCurrency(totalBalanceAfterCompletion)}
  >
    {formatCurrency(totalBalanceAfterCompletion)}
  </div>
  <div className="text-xs text-indigo-500 mt-0.5 font-medium">
    Après tous projets
  </div>
</div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
              <TrendingUp className="w-12 h-12 mb-2 opacity-20" />
              <p>Aucun projet trouvé.</p>
              <button onClick={onNewProject} className="mt-4 text-blue-600 hover:underline text-sm">
                Créer un nouveau projet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map(project => {
                const realCost = calculateTotalCost(project);
                const isRecurrent = project.type === 'recurrent';

                return (
                  <div key={project.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-wider ${
                      project.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {project.status === 'active' ? 'Actif' : 'Brouillon'}
                    </div>

                    <div className="p-5">
                      <h3 className="font-bold text-gray-800 text-lg mb-1 truncate pr-16">{project.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 h-10 mb-4">
                        {project.description || "Aucune description"}
                      </p>
                      
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>{formatDate(project.startDate || project.start_date)}</span>
                        <span className="mx-1">•</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${isRecurrent ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {isRecurrent ? 'Récurrent' : 'Ponctuel'}
                        </span>
                      </div>

                      <div className="flex justify-between items-end border-t pt-4">
                        <div>
                          <div className="text-xs text-gray-400 uppercase font-bold">Budget</div>
                          <div className="text-xl font-bold text-gray-800">{formatCurrency(realCost)}</div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => setSelectedProject(project)} 
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                            title="Voir détails"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button 
                                      onClick={() => onEditProject(project)} 
                                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                      title="Modifier"
                                   >
                                      <Edit className="w-5 h-5" />
                                   </button>
                                   {/* ✅ BOUTON DÉSACTIVER (si projet actif) */}
  {project.status === 'active' && (
    <button 
      onClick={async () => {
        if (!confirm(`Désactiver le projet "${project.name}" ?\n\nLe projet sera exclu des calculs globaux.`)) {
          return;
        }
        
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`http://localhost:5002/api/projects/${project.id}/status`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ status: 'Inactif' })
});


          if (!response.ok) {
            throw new Error('Erreur lors de la désactivation');
          }

          alert(`✅ Projet "${project.name}" désactivé avec succès`);
          if (response.ok) {
  alert(`✅ Projet "${project.name}" désactivé`);
  if (onProjectUpdate) {
    await onProjectUpdate();
  }
}

        } catch (error) {
          console.error('❌ Erreur désactivation:', error);
          alert(`❌ Erreur: ${error.message}`);
        }
      }}
      className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" 
      title="Désactiver"
    >
      <AlertCircle className="w-5 h-5" />
    </button>
  )}
  
  <button 
    onClick={() => onDeleteProject(project.id)} 
    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
    title="Supprimer"
  >
    <Trash2 className="w-5 h-5" />
  </button>
                                </div>
                             </div>
                          </div>
                       </div>
                    );
                 })}
              </div>
           )}
        </div>

        {/* MODAL DÉTAILS DU PROJET */}
        {selectedProject && (
           <ProjectDetailsModal
              project={selectedProject}
              isOpen={!!selectedProject}
              onClose={() => setSelectedProject(null)}
              onActivateProject={onActivateProject}
              onCompleteProject={onCompleteProject}
              accounts={accounts}
              transactions={transactions}
              totalBalance={totalBalance}
              onEditTransaction={(tx) => {
                setEditingTransaction(tx);
                setSelectedProject(null);
              }}
            />
        )}

        {/* MODAL D'ÉDITION DE TRANSACTION */}
        {editingTransaction && (
          <TransactionEditModal
            transaction={editingTransaction}
            isOpen={!!editingTransaction}
            onClose={() => setEditingTransaction(null)}
            onUpdate={() => {
              setEditingTransaction(null);
              window.location.reload(); // ou appelez une fonction de rafraîchissement
            }}
            accounts={accounts}
          />
        )}
      </div>
    </div>
  );
}
