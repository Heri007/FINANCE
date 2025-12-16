// ============================================================================
// FICHIER: src/App.jsx
// Description: Point d'entrée principal de l'application MoneyTracker
// Version: Refactorisée avec composants extraits et indentation corrigée
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { 
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Briefcase 
} from "lucide-react";

// ============================================================================
// HOOKS PERSONNALISÉS
// ============================================================================
import { useAuth } from "./hooks/useAuth";
import { useAccounts } from "./hooks/useAccounts";
import { useTransactions } from "./hooks/useTransactions";
import { useToast } from "./hooks/useToast";
import { useProjects } from "./hooks/useProjects";

// HOOKS / CONTEXT FINANCE
import { useFinance } from "./contexts/FinanceContext";

// ============================================================================
// SERVICES
// ============================================================================
import { accountsService } from "./services/accountsService";
import { transactionsService } from "./services/transactionsService";
import { projectsService } from "./services/projectsService";
import { API_BASE } from "./services/api";
import { normalizeDate } from './domain/finance/parsers';
import { buildTransactionSignature } from './domain/finance/signature';
import { createSignature } from "./utils/transactionUtils";

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
import { CategoryBreakdown } from "./components/transactions/CategoryBreakdown";
import TransactionEditModal from './TransactionEditModal';
import { TransactionDetailsModal } from "./TransactionDetailsModal";

