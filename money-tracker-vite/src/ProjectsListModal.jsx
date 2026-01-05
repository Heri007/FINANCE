// ProjectsListModal.jsx - VERSION COMPLÈTE CORRIGÉE
import React, { useState } from 'react';
import {
  X,
  Plus,
  Eye,
  Edit,
  Trash2,
  TrendingUp,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { ProjectDetailsModal } from './ProjectDetailsModal';
import TransactionEditModal from './TransactionEditModal';

// Ajouter cette fonction en haut du composant ProjectsListModal
const getProjectColorScheme = (project) => {
  const type = project.type?.toUpperCase() || 'DEFAULT';

  const colorSchemes = {
    LIVESTOCK: {
      // 🐔 Élevage - Rose/Pink (chaleureux, vivant)
      gradient: 'from-pink-500 to-rose-500',
      badge: 'bg-pink-100 text-pink-700 border-pink-200',
      card: 'bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200',
      hover: 'hover:shadow-pink-200',
      icon: '🐔',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      budgetBg: 'bg-pink-100',
      budgetText: 'text-pink-800',
    },
    MINING: {
      // ⛏️ Mines - Ambre/Orange (terre, minéraux)
      gradient: 'from-amber-500 to-orange-500',
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      card: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
      hover: 'hover:shadow-amber-200',
      icon: '⛏️',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      budgetBg: 'bg-amber-100',
      budgetText: 'text-amber-800',
    },
    TRADE: {
      // 📦 Commerce - Bleu (confiance, échanges)
      gradient: 'from-blue-500 to-cyan-500',
      badge: 'bg-blue-100 text-blue-700 border-blue-200',
      card: 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200',
      hover: 'hover:shadow-blue-200',
      icon: '📦',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      budgetBg: 'bg-blue-100',
      budgetText: 'text-blue-800',
    },
    FISHING: {
      // 🎣 Pêche - Turquoise/Teal (mer, eau)
      gradient: 'from-teal-500 to-cyan-500',
      badge: 'bg-teal-100 text-teal-700 border-teal-200',
      card: 'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200',
      hover: 'hover:shadow-teal-200',
      icon: '🎣',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      budgetBg: 'bg-teal-100',
      budgetText: 'text-teal-800',
    },
    INVESTMENT: {
      // 💰 Investissement - Violet/Purple (richesse, premium)
      gradient: 'from-purple-500 to-indigo-500',
      badge: 'bg-purple-100 text-purple-700 border-purple-200',
      card: 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200',
      hover: 'hover:shadow-purple-200',
      icon: '💰',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      budgetBg: 'bg-purple-100',
      budgetText: 'text-purple-800',
    },
    DEFAULT: {
      // ⚡ Défaut - Gris (neutre)
      gradient: 'from-gray-500 to-slate-500',
      badge: 'bg-gray-100 text-gray-700 border-gray-200',
      card: 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200',
      hover: 'hover:shadow-gray-200',
      icon: '⚡',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      budgetBg: 'bg-gray-100',
      budgetText: 'text-gray-800',
    },
  };

  return colorSchemes[type] || colorSchemes['DEFAULT'];
};

// ✅ Fonction utilitaire pour parser le JSON en toute sécurité
const safeParseJSON = (data) => {
  if (!data) return [];
  try {
    if (typeof data === 'object') return data;
    const parsed = JSON.parse(data);
    if (typeof parsed === 'string') return JSON.parse(parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Erreur parsing JSON projet:', e);
    return [];
  }
};

// ✅ Fonction pour recalculer le coût total à la volée
const calculateTotalCost = (project) => {
  const expenses = safeParseJSON(project.expenses);
  const occurrences = parseInt(
    project.occurrencesCount || project.occurrences_count || 1
  );
  const isRecurrent = project.type === 'recurrent';

  return expenses.reduce((sum, item) => {
    const amount = parseFloat(item.amount || 0);
    const multiplier = isRecurrent && item.isRecurring ? occurrences : 1;
    return sum + amount * multiplier;
  }, 0);
};

// ✅ Fonction pour formater une date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (error) {
    return 'N/A';
  }
};

