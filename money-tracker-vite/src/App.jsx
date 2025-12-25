// ============================================================================
// FICHIER: src/App.jsx
// Description: Point d'entrée principal de l'application MoneyTracker
// Version: Refactorisée avec composants extraits et indentation corrigée
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  AlertTriangle,
  Edit2,
  Trash2,
  Save,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  FileText,
  Briefcase,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Wallet,
  CreditCard,
  Receipt,
  Package,
  Archive,
  BookOpen,
  FileSpreadsheet,
  Copy,
  ExternalLink,
  Lightbulb,
  Zap,
  Target,
} from 'lucide-react';


// ✅ HOOKS PERSONNALISÉS (uniquement ceux non remplacés par le contexte)
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';

// HOOKS / CONTEXT FINANCE
import { useFinance } from "./contexts/FinanceContext";

// ============================================================================
// SERVICES
// ============================================================================
import { API_BASE } from "./services/api";
import { parseJSONSafe, normalizeDate } from './domain/finance/parsers';
import { transactionSignature, deduplicateTransactions } from './domain/finance/signature';
import { createSignature } from "./utils/transactionUtils";
import { projectsService } from './services/projectsService'
import { fetchCsrfToken } from "./services/api";

// ✅ GARDER : Utilisé pour l'import bulk uniquement
import transactionsService from './services/transactionsService';

// ============================================================================
// COMPOSANTS - LAYOUT
// ============================================================================
import { Header } from "./components/layout/Header";
import { Navigation } from "./components/layout/Navigation";

// ============================================================================
// COMPOSANTS - COMPTES
// ============================================================================
import { AccountList } from "./components/accounts/AccountList";
import { AccountDetails } from "./components/accounts/AccountDetails";
import { AccountModal } from "./components/accounts/AccountModal";

// ============================================================================
// COMPOSANTS - TRANSACTIONS
// ============================================================================
import TransactionList from './components/transactions/TransactionList';
import { TransactionModal } from "./components/transactions/TransactionModal";
import CategoryBreakdown  from "./components/transactions/CategoryBreakdown";
import TransactionEditModal from './TransactionEditModal';
import { TransactionDetailsModal } from "./TransactionDetailsModal";

// ============================================================================
// COMPOSANTS - AUTRES FONCTIONNALITÉS
// ============================================================================
import ReceivablesScreen from "./components/ReceivablesScreen";
import NotesSlide from './components/NotesSlide';
import HumanResourcesPage from './HumanResourcesPage';
import TreasuryForecast from './components/TreasuryForecast';
import VisionBoard from './components/VisionBoard';

// ============================================================================
// COMPOSANTS - COMMUNS
// ============================================================================
import { Toast } from "./components/common/Toast";
import { StatCard } from "./components/common/StatCard";
import { PinInput } from "./components/common/PinInput";
import FinancialChart from './components/charts/FinancialChart';

// ============================================================================
// MODALS ET DASHBOARDS
// ============================================================================
import ImportModal from "./ImportModal";
import { BackupImportModal } from "./BackupImportModal";
import BookkeeperDashboard from "./BookkeeperDashboard";
import { OperatorDashboard } from "./OperatorDashboard";
import { ContentReplicator } from "./ContentReplicator";
import { ReportsModal } from "./ReportsModal";
import { ProjectPlannerHub } from "./components/projects/ProjectPlannerHub";
//import { ProjectPlannerModal } from "./ProjectPlannerModal";
import { ProjectsListModal } from "./ProjectsListModal";
import backupService from "./services/backupService";

// ============================================================================
// UTILITAIRES
// ============================================================================
import { formatCurrency } from "./utils/formatters";

// ============================================================================
// CONSTANTES
// ============================================================================

// Switch de debug pour réduire les logs en production
const DEBUG = false;