// ============================================================================
// COMPOSANTS - AUTRES FONCTIONNALITÉS
// ============================================================================
import ReceivablesScreen from "./components/ReceivablesScreen";
import NotesSlide from './components/NotesSlide';
import HumanResourcesPage from './HumanResourcesPage';
import TreasuryForecast from './components/TreasuryForecast';

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
import { ProjectPlannerModal } from "./ProjectPlannerModal";
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
  { name: "Avoir", type: "credit", balance: 0 },
  { name: "Redotpay", type: "digital", balance: 0 },
];

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================
export default function App() {
  const {
  accounts,
  createAccount,
  deleteAccount,
  transactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  projects,
  visibleTransactions,
  totalOpenReceivables,
  totalBalance,
  income,
  expense,
  accountsWithCorrectAvoir,
  activeProjects,
  remainingCostSum,
  projectsTotalRevenues,
  projectsNetImpact,
  projectsForecastCoffre,
  projectsForecastTotal,
  projectFilterId,
  setProjectFilterId,
  accountFilterId,
  setAccountFilterId,
  refreshAccounts,
  refreshTransactions,
  refreshProjects,
} = useFinance();

  // ==========================================================================
  // HOOKS PERSONNALISÉS
  // ==========================================================================
  
  const auth = useAuth();
  const { toast, showToast, hideToast } = useToast();
  
  // ==========================================================================
  // ÉTATS LOCAUX - DONNÉES
  // ==========================================================================
  
  // Projet PLG spécifique (utilisé dans certains workflows)
  const plgProject = projects.find(p => p.name === "PLG FLPT - Campagne Pêche Complete");
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

  // ==========================================================================
  // EFFETS - CHARGEMENT INITIAL
  // ==========================================================================
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
  if (!confirm("Voulez-vous créer les 7 comptes par défaut ?")) return;
  
  try {
    await Promise.all(
      DEFAULT_ACCOUNTS.map((account) => accountsService.create(account))
    );
    showToast("Comptes créés avec succès !", "success");
    await refreshAccounts(); // ✅ contexte
  } catch (e) {
    showToast("Erreur lors de l'initialisation", "error");
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
    await refreshAccounts()();
    await transactionsHook.refreshTransactions();
    setEditingTransaction(null);
  };

  const handleTransactionDelete = async () => {
    await transactionsHook.refreshTransactions();
    await refreshAccounts();
    setEditingTransaction(null);
    console.log('✅ Transaction supprimée avec succès');
  };

  // ==========================================================================
  // HANDLERS - IMPORT CSV
  // ==========================================================================
  
  const handleImportTransactions = async (importedTransactions) => {
    console.log("🔄 Import CSV incrémental...", importedTransactions.length);

    if (!importedTransactions || importedTransactions.length === 0) {
      showToast("Aucune transaction à importer.", "info");
      return;
    }

    try {
      // --- ÉTAPE 1: Récupérer les transactions existantes ---
      console.log("📥 Chargement des transactions existantes...");
      const existingTransactions = await transactionsService.getAll();
      console.log(`📊 ${existingTransactions.length} transactions en base`);

      // --- ÉTAPE 2: Créer un index des signatures existantes ---
      const existingSignatures = new Map();
      existingTransactions.forEach((t) => {
        const sig = createSignature(
          t.account_id || t.accountId,
          t.transaction_date || t.transactionDate || t.date,
          t.amount,
          t.type,
          t.description
        );
        if (sig) {
          existingSignatures.set(sig, {
            id: t.id,
            description: t.description,
            amount: t.amount,
            date: t.transaction_date || t.date,
          });
        }
      });

      console.log(`🔑 ${existingSignatures.size} signatures uniques indexées`);

      // --- ÉTAPE 3: Filtrer les transactions à importer ---
      const newTransactions = [];
      const duplicates = [];
      const invalid = [];

      importedTransactions.forEach((trx, index) => {
        const sig = createSignature(
          trx.account_id || trx.accountId,
          trx.transaction_date || trx.date,
          trx.amount,
          trx.type,
          trx.description
        );

        if (!sig) {
          invalid.push({
            index: index + 1,
            reason: "Données invalides (date, montant ou compte manquant)",
            trx,
          });
          return;
        }

        if (existingSignatures.has(sig)) {
          const existing = existingSignatures.get(sig);
          duplicates.push({
            index: index + 1,
            sig,
            csv: trx,
            existing: existing,
            reason: "Transaction identique déjà en base",
          });
        } else {
          newTransactions.push(trx);
          existingSignatures.set(sig, { new: true });
        }
      });

      // --- ÉTAPE 4: Afficher le résumé d'analyse ---
      console.log(`\n📊 === ANALYSE DES DONNÉES CSV ===`);
      console.log(`📥 Total CSV: ${importedTransactions.length}`);
      console.log(`✅ Nouvelles: ${newTransactions.length}`);
      console.log(`⚠️ Doublons: ${duplicates.length}`);
      console.log(`❌ Invalides: ${invalid.length}`);

      if (duplicates.length > 0 && duplicates.length <= 5) {
        console.log(`\n🔍 Exemples de doublons détectés:`);
        duplicates.slice(0, 5).forEach((dup) => {
          console.log(`  - ${dup.csv.description} (${dup.csv.amount} Ar, ${dup.csv.date})`);
          console.log(`    → Existe en base avec ID ${dup.existing.id}`);
        });
      }

      // --- ÉTAPE 5: Arrêter si aucune nouvelle transaction ---
      if (newTransactions.length === 0) {
        const msg = `
📊 IMPORT CSV TERMINÉ

✅ Nouvelles transactions: 0
⚠️ Doublons ignorés: ${duplicates.length}
❌ Transactions invalides: ${invalid.length}

${duplicates.length > 0 ? "✅ Toutes les transactions du CSV existent déjà en base." : ""}
${invalid.length > 0 ? `⚠️ ${invalid.length} transactions ont été ignorées (données invalides).` : ""}
        `;
        alert(msg.trim());
        showToast("Aucune nouvelle transaction à importer", "info");
        return;
      }

      // --- ÉTAPE 6: Calculer l'impact sur les soldes par compte ---
      const impactByAccount = {};
      newTransactions.forEach((trx) => {
        const accId = trx.accountId;
        if (!impactByAccount[accId]) {
          const account = accounts.find((a) => a.id === accId);
          impactByAccount[accId] = {
            name: account?.name || "Compte inconnu",
            currentBalance: parseFloat(account?.balance || 0),
            income: 0,
            expense: 0,
            count: 0,
          };
        }

        impactByAccount[accId].count++;
        if (trx.type === "income") {
          impactByAccount[accId].income += trx.amount;
        } else {
          impactByAccount[accId].expense += trx.amount;
        }
      });

      // --- ÉTAPE 7: Afficher la confirmation avec impact détaillé ---
      let impactDetails = "\n💰 IMPACT SUR LES SOLDES:\n\n";
      Object.values(impactByAccount).forEach((acc) => {
        const netImpact = acc.income - acc.expense;
        const newBalance = acc.currentBalance + netImpact;
        const sign = netImpact >= 0 ? "+" : "";

        impactDetails += `${acc.name} (${acc.count} trx):\n`;
        impactDetails += `  Solde actuel: ${acc.currentBalance.toLocaleString("fr-FR")} Ar\n`;
        if (acc.income > 0) {
          impactDetails += `  + Revenus: ${acc.income.toLocaleString("fr-FR")} Ar\n`;
        }
        if (acc.expense > 0) {
          impactDetails += `  - Dépenses: ${acc.expense.toLocaleString("fr-FR")} Ar\n`;
        }
        impactDetails += `  → Nouveau solde: ${newBalance.toLocaleString("fr-FR")} Ar (${sign}${netImpact.toLocaleString("fr-FR")})\n\n`;
      });

      const confirmMsg = `
📊 IMPORT CSV - CONFIRMATION

✅ Nouvelles transactions: ${newTransactions.length}
⚠️ Doublons ignorés: ${duplicates.length}
${invalid.length > 0 ? `❌ Invalides ignorées: ${invalid.length}\n` : ""}
${impactDetails}
Voulez-vous importer ces ${newTransactions.length} nouvelles transactions ?
      `;

      if (!confirm(confirmMsg.trim())) {
        showToast("Import annulé.", "info");
        return;
      }

      // --- ÉTAPE 8: Importer les nouvelles transactions via endpoint bulk ---
      console.log(`\n📤 Import de ${newTransactions.length} transactions...`);

      const payload = newTransactions.map(t => ({
        account_id: t.accountId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        transaction_date: t.date,
        is_planned: false,
        is_posted: true,
        project_id: t.projectId || null,
        remarks: t.remarks || ''
      }));

      const result = await transactionsService.importTransactions(payload);
      const successCount = Number(result?.imported || 0);
      const serverDuplicates = Number(result?.duplicates || 0);

      console.log(`\n✅ Import terminé: ${successCount}/${newTransactions.length} réussies`);

      if (successCount > 0) {
        // --- ÉTAPE 9: Recalculer tous les soldes ---
        console.log("🔄 Recalcul des soldes...");
        const token = localStorage.getItem("token");

        try {
          const response = await fetch(`${API_BASE}/accounts/recalculate-all`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();

            let summary = `✅ IMPORT CSV RÉUSSI !\n\n`;
            summary += `📥 ${successCount} nouvelles transactions importées\n`;
            summary += `⚠️ ${duplicates.length} doublons ignorés (pré-analyse client)\n`;
            summary += `⚠️ ${serverDuplicates} doublons ignorés (serveur)\n`;
            if (invalid.length > 0) summary += `⚠️ ${invalid.length} transactions invalides ignorées\n`;

            alert(summary);
            showToast(`${successCount} transactions importées !`, "success");
          } else {
            console.error("❌ Erreur recalcul soldes:", response.status);
            showToast(
              `${successCount} transactions importées mais erreur lors du recalcul des soldes`,
              "warning"
            );
          }
        } catch (recalcError) {
          console.error("❌ Erreur recalcul:", recalcError);
          showToast(
            `${successCount} transactions importées mais erreur lors du recalcul des soldes`,
            "warning"
          );
        }

        // --- ÉTAPE 10: Rafraîchir l'interface ---
        await refreshAccounts();
        await transactionsHook.refreshTransactions();
      } else {
        alert(
          `📊 IMPORT CSV TERMINÉ\n\n` +
          `✅ Importées: 0\n` +
          `⚠️ Doublons (client): ${duplicates.length}\n` +
          `⚠️ Doublons (serveur): ${serverDuplicates}\n` +
          `❌ Invalides: ${invalid.length}\n`
        );
        showToast("Aucune transaction importée (tout doublon ou invalide).", "info");
      }
    } catch (error) {
      console.error("❌ Erreur import CSV:", error);
      showToast(`Erreur lors de l'import: ${error.message}`, "error");
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
    console.log('Activation projet ID:', projectId, 'type:', typeof projectId);
    const project = projects.find(p => String(p.id) === String(projectId));
    
    if (!project) {
      console.error('Projet introuvable !');
      alert('Projet introuvable');
      return;
    }
    
    console.log('Projet trouvé:', project.name, 'ID:', project.id);
    
    const parseExpenses = (data) => {
      if (!data || typeof data !== 'string') return [];
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('Parse expenses failed:', e);
        return [];
      }
    };
    
    const parsedExpenses = parseExpenses(project.expenses);
    const parsedRevenues = parseExpenses(project.revenues);
    
    if (!confirm(`ACTIVATION: ${project.name}\nDépenses: ${parsedExpenses.length}\nRevenus: ${parsedRevenues.length}\nConfirmer ?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const newTransactions = [];
      
      // Créer les transactions de dépenses
      for (const exp of parsedExpenses) {
        const acc = accounts.find(a => a.name === exp.account);
        if (acc) {
          await transactionsService.create({
            accountid: acc.id,
            type: 'expense',
            amount: parseFloat(exp.amount),
            category: project.name,
            description: exp.description,
            date: new Date().toISOString().split('T')[0],
            projectid: projectId,
            is_planned: false,
            is_posted: true
          });
          newTransactions.push(exp);
        }
      }
      
      // Créer les transactions de revenus
      for (const rev of parsedRevenues) {
        const acc = accounts.find(a => a.name === rev.account);
        if (acc) {
          await transactionsService.create({
            accountid: acc.id,
            type: 'income',
            amount: parseFloat(rev.amount),
            category: project.name,
            description: rev.description,
            date: new Date().toISOString().split('T')[0],
            projectid: projectId,
            is_planned: false,
            is_posted: true
          });
          newTransactions.push(rev);
        }
      }
      
      // Mettre à jour le statut du projet
      const updateResponse = await fetch(`${API_BASE}/projects/${projectId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'active' })
      });
      
      await refreshProjects();
      await transactionsHook.refreshTransactions();
      await refreshAccounts();
      
      alert(`${project.name} ACTIVÉ !\n${newTransactions.length} transactions`);
    } catch (error) {
      console.error('Erreur activation:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  const activateProjectPhase = async (projectId, phaseName) => {
    const project = projects.find(p => p.id === projectId);
    const phaseExpenses = JSON.parse(project.expenses)
      .filter(e => e.phase === phaseName && e.account !== 'Futur' && parseFloat(e.amount) > 0);
    
    if (phaseExpenses.length === 0) {
      alert(`Phase "${phaseName}" vide ou déjà active`);
      return;
    }
    
    const totalPhase = phaseExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    if (!confirm(`Activer Phase "${phaseName.toUpperCase()}" ?\n${phaseExpenses.length} lignes\n${formatCurrency(totalPhase)}`)) {
      return;
    }
    
    try {
      let successCount = 0;
      const token = localStorage.getItem('token');
      
      for (const exp of phaseExpenses) {
        const targetAccount = accounts.find(a => a.name === exp.account) || accounts.find(a => a.type === 'cash');
        
        if (!targetAccount) {
          console.error('Compte introuvable pour la dépense', exp.description);
          continue;
        }
        
        await transactionsService.create({
          accountid: targetAccount.id,
          type: 'expense',
          amount: parseFloat(exp.amount),
          category: `${project.name} - ${phaseName}`,
          description: exp.description,
          date: new Date().toISOString().split('T')[0],
          is_planned: false,
          is_posted: true,
          projectid: projectId
        });
        
        successCount++;
      }
      
      // Mise à jour du statut du projet
      const newStatus = `Phase ${phaseName} Active (${successCount}/${phaseExpenses.length})`;
      await fetch(`${API_BASE}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...project, status: newStatus })
      });
      
      await refreshProjects();
      await transactionsHook.refreshTransactions();
      await refreshAccounts();
      
      alert(`Phase "${phaseName}" active !\n${successCount} transactions créées`);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  const handleCompleteProject = async (projectId) => {
    if (!window.confirm("Marquer ce projet comme terminé et l'archiver ?")) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_BASE}/projects/${projectId}/archive`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur archivage projet");
      }

      await refreshProjects();
      await transactionsHook.refreshTransactions();
      await refreshAccounts();

      alert("Projet archivé avec succès.");
    } catch (e) {
      console.error("❌ Erreur archivage:", e);
      alert("Erreur archivage: " + e.message);
    }
  };

  const handleProjectUpdated = async (projectId) => {
    await refreshProjects();
    await transactionsHook.refreshTransactions();
    await refreshAccounts();
  };

  // ==========================================================================
  // HANDLERS - BACKUP ET RESTAURATION
  // ==========================================================================
  
  const handleExportBackup = async () => {
    try {
      const defaultLabel = `snapshot-${new Date().toISOString().split("T")[0]}`;
      const label = prompt("Label du backup ? (ex: post-migration-AVOIR)", defaultLabel);
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
    await arefreshAccounts();
    await transactionsHook.refreshTransactions();
    showToast("Restauré avec succès !", "success");
  };

  // ==========================================================================
  // HANDLERS - MODALS
  // ==========================================================================
  
  const openTransactionDetails = (type) => {
    setTransactionDetailsModal(type);
  };

// --- ALERTES TRÉSORERIE ---
const alerts = useMemo(() => {
  const warnings = [];

  accounts.forEach(acc => {
    let projectedBalance = parseFloat(acc.balance || 0);

    const plannedTrx = transactions.filter(t =>
      String(t.account_id || t.accountId) === String(acc.id) &&
      (t.is_planned === true || t.is_posted === false)
    );

    plannedTrx.forEach(t => {
      if (t.type === "income") projectedBalance += parseFloat(t.amount || 0);
      else projectedBalance -= parseFloat(t.amount || 0);
    });

    if (projectedBalance < 0) {
      warnings.push({
        id: acc.id,
        account: acc.name,
        current: parseFloat(acc.balance || 0),
        projected: projectedBalance,
      });
    }
  });

  return warnings;
}, [accounts, transactions]);


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

console.log(accountsWithCorrectAvoir)

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

    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <Header
        onAddTransaction={() => setShowAdd(true)}
        onLogout={handleLogout}
        onImport={() => setShowImport(true)}
        onRestore={() => setShowBackupImport(true)}
        onBackup={handleExportBackup}
        onShowNotes={() => setActiveTab("notes")}
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
              {alerts.length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                  <div className="flex items-start">
                    <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
                    <div>
                      <h3 className="text-red-800 font-bold">Attention : Trésorerie tendue</h3>
                      <div className="mt-1 text-sm text-red-700">
                        {alerts.map(a => (
                          <div key={a.id}>â€¢ <strong>{a.account}</strong> risque découvert (Proj: {formatCurrency(a.projected)})</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- 2. KPI CARDS --- */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  icon={Wallet}
                  label="Solde Total"
                  value={formatCurrency(totalBalance)}
                  color="indigo"
                />

                <button
                  onClick={() => openTransactionDetails("income")}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left w-full"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-100 p-3 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-green-600">
                      {transactions.filter((t) => t.type === "income").length} trx
                    </span>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-2">Encaissements</h3>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(income)}</p>
                </button>

                <button
                  onClick={() => openTransactionDetails("expense")}
                  className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left w-full"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-red-100 p-3 rounded-xl">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                    <span className="text-sm font-medium text-red-600">
                      {transactions.filter((t) => t.type === "expense").length} trx
                    </span>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-2">Dépenses</h3>
                  <p className="text-3xl font-bold text-red-600">{formatCurrency(expense)}</p>
                </button>
                
                {/* Bouton RH temporaire (en attendant un vrai onglet) */}
                <button
  onClick={() => setActiveTab('hr')} // âœ… Utiliser activeTab au lieu de activeView
  className={`bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left w-full border border-gray-100`}
>

                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-100 p-3 rounded-xl">
                      <Briefcase className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-2">Ressources Humaines</h3>
                  <p className="text-lg font-bold text-purple-600">GÃ©rer l'Ã©quipe</p>
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
                acc.name === "Avoir"
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
                      <div className="h-64">
                        <FinancialChart transactions={transactions} />
                      </div>
                   </div>
                </div>

                {/* Colonne Droite : Dernières Transactions */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <TransactionList
                    transactions={transactions.slice(0, 5)}
                    onViewAll={() => setActiveTab("transactions")}
                    onDelete={deleteTransaction}
                    onTransactionClick={handleTransactionClick}
                    compact={true} // Optionnel si votre composant supporte un mode compact
                  />
                </div>
              </div>

              {/* --- 6. REPARTITION --- */}
              <div className="w-full">
                <CategoryBreakdown transactions={transactions} />
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

          {activeTab === 'notes' && (
            <div className="p-6 bg-white rounded-lg shadow-xl">
              <NotesSlide />
            </div>
          )}
          
          {/* Remplacer activeView === 'hr' par activeTab === 'hr' */}
          {activeTab === 'hr' && <HumanResourcesPage />}
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
              await transactionsHook.refreshTransactions();
            } catch (e) {
              showToast("Erreur ajout transaction", "error");
            }
          }}
        />
      )}

      {showAddAccount && <AccountModal onClose={() => setShowAddAccount(false)} onSave={handleCreateAccount} />}
      {showImport && <ImportModal isOpen={showImport} accounts={accounts} onClose={() => setShowImport(false)} onImport={handleImportTransactions} />}
      {showBackupImport && <BackupImportModal onClose={() => setShowBackupImport(false)} onRestoreSuccess={handleRestoreSuccess} />}
      {selectedAccount && <AccountDetails account={selectedAccount} transactions={transactions} onClose={() => setSelectedAccount(null)} onDelete={deleteTransaction} />}
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
        onDeleteProject={async (id) => { await projectsService.deleteProject(id); await refreshProjects(); }}
        onCompleteProject={handleCompleteProject}
        onProjectUpdate={refreshProjects}
        onTransactionClick={handleTransactionClick}
        accounts={accounts}
        projects={projects}
        transactions={transactions}
        totalBalance={totalBalance}
      />

      <ProjectPlannerModal
        isOpen={showProjectPlanner}
        onClose={() => { setShowProjectPlanner(false); setEditingProject(null); }}
        accounts={accounts}
        project={editingProject}
        onProjectSaved={async () => { await refreshProjects(); setEditingProject(null); }}
        onProjectUpdated={handleProjectUpdated}
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
    </>
);
}