// ✅ Fonction pour formater une devise
const formatCurrency = (amount) => {
  return (
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount || 0) +
    ' Ar'
  );
};

export function ProjectsListModal({
  isOpen,
  onClose,
  onNewProject,
  onEditProject,
  onActivateProject,
  onDeleteProject,
  onCompleteProject,
  onProjectUpdate, // ✅ Nouvelle prop
  onReactivateProject, // ✅ AJOUTER ICI
  onTransactionClick,
  onDeactivateProject,
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
  const filteredProjects = projects.filter((project) => {
    if (filter === 'all') return true;
    return project.status === filter;
  });

  // Stats globales (recalculées)
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    draft: projects.filter((p) => p.status === 'draft' || !p.status).length,
    totalInvestment: projects.reduce((sum, p) => sum + calculateTotalCost(p), 0),
  };

  // ---------------------------------------------------------------------------
  // CALCULS DES SOLDES
  // ---------------------------------------------------------------------------
  // 1. Trouver le compte Coffre (ID 5 ou via le nom)
  const coffreAccount = accounts.find(
    (acc) => (acc.name && acc.name.toLowerCase().includes('coffre')) || acc.id === 5
  );

  // 2. Solde du Coffre uniquement
  const coffreBalance = coffreAccount ? parseFloat(coffreAccount.balance || 0) : 0;

  // 3. ✅ Solde TOTAL de TOUS les comptes
  const totalBalanceAllAccounts = accounts.reduce((sum, acc) => {
    return sum + parseFloat(acc.balance || 0);
  }, 0);

  // 4. Calcul du coût total restant (somme des coûts de tous les projets)
  const remainingCostSum = projects
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => {
      const totalCost = calculateTotalCost(p);
      return sum + totalCost;
    }, 0);

  // 5. Somme des profits nets prévus (DB)
  const totalNetProfitDb = projects
    .filter(
      (p) => p.status === 'active' && p.name !== 'PLG FLPT - Campagne Pêche Complete'
    )
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

  const getStatusBadge = (status) => {
    const badges = {
      active: {
        label: 'Actif',
        color: 'bg-green-100 text-green-800 border-green-200',
      },
      draft: {
        label: 'Brouillon',
        color: 'bg-gray-100 text-gray-800 border-gray-200',
      },
      paused: {
        label: 'En pause',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
      },
      completed: {
        label: '✅ Terminé',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
      },
      archived: {
        label: 'Archivé',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
      },
    };

    const badge = badges[status] || badges.draft;

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full border ${badge.color}`}
      >
        {badge.label}
      </span>
    );
  };

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
            <p className="text-sm text-gray-500 mt-1">
              Gérez et suivez tous vos investissements
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNewProject}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
            >
              <Plus className="w-4 h-4" /> Nouveau Projet
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
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
            <div
              className="text-lg font-bold text-purple-900 truncate"
              title={formatCurrency(stats.totalInvestment)}
            >
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
            <div
              className="text-lg font-bold text-emerald-900 truncate"
              title={formatCurrency(balanceIfAllCompleted)}
            >
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
              <button
                onClick={onNewProject}
                className="mt-4 text-blue-600 hover:underline text-sm"
              >
                Créer un nouveau projet
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const realCost = calculateTotalCost(project);
                const isRecurrent = project.type === 'recurrent';
                const colors = getProjectColorScheme(project); // ← NOUVEAU

                return (
                  <div
                    key={project.id}
                    className={`
        ${colors.card}
        rounded-2xl 
        border-2 
        shadow-lg 
        ${colors.hover}
        hover:scale-102
        transition-all 
        duration-300
        group 
        relative 
        overflow-hidden
      `}
                  >
                    {/* BADGE STATUT + ICÔNE TYPE */}
                    <div className="absolute top-0 right-0 flex items-center gap-2">
                      {/* Icône type de projet */}
                      <div
                        className={`
          ${colors.iconBg}
          px-3 py-2 
          rounded-bl-xl 
          rounded-tr-xl
          text-2xl
        `}
                      >
                        {colors.icon}
                      </div>

                      {/* Badge statut */}
                      <div
                        className={`
          ${
            project.status === 'active'
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-400 text-white'
          }
          px-3 py-1 
          rounded-bl-xl 
          text-xs 
          font-bold 
          uppercase 
          tracking-wider
        `}
                      >
                        {project.status === 'active' ? '✓ Actif' : 'Brouillon'}
                      </div>
                    </div>

                    {/* CONTENU PRINCIPAL */}
                    <div className="p-6 pt-12">
                      {/* Titre avec barre colorée */}
                      <div
                        className={`
          border-l-4 
          ${colors.gradient.replace('from-', 'border-').split(' ')[0].replace('to-', '')}
          pl-3 
          mb-4
        `}
                      >
                        <h3 className="font-bold text-gray-900 text-xl mb-1 truncate pr-4">
                          {project.name}
                        </h3>
                        <p
                          className={`
            text-xs 
            font-semibold 
            uppercase 
            tracking-wide
            ${colors.iconColor}
          `}
                        >
                          {project.type || 'Non spécifié'}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-gray-600 line-clamp-2 h-10 mb-4 italic">
                        {project.description || 'Aucune description'}
                      </p>

                      {/* Dates + Type */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">
                            {formatDate(project.startDate || project.startdate)}
                          </span>
                        </div>

                        <span
                          className={`
            text-xs 
            px-3 
            py-1.5 
            rounded-full 
            font-bold
            ${isRecurrent ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'}
          `}
                        >
                          {isRecurrent ? '🔄 Récurrent' : '📅 Ponctuel'}
                        </span>
                      </div>

                      {/* SECTION BUDGET - VERSION AMÉLIORÉE */}
                      <div
                        className={`
          ${colors.budgetBg}
          rounded-xl 
          p-4 
          mb-4
          border-2
          ${colors.badge.split(' ')[2]}
        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <DollarSign className={`w-5 h-5 ${colors.iconColor}`} />
                            <span className="text-xs font-bold uppercase text-gray-600">
                              Budget Total
                            </span>
                          </div>
                          <div
                            className={`
              text-xl 
              font-black 
              ${colors.budgetText}
            `}
                          >
                            {formatCurrency(realCost)}
                          </div>
                        </div>
                      </div>

                      {/* BOUTONS D'ACTION - VERSION CONDENSÉE */}
                      <div className="flex justify-between items-center gap-2">
                        {/* Boutons principaux */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedProject(project)}
                            className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Voir détails"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => onEditProject(project)}
                            className="p-2.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Actions contextuelles */}
                        <div className="flex gap-1">
                          {project.status === 'active' && (
                            <>
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(`Marquer "${project.name}" comme terminé ?`)
                                  )
                                    return;
                                  try {
                                    await onCompleteProject(project.id);
                                    alert('Projet complété !');
                                  } catch (e) {
                                    alert('Erreur : ' + e.message);
                                  }
                                }}
                                className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                title="Marquer comme terminé"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>

                              <button
                                onClick={async () => {
                                  if (!confirm(`Désactiver "${project.name}" ?`)) return;
                                  try {
                                    await onDeactivateProject(project.id);
                                    alert('Projet désactivé !');
                                  } catch (e) {
                                    alert('Erreur : ' + e.message);
                                  }
                                }}
                                className="p-2.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Désactiver"
                              >
                                <AlertCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}

                          {project.status === 'paused' && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Réactiver "${project.name}" ?`)) return;
                                try {
                                  await onReactivateProject(project.id);
                                  alert('Projet réactivé !');
                                } catch (e) {
                                  alert('Erreur : ' + e.message);
                                }
                              }}
                              className="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                              title="Réactiver"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}

                          <button
                            onClick={() => onDeleteProject(project.id)}
                            className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* BANDE DÉCORATIVE BAS */}
                    <div
                      className={`
        h-2 
        bg-gradient-to-r 
        ${colors.gradient}
      `}
                    />
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