// Comptes par défaut à créer lors de l'initialisation
const DEFAULT_ACCOUNTS = [
  { name: "Argent Liquide", type: "cash", balance: 0 },
  { name: "MVola", type: "mobile", balance: 0 },
  { name: "Orange Money", type: "mobile", balance: 0 },
  { name: "Compte BOA", type: "bank", balance: 0 },
  { name: "Coffre", type: "cash", balance: 0 },
  { name: "Receivables", type: "receivables", balance: 0 },
  { name: "Redotpay", type: "digital", balance: 0 },
];

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================
export default function App() {
  // ✅ CONTEXTE FINANCE (source unique)
  const {
  accounts,
  transactions,
  projects,
  visibleTransactions,
  totalOpenReceivables,
  totalBalance,
  income,
  expense,
  deleteProject,
  activeProjects,
  activateProject,
  archiveProject,
  deactivateProject,
  treasuryAlerts,
  transactionStats,
  reactivateProject,
  remainingCostSum,
  projectsTotalRevenues,
  projectsNetImpact,
  projectsForecastCoffre,
  projectsForecastTotal,
  projectFilterId,
  completeProject,
  setProjectFilterId,
  accountFilterId,
  setAccountFilterId,
  refreshAccounts,
  refreshTransactions,
  refreshProjects,
  createAccount,
  updateAccount,
  deleteAccount,
  importTransactions,
  createTransaction, // ✅ AJOUTER ICI
  updateTransaction,
  deleteTransaction,
} = useFinance();


  // ✅ HOOKS PERSONNALISÉS (non remplacés par le contexte)
  const auth = useAuth();
  const { toast, showToast, hideToast } = useToast();

  // Projet PLG spécifique (utilisé dans certains workflows)
  const plgProject = projects?.find(p => p.name === 'PLG FLPT - Campagne Pêche Complete');
  const plgProjectId = plgProject?.id || null;


  // ==========================================================================
  // ÉTATS LOCAUX - INTERFACE UTILISATEUR
  // ==========================================================================
  
  // Navigation principale
  const [activeTab, setActiveTab] = useState("overview");
  const [activeView, setActiveView] = useState("dashboard");
  
  // Modals de création/édition
  const [showAdd, setShowAdd] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  // Modals de gestion
  const [showImport, setShowImport] = useState(false);
  const [showBackupImport, setShowBackupImport] = useState(false);
  const [showBookkeeper, setShowBookkeeper] = useState(false);
  const [showOperator, setShowOperator] = useState(false);
  const [showContentReplicator, setShowContentReplicator] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [showProjectsList, setShowProjectsList] = useState(false);
  const [transactionDetailsModal, setTransactionDetailsModal] = useState(null);
  const [showNotes, setShowNotes] = useState(false);

  // ========================================================================== 
// EFFETS - CHARGEMENT INITIAL
// ==========================================================================

// ✅ NOUVEAU : Initialisation CSRF au démarrage
useEffect(() => {
  const initCsrf = async () => {
    if (auth.isAuthenticated) {
      try {
        await fetchCsrfToken();
        console.log('✅ Protection CSRF activée');
      } catch (error) {
        console.warn('⚠️ CSRF init failed (non-bloquant):', error);
        // L'app continue de fonctionner en mode dégradé
      }
    }
  };

  initCsrf();
}, [auth.isAuthenticated]);

// Migration des projets depuis localStorage vers la base de données
useEffect(() => {
  const migrateProjects = async () => {
    try {
      const result = await projectsService.migrateFromLocalStorage();
      if (result.migrated > 0) {
        showToast(`✅ ${result.migrated} projets migrés vers la base de données`, "success");
        if (refreshProjects) refreshProjects();
      }
    } catch (error) {
      console.error("Migration échouée:", error);
    }
  };

  if (auth.isAuthenticated) {
    migrateProjects();
  }
}, [auth.isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ==========================================================================
  // HANDLERS - AUTHENTIFICATION
  // ==========================================================================
  const handleLogout = async () => {
    try {
      await auth.logout();
      showToast("Déconnexion réussie", "success");
    } catch (error) {
      showToast("Erreur lors de la déconnexion", "error");
    }
  };

  const handlePinSubmit = async (pin) => {
    try {
      if (!auth.hasPin) {
        // Création d'un nouveau PIN
        if (auth.pinStep === "enter") {
          auth.setFirstPin(pin);
          auth.setPinStep("confirm");
          return;
        }
        
        // Confirmation du PIN
        if (auth.pinStep === "confirm") {
          if (pin !== auth.firstPin) {
            showToast("Les PIN ne correspondent pas", "error");
            auth.setFirstPin("");
            auth.setPinStep("enter");
            return;
          }
          await auth.setupPin(auth.firstPin);
          showToast("PIN créé avec succès", "success");
        }
      } else {
        // Connexion avec PIN existant
        await auth.login(pin);
        showToast("Connexion réussie", "success");
      }
    } catch (error) {
      showToast(error.message || "Erreur de connexion", "error");
      auth.setFirstPin("");
      auth.setPinStep("enter");
    }
  };

  // ==========================================================================
  // HANDLERS - COMPTES
  // ==========================================================================
  const handleInitDefaults = async () => {
  if (!confirm('Voulez-vous créer les 7 comptes par défaut ?')) return;
  try {
    // ✅ Utiliser createAccount du contexte
    for (const account of DEFAULT_ACCOUNTS) {
      await createAccount(account);
    }
    showToast('Comptes créés avec succès !', 'success');
    await refreshAccounts();
  } catch (e) {
    console.error('Erreur init defaults:', e);
    showToast('Erreur lors de l\'initialisation', 'error');
  }
};

const handleCreateAccount = async (data) => {
  try {
    await createAccount(data); // ✅ contexte
    showToast(`Compte ${data.name} créé !`, "success");
    setShowAddAccount(false);
  } catch (e) {
    showToast("Erreur création compte", "error");
  }
};

const handleDeleteAccount = async (id) => {
  try {
    await deleteAccount(id); // ✅ contexte
    showToast("Supprimé", "success");
  } catch (e) {
    showToast("Erreur suppression", "error");
  }
};

  // ==========================================================================
  // HANDLERS - TRANSACTIONS
  // ==========================================================================
  const addTransaction = async (trx) => {
    try {
      await createTransaction({
        account_id: trx.accountId,
        type: trx.type,
        amount: trx.amount,
        category: trx.category,
        description: trx.description,
        date: trx.date,
      });
      showToast("Ajouté", "success");
      await refreshAccounts();
    } catch (e) {
      showToast("Erreur ajout", "error");
    }
  };

  const handleTransactionClick = (transaction) => {
    console.log('🖱️ Transaction cliquée:', transaction.id);
    setEditingTransaction(transaction);
  };

  const handleTransactionUpdate = async () => {
    await refreshAccounts();
    await refreshTransactions();
    setEditingTransaction(null);
  };

  const handleTransactionDelete = async () => {
    await refreshTransactions();
    await refreshAccounts();
    setEditingTransaction(null);
    console.log('✅ Transaction supprimée avec succès');
  };

  // ==========================================================================
  // HANDLERS - IMPORT CSV (VERSION SIMPLIFIÉE)
  // ==========================================================================
const handleImportTransactions = async (importedTransactions) => {
  console.log('📥 Début import CSV:', importedTransactions.length, 'transactions');
  
  if (!importedTransactions || importedTransactions.length === 0) {
    showToast('Aucune transaction à importer.', 'info');
    return;
  }

  try {
    // ✅ Déléguer toute la logique au contexte
    const result = await importTransactions(importedTransactions);

    if (result.success && result.imported > 0) {
      let summary = `✅ IMPORT CSV RÉUSSI !\n\n`;
      summary += `${result.imported} nouvelles transactions importées\n`;
      summary += `${result.duplicates} doublons ignorés (pré-analyse client)\n`;
      if (result.serverDuplicates > 0) {
        summary += `${result.serverDuplicates} doublons ignorés (serveur)\n`;
      }
      if (result.invalid > 0) {
        summary += `${result.invalid} transactions invalides ignorées\n`;
      }
      
      alert(summary);
      showToast(`${result.imported} transactions importées !`, 'success');
    } else if (result.imported === 0) {
      alert(`IMPORT CSV TERMINÉ\n\n` +
        `Nouvelles transactions: 0\n` +
        `Doublons ignorés: ${result.duplicates}\n` +
        (result.invalid > 0 ? `Transactions invalides: ${result.invalid}\n` : '') +
        `\nToutes les transactions du CSV existent déjà en base.`);
      showToast('Aucune nouvelle transaction à importer', 'info');
    } else {
      showToast(result.message || 'Import annulé', 'info');
    }

  } catch (error) {
    console.error('❌ Erreur import CSV:', error);
    showToast(`Erreur lors de l'import: ${error.message}`, 'error');
  }
};

  // ==========================================================================
  // HANDLERS - PROJETS
  // ==========================================================================
  const handleEditProject = (project) => {
    console.log("📝 Édition du projet:", project);
    setEditingProject(project);
    setShowProjectPlanner(true);
    setShowProjectsList(false);
  };

  const handleActivateProject = async (projectId) => {
  console.log('Activation projet ID:', projectId, '- type:', typeof projectId);
  const project = projects.find(p => String(p.id) === String(projectId));
  
  if (!project) {
    console.error('Projet introuvable !');
    alert('Projet introuvable');
    return;
  }

  console.log('Projet trouvé:', project.name, 'ID:', project.id);

  // Parser pour confirmation
  const parseExpenses = (data) => {
    if (!data || typeof data !== 'string') return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Parse expenses failed', e);
      return [];
    }
  };

  const parsedExpenses = parseExpenses(project.expenses);
  const parsedRevenues = parseExpenses(project.revenues);

  if (!confirm(`ACTIVATION: ${project.name}\nDépenses: ${parsedExpenses.length}\nRevenus: ${parsedRevenues.length} ?`)) {
    return;
  }

  try {
    const result = await activateProject(projectId);
    alert(`${project.name} ACTIVÉ ! ${result.transactionCount} transactions`);
  } catch (error) {
    console.error('Erreur activation', error);
    alert('Erreur : ' + error.message);
  }
  };

  const handleReactivateProject = async (projectId) => {
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    alert('Projet introuvable');
    return;
  }

  if (!confirm(`Réactiver le projet "${project.name}" ? Le projet sera inclus dans les calculs globaux.`)) {
    return;
  }

  try {
    await reactivateProject(projectId);
    alert(`✅ Projet "${project.name}" réactivé avec succès`);
  } catch (error) {
    console.error('Erreur réactivation', error);
    alert('Erreur: ' + error.message);
  }
};

// ✅ VERSION DEBUG pour voir l'erreur exacte
  const handleDeactivateProject = async (projectId) => {
  try {
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      throw new Error('Projet introuvable');
    }

    console.log('📦 Données du projet avant envoi:', {
      id: project.id,
      name: project.name,
      status: project.status,
      expenses: project.expenses,
      revenues: project.revenues,
      // ... voir toutes les propriétés
    });

    await deactivateProject(projectId);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erreur complète:', error);
    
    // ✅ AFFICHER LES 3 DÉTAILS DE VALIDATION
    if (error.details && Array.isArray(error.details)) {
      console.error('🔴 Détails de validation (3 erreurs):');
      error.details.forEach((detail, index) => {
        console.error(`  ${index + 1}.`, detail);
      });
    }
    
    throw error;
  }
  };

  // ✅ VERSION CORRIGÉE COMPLÈTE
  const activateProjectPhase = async (projectId, phaseName) => {
  const project = projects.find((p) => p.id === projectId);
  const phaseExpenses = JSON.parse(project.expenses).filter(
    (e) => e.phase === phaseName && e.account !== 'Futur' && parseFloat(e.amount) > 0
  );

  if (phaseExpenses.length === 0) {
    alert(`Phase "${phaseName}" vide ou déjà activée`);
    return;
  }

  const totalPhase = phaseExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  if (
    !confirm(
      `Activer Phase "${phaseName.toUpperCase()}" ?\n\n${phaseExpenses.length} lignes\n${formatCurrency(totalPhase)}`
    )
  ) {
    return;
  }

  try {
    let successCount = 0;

    for (const exp of phaseExpenses) {
      const targetAccount =
        accounts.find((a) => a.name === exp.account) || accounts.find((a) => a.type === 'cash');

      if (!targetAccount) {
        console.error('❌ Compte introuvable pour la dépense:', exp.description);
        continue;
      }

      // ✅ Utiliser createTransaction du contexte
      await createTransaction({
        accountid: targetAccount.id,
        type: 'expense',
        amount: parseFloat(exp.amount),
        category: `${project.name} - ${phaseName}`,
        description: exp.description,
        date: new Date().toISOString().split('T')[0],
        isplanned: false,
        isposted: true,
        projectid: projectId,
      });

      successCount++;
    }

    // Mise à jour du statut du projet
    const newStatus = `Phase ${phaseName} Active (${successCount}/${phaseExpenses.length})`;
    const token = localStorage.getItem('token');

    await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...project, status: newStatus }),
    });

    await refreshProjects(); // ✅ Contexte
    await refreshTransactions(); // ✅ Contexte
    await refreshAccounts(); // ✅ Contexte

    alert(`✅ Phase "${phaseName}" activée !\n${successCount} transactions créées`);
  } catch (error) {
    alert(`❌ Erreur: ${error.message}`);
  }
    };
  
  // Fonction handleArchiveProject (ligne ~650-700)
const handleArchiveProject = async (projectId) => {
  if (!window.confirm('Archiver ce projet ?\n\nIl sera marqué comme terminé et conservé dans les archives.')) {
    return;
  }
  
  try {
    // ✅ Récupérer le projet complet avant de l'archiver
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error('Projet introuvable');
    }

    // ✅ Utiliser completeProject au lieu de archiveProject
    await completeProject(projectId);
    
    alert('✅ Projet archivé avec succès !');
  } catch (e) {
    console.error('Erreur archivage:', e);
    alert('❌ Erreur: ' + e.message);
  }
};

  const handleCompleteProject = async (projectId) => {
  if (!window.confirm('Marquer ce projet comme terminé et l\'archiver ?')) return;

  try {
    await archiveProject(projectId);
    alert('Projet archivé avec succès.');
  } catch (e) {
    console.error('Erreur archivage', e);
    alert('Erreur archivage: ' + e.message);
  }
  };

  // ✅ VERSION CORRIGÉE COMPLÈTE
const handleProjectUpdated = async (projectId) => {
  // ✅ Rafraîchir via le contexte uniquement
  await refreshProjects();
  await refreshTransactions();
  await refreshAccounts();
};

  // ==========================================================================
  // HANDLERS - BACKUP ET RESTAURATION
  // ==========================================================================
  const handleExportBackup = async () => {
    try {
      const defaultLabel = `snapshot-${new Date().toISOString().split("T")[0]}`;
      const label = prompt("Label du backup ? (ex: post-migration-receivables)", defaultLabel);
      if (label === null) return;

      // Récupérer le backup complet depuis le serveur
      const backupData = await backupService.fetchFull();

      console.log('📦 Backup récupéré:', {
        accounts: backupData.accounts?.length,
        transactions: backupData.transactions?.length,
        receivables: backupData.receivables?.length,
        projects: backupData.projects?.length
      });

      // Créer le backup sur le serveur avec les projets inclus
      const serverResult = await backupService.createLegacy(
        backupData.accounts,
        backupData.transactions,
        backupData.receivables || [],
        backupData.projects || [],
        label
      );

      console.log("✅ Backup serveur créé:", serverResult);

      const wantsLocal = confirm(
        `Backup serveur créé:\n\n` +
        `- Fichier: ${serverResult.filename}\n` +
        `${serverResult.label ? `- Label: ${serverResult.label}\n` : ""}\n` +
        `Voulez-vous aussi télécharger ce backup en local ?`
      );

      if (wantsLocal) {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const filename = `moneytracker_full_backup_${new Date().toISOString().split("T")[0]}_${label.replace(/[^a-zA-Z0-9-_]+/g, "_")}.json`;

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast(`✅ Backup serveur + local: ${filename}`, "success");
      } else {
        showToast(`✅ Backup serveur créé: ${serverResult.filename}`, "success");
      }
    } catch (error) {
      console.error("❌ Erreur backup:", error);
      showToast(`Erreur backup: ${error.message}`, "error");
    }
  };

  const handleRestoreSuccess = async () => {
    await refreshAccounts();
    await refreshTransactions();
    showToast("Restauré avec succès !", "success");
  };

  // ==========================================================================
  // HANDLERS - MODALS
  // ==========================================================================
  const openTransactionDetails = (type) => {
    setTransactionDetailsModal(type);
  };

  // LOADING STATE
  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-16 w-16 border-b-4 border-indigo-600 rounded-full" />
      </div>
    );
  }

  // PIN SCREEN
  if (!auth.isAuthenticated) {
    const title = !auth.hasPin
      ? auth.pinStep === "enter"
        ? "Créer un PIN (6 chiffres)"
        : "Confirmer votre PIN"
      : "Saisissez votre PIN";
    return <PinInput onSubmit={handlePinSubmit} title={title} />;
  }

  // MAIN RENDER
  return (
  <>
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    )}

   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50">
      <Header
        onAddTransaction={() => setShowAdd(true)}
        onLogout={handleLogout}
        onImport={() => setShowImport(true)}
        onRestore={() => setShowBackupImport(true)}
        onBackup={handleExportBackup}
        onShowNotes={() => setShowNotes(true)} 
        onShowBookkeeper={() => setShowBookkeeper(true)}
        onShowOperator={() => setShowOperator(true)}
        onShowContent={() => setShowContentReplicator(true)}
        onShowReports={() => setShowReports(true)}
        onShowProjectPlanner={() => setShowProjectPlanner(true)}
        onShowProjectsList={() => setShowProjectsList(true)}
      />

      <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="px-8 py-8">
          {activeTab === "overview" && (
            <div className="space-y-8">
              
              {/* --- 1. ALERTES --- */}
              {treasuryAlerts.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
                    <div>
                      <h3 className="text-red-800 font-bold">Attention : Trésorerie tendue</h3>
                      <div className="mt-1 text-sm text-red-700">
                       {treasuryAlerts.map((a) => (
                          <div key={a.id}>â€¢ <strong>{a.account}</strong> risque découvert (Proj: {formatCurrency(a.projected)})</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

             {/* --- 2. KPI CARDS --- */}
<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
  
  {/* 1️⃣ Solde Total - Card Premium Noire */}
  <div className="
    bg-gradient-to-br from-slate-700 to-slate-900 
    p-5 rounded-xl shadow-lg 
    border-2 border-slate-600
    hover:shadow-xl 
    transition-all duration-300
  ">
    <div className="flex items-center gap-3 mb-3">
      <div className="bg-slate-600 p-2.5 rounded-lg">
        <Wallet className="w-5 h-5 text-white" strokeWidth={2.5} />
      </div>
      <h3 className="text-slate-300 text-xs font-bold uppercase tracking-wider">
        Solde Total
      </h3>
    </div>
    <p className="text-3xl font-black text-white tracking-tight">
      {formatCurrency(totalBalance)}
    </p>
  </div>

  {/* 2️⃣ Encaissements - Vert Émeraude */}
  <button
    onClick={() => openTransactionDetails("income")}
    className="
      bg-gradient-to-br from-emerald-50 to-teal-50 
      p-5 rounded-xl shadow-md 
      border-2 border-emerald-300
      hover:shadow-lg hover:scale-[1.02] 
      transition-all duration-300 
      text-left
    "
  >
    <div className="flex items-center justify-between mb-2">
      <div className="bg-emerald-100 p-2 rounded-lg">
        <TrendingUp className="w-4 h-4 text-emerald-700" strokeWidth={2.5} />
      </div>
      <span className="text-sm font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
        {transactionStats.income} trx
      </span>
    </div>
    <h3 className="text-emerald-700 text-[10px] font-bold mb-1.5 uppercase tracking-widest">
      Encaissements
    </h3>
    <p className="text-2xl font-black text-emerald-900">
      {formatCurrency(income)}
    </p>
  </button>

  {/* 3️⃣ Dépenses - Rose Doux */}
  <button
    onClick={() => openTransactionDetails("expense")}
    className="
      bg-gradient-to-br from-rose-50 to-pink-50 
      p-5 rounded-xl shadow-md 
      border-2 border-rose-300
      hover:shadow-lg hover:scale-[1.02] 
      transition-all duration-300 
      text-left
    "
  >
    <div className="flex items-center justify-between mb-2">
      <div className="bg-rose-100 p-2 rounded-lg">
        <TrendingDown className="w-4 h-4 text-rose-700" strokeWidth={2.5} />
      </div>
      <span className="text-sm font-extrabold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md">
        {transactionStats.expense} trx
      </span>
    </div>
    <h3 className="text-rose-700 text-[10px] font-bold mb-1.5 uppercase tracking-widest">
      Dépenses
    </h3>
    <p className="text-2xl font-black text-rose-900">
      {formatCurrency(expense)}
    </p>
  </button>

  {/* 4️⃣ MY TEAM - Bleu Professionnel */}
  <button
    onClick={() => setActiveTab('hr')}
    className="
      bg-gradient-to-br from-blue-50 to-indigo-50 
      p-5 rounded-xl shadow-md 
      border-2 border-blue-300
      hover:shadow-lg hover:scale-[1.02] 
      transition-all duration-300 
      text-left
    "
  >
    <div className="flex items-center justify-center mb-2">
      <div className="bg-blue-100 p-2.5 rounded-lg">
        <Briefcase className="w-5 h-5 text-blue-700" strokeWidth={2.5} />
      </div>
    </div>
    <h3 className="text-blue-700 text-[10px] font-bold mb-1.5 text-center uppercase tracking-widest">
      Ressources Humaines
    </h3>
    <p className="text-xl font-black text-blue-900 text-center">
      MY TEAM
    </p>
  </button>

  {/* 5️⃣ VISION & OBJECTIFS - Ambre Chaleureux */}
  <button
    onClick={() => setActiveTab('vision')}
    className="
      bg-gradient-to-br from-amber-50 to-orange-50 
      p-5 rounded-xl shadow-md 
      border-2 border-amber-300
      hover:shadow-lg hover:scale-[1.02] 
      transition-all duration-300 
      text-left
    "
  >
    <div className="flex items-center justify-center mb-2">
      <div className="bg-amber-100 p-2.5 rounded-lg">
        <Target className="w-5 h-5 text-amber-700" strokeWidth={2.5} />
      </div>
    </div>
    <h3 className="text-amber-700 text-[10px] font-bold mb-1.5 text-center uppercase tracking-widest">
      Stratégie & Croissance
    </h3>
    <p className="text-xl font-black text-amber-900 text-center">
      VISION & OBJECTIFS
    </p>
  </button>
</div>


              {/* --- 3. PREVISIONS --- */}
            <TreasuryForecast 
            accounts={accounts}
            projects={activeProjects}
            />
              {/* --- 4. COMPTES --- */}
              <AccountList
                accounts={accounts}
                onSelectAccount={(acc) =>
                acc.name === "Receivables"
                  ? setActiveTab("receivables")
                   : setSelectedAccount(acc)
                  }
                onAddAccount={() => setShowAddAccount(true)}
               onDeleteAccount={handleDeleteAccount}
                onInitDefaults={handleInitDefaults}
              />

              {/* --- 5. GRAPHIQUE & TRANSACTIONS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Colonne Gauche : Graphique */}
                <div className="lg:col-span-2">
                   <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 h-full">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Flux Financiers (30 Jours)</h3>
                      <div className="w-full h-96">
                        <FinancialChart transactions={transactions} />
                      </div>
                   </div>
                </div>

                {/* Colonne Droite : Dernières Transactions */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <TransactionList
                    transactions={transactions?.slice(0, 5) || []}
                    onViewAll={() => setActiveTab("transactions")}
                    onDelete={deleteTransaction}
                    onTransactionClick={handleTransactionClick}
                    compact={true} // Optionnel si votre composant supporte un mode compact
                  />
                </div>
              </div>

              {/* --- 6. REPARTITION --- */}
              <div className="w-full">
                <CategoryBreakdown transactions={transactions} onTransactionClick={handleTransactionClick} />
              </div>
            </div>
          )}

          {/* --- ONGLETS SECONDAIRES --- */}
          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <select className="border rounded px-2 py-1 text-sm bg-white" value={projectFilterId || ""} onChange={e => setProjectFilterId(e.target.value || null)}>
                  <option value="">Tous Projets</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="border rounded px-2 py-1 text-sm bg-white" value={accountFilterId || ""} onChange={e => setAccountFilterId(e.target.value || null)}>
                  <option value="">Tous Comptes</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {(projectFilterId || accountFilterId) && <button onClick={() => { setProjectFilterId(null); setAccountFilterId(null); }} className="text-indigo-600 text-xs hover:underline">Reset</button>}
              </div>
              <TransactionList transactions={visibleTransactions} onDelete={deleteTransaction} onTransactionClick={handleTransactionClick} />
            </div>
          )}

          {activeTab === "receivables" && (
            <ReceivablesScreen
              token={localStorage.getItem("token")}
              accounts={accounts}
              onAfterChange={async () => { await refreshAccounts(); }}
            />
          )}
          {/* Remplacer activeView === 'hr' par activeTab === 'hr' */}
          {activeTab === 'hr' && (
  <HumanResourcesPage 
    projects={projects} // ✅ Passer les projets depuis useFinance
  />
)}
          {/* ✅ VISION BOARD */}
          {activeTab === 'vision' && <VisionBoard />}
        </main>
      </div>

      {/* --- MODALS GLOBAUX --- */}
      {showAdd && (
        <TransactionModal
          onClose={() => setShowAdd(false)}
          projects={projects}  // ✅ Passe la liste des projets
          accounts={accounts}
          onSave={async (tx) => {
            try {
              await createTransaction({
                account_id: tx.accountId,
                type: tx.type,
                amount: tx.amount,
                category: tx.category,
                description: tx.description,
                date: tx.date,
                project_id: tx.projectId || null,  // ✅ Utilise le projet du formulaire
                is_posted: true,
                is_planned: false,
              });
              showToast("Transaction enregistrée", "success");
              await refreshAccounts();
              await refreshTransactions();
            } catch (e) {
              showToast("Erreur ajout transaction", "error");
            }
          }}
        />
      )}

      {showAddAccount && <AccountModal onClose={() => setShowAddAccount(false)} onSave={handleCreateAccount} />}
      {showImport && <ImportModal isOpen={showImport} accounts={accounts} onClose={() => setShowImport(false)} onImport={handleImportTransactions} />}
      {showBackupImport && <BackupImportModal onClose={() => setShowBackupImport(false)} onRestoreSuccess={handleRestoreSuccess} />}
      {selectedAccount && <AccountDetails account={selectedAccount} transactions={transactions} onClose={() => setSelectedAccount(null)} onDeleteTransaction={(id) => deleteTransaction(id)} />}
      {showReports && <ReportsModal onClose={() => setShowReports(false)} transactions={transactions} accounts={accounts} />}
      {showBookkeeper && (
  <BookkeeperDashboard
    onClose={() => setShowBookkeeper(false)}
    transactions={transactions}
    accounts={accounts}
    projects={projects}
  />
)}
      {showOperator && <OperatorDashboard onClose={() => setShowOperator(false)} projects={projects} transactions={transactions} accounts={accounts} />}
      {showContentReplicator && <ContentReplicator onClose={() => setShowContentReplicator(false)} />}
      
      <ProjectsListModal
        isOpen={showProjectsList}
        onClose={() => setShowProjectsList(false)}
        onNewProject={() => { setEditingProject(null); setShowProjectPlanner(true); }}
        onEditProject={handleEditProject}
        onActivateProject={handleActivateProject}
        onDeleteProject={deleteProject}
        onCompleteProject={handleCompleteProject}
        onProjectUpdate={refreshProjects}
        onDeactivateProject={deactivateProject} // ✅ Nouveau
        onReactivateProject={handleReactivateProject}  // ✅ AJOUTER ICI
        onTransactionClick={handleTransactionClick}
        accounts={accounts}
        projects={projects}
        transactions={transactions}
        totalBalance={totalBalance}
      />

    <ProjectPlannerHub
  isOpen={showProjectPlanner}
  onClose={() => {
    setShowProjectPlanner(false);
    setEditingProject(null);
  }}
  accounts={accounts}
  project={editingProject}
  onProjectSaved={handleProjectUpdated}
  onProjectUpdated={handleProjectUpdated}
  createTransaction={createTransaction}
/>

      {editingTransaction && (
        <TransactionEditModal
          transaction={editingTransaction}
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onDelete={handleTransactionDelete} // Appel du wrapper
          onDeleted={handleTransactionDelete} // Appel du wrapper
          onUpdate={handleTransactionUpdate}
          accounts={accounts}
        />
      )}

      {transactionDetailsModal && (
        <TransactionDetailsModal
          type={transactionDetailsModal}
          transactions={transactions}
          onClose={() => setTransactionDetailsModal(null)}
        />
      
      )}
      {/* ✅ AJOUTER ICI: NotesSlide en Modal */}
      <NotesSlide
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
      />
    </>
  );
}
