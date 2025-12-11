// FICHIER: src/App.jsx
// Version REFACTORISÉE avec composants extraits

import React, { useState, useEffect, useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown } from "lucide-react";

// Hooks personnalisés
import { useAuth } from "./hooks/useAuth";
import { useAccounts } from "./hooks/useAccounts";
import { useTransactions } from "./hooks/useTransactions";
import { useToast } from "./hooks/useToast";
import { useProjects } from "./hooks/useProjects";

// Services
import { accountsService } from "./services/accountsService";
import { transactionsService } from "./services/transactionsService";
import { projectsService } from "./services/projectsService";
import { API_BASE } from "./services/api";


// ✅ NOUVEAUX COMPOSANTS EXTRAITS
import { Header } from "./components/layout/Header";
import { Navigation } from "./components/layout/Navigation";
import { AccountList } from "./components/accounts/AccountList";
import { AccountDetails } from "./components/accounts/AccountDetails";
import { AccountModal } from "./components/accounts/AccountModal";
import TransactionList from './components/transactions/TransactionList';
import { TransactionModal } from "./components/transactions/TransactionModal";
import { CategoryBreakdown } from "./components/transactions/CategoryBreakdown";
import ReceivablesScreen from "./components/ReceivablesScreen";
import NotesSlide from './components/NotesSlide';

// Composants communs existants
import { Toast } from "./components/common/Toast";
import { StatCard } from "./components/common/StatCard";
import { PinInput } from "./components/common/PinInput";

// Modals et Dashboards existants
import ImportModal from "./ImportModal";
import { BackupImportModal } from "./BackupImportModal";
import { BookkeeperDashboard } from "./BookkeeperDashboard";
import { OperatorDashboard } from "./OperatorDashboard";
import { ContentReplicator } from "./ContentReplicator";
import { ReportsModal } from "./ReportsModal";
import { ProjectPlannerModal } from "./ProjectPlannerModal";
import { ProjectsListModal } from "./ProjectsListModal";
import { TransactionDetailsModal } from "./TransactionDetailsModal";
import backupService from "./services/backupService";
import TransactionEditModal from './TransactionEditModal';

// Utilitaires
import { formatCurrency } from "./utils/formatters";


/* ============================================================================
   CONSTANTES
============================================================================ */
const DEFAULT_ACCOUNTS = [
  { name: "Argent Liquide", type: "cash", balance: 0 },
  { name: "MVola", type: "mobile", balance: 0 },
  { name: "Orange Money", type: "mobile", balance: 0 },
  { name: "Compte BOA", type: "bank", balance: 0 },
  { name: "Coffre", type: "cash", balance: 0 },
  { name: "Avoir", type: "credit", balance: 0 },
  { name: "Redotpay", type: "digital", balance: 0 },
];

/* ============================================================================
   COMPOSANT PRINCIPAL APP
============================================================================ */

export default function App() {
  // Hooks personnalisés
  const auth = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const accountsHook = useAccounts(auth.isAuthenticated);
  const transactionsHook = useTransactions(auth.isAuthenticated);
  const { projects, refreshProjects, loading: projectsLoading } =
    useProjects(auth.isAuthenticated);

  const { accounts } = accountsHook;
  const { transactions } = transactionsHook;

  // ✅ NOUVEAU: State pour le total des receivables ouverts
  const [totalOpenReceivables, setTotalOpenReceivables] = useState(0);

  // Fonction de déconnexion
  const handleLogout = async () => {
    try {
      await auth.logout();
      showToast("Déconnexion réussie", "success");
    } catch (error) {
      showToast("Erreur lors de la déconnexion", "error");
    }
  };

  // après avoir rempli `projects` (useEffect + fetch)
  const plgProject = projects.find(
    (p) => p.name === "PLG FLPT - Campagne Pêche Complete"
  );
  const plgProjectId = plgProject?.id || null;

  // États UI locaux
  const [activeTab, setActiveTab] = useState("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showBackupImport, setShowBackupImport] = useState(false);
  const [showBookkeeper, setShowBookkeeper] = useState(false);
  const [showOperator, setShowOperator] = useState(false);
  const [showContentReplicator, setShowContentReplicator] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [showProjectsList, setShowProjectsList] = useState(false);
  const [transactionDetailsModal, setTransactionDetailsModal] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);

  // Fonction pour ouvrir le modal
  const openTransactionDetails = (type) => {
    setTransactionDetailsModal(type);
  };

  // ✅ NOUVEAU: Charger le total des receivables au boot
  useEffect(() => {
    const fetchReceivables = async () => {
      try {
        const res = await fetch(`${API_BASE}/receivables`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        const total = data.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        setTotalOpenReceivables(total);
      } catch (e) {
        console.error("Erreur chargement receivables:", e);
      }
    };

    if (auth.isAuthenticated) {
      fetchReceivables();
    }
  }, [auth.isAuthenticated]);

  // Migration des projets au démarrage
  useEffect(() => {
    const migrateProjects = async () => {
      try {
        const result = await projectsService.migrateFromLocalStorage();
        if (result.migrated > 0) {
          showToast(
            `✅ ${result.migrated} projets migrés vers la base de données`,
            "success"
          );
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

  // GESTION DU PIN
  const handlePinSubmit = async (pin) => {
    try {
      if (!auth.hasPin) {
        if (auth.pinStep === "enter") {
          auth.setFirstPin(pin);
          auth.setPinStep("confirm");
          return;
        }
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
        await auth.login(pin);
        showToast("Connexion réussie", "success");
      }
    } catch (error) {
      showToast(error.message || "Erreur de connexion", "error");
      auth.setFirstPin("");
      auth.setPinStep("enter");
    }
  };

  // FILTRES
const [projectFilterId, setProjectFilterId] = useState(null);  // null = tous
const [accountFilterId, setAccountFilterId] = useState(null);  // null = tous

const visibleTransactions = useMemo(() => {
  let list = transactions || [];

  if (projectFilterId) {
    list = list.filter(t => String(t.project_id) === String(projectFilterId));
  }

  if (accountFilterId) {
    list = list.filter(t => String(t.account_id) === String(accountFilterId));
  }

  return list;
}, [transactions, projectFilterId, accountFilterId]);


  // GESTION DES COMPTES
  const handleInitDefaults = async () => {
    if (!confirm("Voulez-vous créer les 7 comptes par défaut ?")) return;
    try {
      await Promise.all(
        DEFAULT_ACCOUNTS.map((account) => accountsService.create(account))
      );
      showToast("Comptes créés avec succès !", "success");
      await accountsHook.refreshAccounts();
    } catch (e) {
      showToast("Erreur lors de l'initialisation", "error");
    }
  };

  const handleCreateAccount = async (data) => {
    try {
      await accountsHook.createAccount(data);
      showToast(`Compte ${data.name} créé !`, "success");
      setShowAddAccount(false);
    } catch (e) {
      showToast("Erreur création compte", "error");
    }
  };

  const handleDeleteAccount = async (id) => {
    try {
      await accountsHook.deleteAccount(id);
      showToast("Supprimé", "success");
    } catch (e) {
      showToast("Erreur suppression", "error");
    }
  };

  // GESTION DES TRANSACTIONS
  const addTransaction = async (trx) => {
    try {
      await transactionsHook.createTransaction({
        account_id: trx.accountId,
        type: trx.type,
        amount: trx.amount,
        category: trx.category,
        description: trx.description,
        date: trx.date,
      });
      showToast("Ajouté", "success");
      await accountsHook.refreshAccounts();
    } catch (e) {
      showToast("Erreur ajout", "error");
    }
  };

  const deleteTransaction = async (id) => {
  const numericId = Number(id);
  console.log("🗑 deleteTransaction called with id:", id, "→", numericId, "type:", typeof numericId);
  if (!numericId || Number.isNaN(numericId)) {
    console.error("❌ ID de transaction invalide:", id);
    showToast("ID de transaction invalide", "error");
    return;
  }
  if (!confirm("Supprimer ?")) return;
  try {
    await transactionsHook.deleteTransaction(numericId);
    showToast("Supprimé", "success");
    await accountsHook.refreshAccounts();
  } catch (e) {
    showToast("Erreur suppression", "error");
  }
};

  // IMPORT CSV INCRÉMENTAL (VERSION PRODUCTION)
  const handleImportTransactions = async (importedTransactions) => {
    console.log("🔄 Import CSV incrémental...", importedTransactions.length);

    if (!importedTransactions || importedTransactions.length === 0) {
      showToast("Aucune transaction à importer.", "info");
      return;
    }

    try {
      // FONCTION HELPER : Normalisation de date
      const normalizeDate = (d) => {
        if (!d) return null;

        // Déjà au bon format 'YYYY-MM-DD'
        if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
          return d;
        }

        // Format avec slashs ex: '31/12/2025' ou '31/12/25'
        if (typeof d === "string" && d.includes("/")) {
          try {
            const parts = d.split(" ")[0].split("/");
            if (parts.length === 3) {
              let [day, month, year] = parts;
              if (year.length === 2) year = "20" + year;
              return `${year}-${month.padStart(2, "0")}-${day.padStart(
                2,
                "0"
              )}`;
            }
          } catch {
            // on laisse continuer vers le parsing générique
          }
        }

        // ISO complète ou objet Date
        try {
          const dateObj = d instanceof Date ? d : new Date(d);
          if (isNaN(dateObj.getTime())) return null;

          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, "0");
          const day = String(dateObj.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        } catch {
          return null;
        }
      };

      // FONCTION HELPER : Créer une signature unique
      const createSignature = (accountId, date, amount, type, desc) => {
        const cleanAccId = accountId ? String(accountId).trim() : null;
        const cleanDate = normalizeDate(date);
        const cleanAmount =
          amount != null ? Math.abs(parseFloat(amount)).toFixed(2) : null;
        const cleanType = type ? String(type).trim().toLowerCase() : null;

        const cleanDesc = desc
          ? String(desc)
              .trim()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, " ")
              .replace(/[.,;:!?@#$%^&*()]/g, "")
              .substring(0, 40)
          : null;

        if (!cleanAccId || !cleanDate || !cleanAmount || !cleanType) {
          return null;
        }

        return `${cleanAccId}|${cleanDate}|${cleanAmount}|${cleanType}|${cleanDesc}`;
      };

      // ÉTAPE 1: Récupérer toutes les transactions existantes
      console.log("📥 Chargement des transactions existantes...");
      const existingTransactions = await transactionsService.getAll();
      console.log(`📊 ${existingTransactions.length} transactions en base`);

      // ÉTAPE 2: Créer un index des signatures existantes
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

      // ÉTAPE 3: Filtrer les transactions à importer
      const newTransactions = [];
      const duplicates = [];
      const invalid = [];

      importedTransactions.forEach((trx, index) => {
        const sig = createSignature(
          trx.accountId,
          trx.date,
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

      // ÉTAPE 4: Afficher le résumé
      console.log(`\n📊 === ANALYSE DES DONNÉES CSV ===`);
      console.log(`📥 Total CSV: ${importedTransactions.length}`);
      console.log(`✅ Nouvelles: ${newTransactions.length}`);
      console.log(`⚠️ Doublons: ${duplicates.length}`);
      console.log(`❌ Invalides: ${invalid.length}`);

      if (duplicates.length > 0 && duplicates.length <= 5) {
        console.log(`\n🔍 Exemples de doublons détectés:`);
        duplicates.slice(0, 5).forEach((dup) => {
          console.log(
            `  - ${dup.csv.description} (${dup.csv.amount} Ar, ${dup.csv.date})`
          );
          console.log(`    → Existe en base avec ID ${dup.existing.id}`);
        });
      }

      // ÉTAPE 5: Si aucune nouvelle transaction, arrêter
      if (newTransactions.length === 0) {
        const msg = `
📊 IMPORT CSV TERMINÉ

✅ Nouvelles transactions: 0
⚠️ Doublons ignorés: ${duplicates.length}
❌ Transactions invalides: ${invalid.length}

${
  duplicates.length > 0
    ? "✅ Toutes les transactions du CSV existent déjà en base."
    : ""
}
${
  invalid.length > 0
    ? `⚠️ ${invalid.length} transactions ont été ignorées (données invalides).`
    : ""
}
        `;
        alert(msg.trim());
        showToast("Aucune nouvelle transaction à importer", "info");
        return;
      }

      // ÉTAPE 6: Calculer l'impact sur les soldes par compte
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

      // ÉTAPE 7: Afficher la confirmation avec impact détaillé
      let impactDetails = "\n💰 IMPACT SUR LES SOLDES:\n\n";
      Object.values(impactByAccount).forEach((acc) => {
        const netImpact = acc.income - acc.expense;
        const newBalance = acc.currentBalance + netImpact;
        const sign = netImpact >= 0 ? "+" : "";

        impactDetails += `${acc.name} (${acc.count} trx):\n`;
        impactDetails += `  Solde actuel: ${acc.currentBalance.toLocaleString(
          "fr-FR"
        )} Ar\n`;
        if (acc.income > 0) {
          impactDetails += `  + Revenus: ${acc.income.toLocaleString(
            "fr-FR"
          )} Ar\n`;
        }
        if (acc.expense > 0) {
          impactDetails += `  - Dépenses: ${acc.expense.toLocaleString(
            "fr-FR"
          )} Ar\n`;
        }
        impactDetails += `  → Nouveau solde: ${newBalance.toLocaleString(
          "fr-FR"
        )} Ar (${sign}${netImpact.toLocaleString("fr-FR")})\n\n`;
      });

      const confirmMsg = `
📊 IMPORT CSV - CONFIRMATION

✅ Nouvelles transactions: ${newTransactions.length}
⚠️ Doublons ignorés: ${duplicates.length}
${
  invalid.length > 0
    ? `❌ Invalides ignorées: ${invalid.length}\n`
    : ""
}
${impactDetails}
Voulez-vous importer ces ${newTransactions.length} nouvelles transactions ?
      `;

      if (!confirm(confirmMsg.trim())) {
        showToast("Import annulé.", "info");
        return;
      }

      // ÉTAPE 8: Importer les nouvelles transactions
      console.log(`\n📤 Import de ${newTransactions.length} transactions...`);
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const trx of newTransactions) {
        try {
          await transactionsService.create({
            account_id: trx.accountId,
            type: trx.type,
            amount: trx.amount,
            category: trx.category,
            description: trx.description,
            date: trx.date,
            is_posted: true,
            is_planned: false,
            remarks: trx.remarks || "",
          });
          successCount++;

          if (successCount % 20 === 0) {
            console.log(
              `  ✅ ${successCount}/${newTransactions.length} importées...`
            );
          }
        } catch (error) {
          console.error(`❌ Erreur import:`, trx.description, error);
          errorCount++;
          errors.push({
            transaction: trx.description,
            error: error.message,
          });
        }
      }

      console.log(
        `\n✅ Import terminé: ${successCount}/${newTransactions.length} réussies`
      );

      if (successCount > 0) {
        // ÉTAPE 9: Recalculer tous les soldes
        console.log("🔄 Recalcul des soldes...");
        const token = localStorage.getItem("token");

        try {
          const response = await fetch(
            `${API_BASE}/accounts/recalculate-all`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.ok) {
            const data = await response.json();
            console.log("✅ Soldes recalculés:", data.results);

            let summary = `✅ IMPORT CSV RÉUSSI !\n\n`;
            summary += `📥 ${successCount} nouvelles transactions importées\n`;
            summary += `⚠️ ${duplicates.length} doublons ignorés\n`;
            if (errorCount > 0)
              summary += `❌ ${errorCount} erreurs\n`;
            if (invalid.length > 0)
              summary += `⚠️ ${invalid.length} transactions invalides ignorées\n`;
            summary += `\n💰 SOLDES MIS À JOUR:\n\n`;

            data.results.forEach((r) => {
              const impact = impactByAccount[r.accountId];
              if (impact && impact.count > 0) {
                summary += `${r.accountName} (${impact.count} nouvelles trx):\n`;
                summary += `  → ${r.newBalance.toLocaleString(
                  "fr-FR"
                )} Ar\n\n`;
              }
            });

            if (errorCount > 0) {
              summary += `\n⚠️ Erreurs détectées:\n`;
              errors.slice(0, 3).forEach((err) => {
                summary += `  - ${err.transaction}: ${err.error}\n`;
              });
              if (errors.length > 3) {
                summary += `  ... et ${
                  errors.length - 3
                } autres erreurs\n`;
              }
            }

            alert(summary);
            showToast(
              `${successCount} transactions importées !`,
              "success"
            );
          } else {
            console.error(
              "❌ Erreur recalcul soldes:",
              response.status
            );
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

        // ÉTAPE 10: Rafraîchir l'interface
        await accountsHook.refreshAccounts();
        await transactionsHook.refreshTransactions();
      } else {
        alert(
          `❌ Échec de l'import\n\n${errorCount} erreurs détectées.\n\nVérifiez les logs de la console.`
        );
        showToast("Aucune transaction n'a pu être importée.", "error");
      }
    } catch (error) {
      console.error("❌ Erreur globale import:", error);
      showToast(`Erreur lors de l'import: ${error.message}`, "error");
    }
  };

  // ✅ Callback après suppression (MANQUANT)
const handleTransactionDelete = async () => {
  await transactionsHook.refreshTransactions();   // <- important pour ProjectDetailsModal
  await accountsHook.refreshAccounts();           // garder les soldes cohérents
  setEditingTransaction(null);                    // fermer le modal d’édition
  console.log('✅ Transaction supprimée avec succès');
};

  // Fonction pour éditer un projet
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
    
    // Confirmation
    if (!confirm(`ACTIVATION: ${project.name}\nDépenses: ${parsedExpenses.length}\nRevenus: ${parsedRevenues.length}\nConfirmer ?`)) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const newTransactions = [];
        
        // ✅ CORRECTION : Transactions POSTÉES et NON PLANIFIÉES
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
                    is_planned: false,  // ✅ Pas planifiée
                    is_posted: true     // ✅ Validée
                });
                newTransactions.push(exp);
            }
        }
        
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
                    is_planned: false,  // ✅
                    is_posted: true     // ✅
                });
                newTransactions.push(rev);
            }
        }
        
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
        await accountsHook.refreshAccounts();
        
        alert(`${project.name} ACTIVÉ !\n${newTransactions.length} transactions`);
    } catch (error) {
        console.error('Erreur activation:', error);
        alert(`Erreur: ${error.message}`);
    }
};

  const handleProjectUpdated = async (projectId) => {
    await refreshProjects();
    await transactionsHook.refreshTransactions();
    await accountsHook.refreshAccounts();
  };


// ✅ HANDLER UNIQUE
const handleTransactionClick = (transaction) => {
    console.log('🖱️ Transaction cliquée:', transaction.id);
    setEditingTransaction(transaction);
};

const handleTransactionUpdate = async () => {
    await accountsHook.refreshAccounts();
    await transactionsHook.refreshTransactions();
    setEditingTransaction(null);
};


  // Activation PAR PHASE (Logistique/Ventes séparées)
    // Version CORRIGÉE
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
            
            // ✅ CORRECTION : Utiliser transactionsService au lieu de fetch direct
            await transactionsService.create({
                accountid: targetAccount.id,
                type: 'expense',
                amount: parseFloat(exp.amount),
                category: `${project.name} - ${phaseName}`,
                description: exp.description,
                date: new Date().toISOString().split('T')[0],
                is_planned: false,  // ✅ Pas planifiée
                is_posted: true,    // ✅ Validée
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
        await accountsHook.refreshAccounts();
        
        alert(`Phase "${phaseName}" active !\n${successCount} transactions créées`);
    } catch (error) {
        alert(`Erreur: ${error.message}`);
    }
};


  const handleCompleteProject = async (projectId) => {
    if (
      !window.confirm(
        "Marquer ce projet comme terminé et l'archiver ?"
      )
    )
      return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_BASE}/projects/${projectId}/archive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur archivage projet");
      }

      await refreshProjects();
      await transactionsHook.refreshTransactions();
      await accountsHook.refreshAccounts();

      alert("Projet archivé avec succès.");
    } catch (e) {
      console.error("❌ Erreur archivage:", e);
      alert("Erreur archivage: " + e.message);
    }
  };
  
  // EXPORT BACKUP COMPLET (accounts + transactions + receivables + projects)
const handleExportBackup = async () => {
  try {
    const defaultLabel = `snapshot-${new Date()
      .toISOString()
      .split("T")}`;
    const label = prompt(
      "Label du backup ? (ex: post-migration-AVOIR)",
      defaultLabel
    );
    if (label === null) return;

    // ✅ Récupérer le backup complet depuis le serveur
    const backupData = await backupService.fetchFull();

    // ✅ Log pour vérifier que les projets sont bien présents
    console.log('📦 Backup récupéré:', {
      accounts: backupData.accounts?.length,
      transactions: backupData.transactions?.length,
      receivables: backupData.receivables?.length,
      projects: backupData.projects?.length // ✅ Vérifier les projets
    });

    // ✅ CORRECTION: Ajouter les projets comme 4ème paramètre
    const serverResult = await backupService.createLegacy(
      backupData.accounts,
      backupData.transactions,
      backupData.receivables || [],
      backupData.projects || [], // ✅ AJOUT DES PROJETS
      label // ✅ Label en 5ème position
    );

    console.log("✅ Backup serveur créé:", serverResult);

    const wantsLocal = confirm(
      `Backup serveur créé:

` +
        `- Fichier: ${serverResult.filename}
` +
        `${serverResult.label ? `- Label: ${serverResult.label}
` : ""}
` +
        `Voulez-vous aussi télécharger ce backup en local ?`
    );

    if (wantsLocal) {
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const filename = `moneytracker_full_backup_${new Date()
        .toISOString()
        .split("T")}_${label.replace(
        /[^a-zA-Z0-9-_]+/g,
        "_"
      )}.json`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        `✅ Backup serveur + local: ${filename}`,
        "success"
      );
    } else {
      showToast(
        `✅ Backup serveur créé: ${serverResult.filename}`,
        "success"
      );
    }
  } catch (error) {
    console.error("❌ Erreur backup:", error);
    showToast(`Erreur backup: ${error.message}`, "error");
  }
};


  const handleRestoreSuccess = async () => {
    await accountsHook.refreshAccounts();
    await transactionsHook.refreshTransactions();
    showToast("Restauré avec succès !", "success");
  };

  // CALCULS SOLDE ET TOTAUX
  const { income, expense } = useMemo(() => {
    const seenSignatures = new Set();
    const uniqueTransactions = [];

    transactions.forEach((t) => {
      const sig = `${t.account_id}|${(t.date || "").split("T")[0]}|${
        t.amount
      }|${t.type}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        uniqueTransactions.push(t);
      }
    });

    return uniqueTransactions.reduce(
      (tot, t) => {
        const a = parseFloat(t.amount || 0);
        if (t.type === "income") tot.income += a;
        else tot.expense += a;
        return tot;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  // ✅ CORRECTION: Créer un tableau de comptes avec le bon solde pour Avoir
  const accountsWithCorrectAvoir = useMemo(() => {
    return accounts.map(acc => {
      if (acc.name === "Avoir") {
        return {
          ...acc,
          balance: totalOpenReceivables // Remplace par le total receivables réel
        };
      }
      return acc;
    });
  }, [accounts, totalOpenReceivables]);

  // ✅ CORRECTION: Calcul du solde total avec le bon montant Avoir
  const totalBalance = useMemo(() => {
    return accountsWithCorrectAvoir.reduce(
      (s, acc) => s + parseFloat(acc.balance || 0),
      0
    );
  }, [accountsWithCorrectAvoir]);

// === PRÉVISIONS COMPLÈTES (À AJOUTER ICI) ===
const coffreAccount = accountsWithCorrectAvoir.find(a => a.name === "Coffre");
const currentCoffreBalance = Number(coffreAccount?.balance || 0);

// Après règlements
const receivablesForecastCoffre = currentCoffreBalance + totalOpenReceivables;
const receivablesForecastTotal = totalBalance + totalOpenReceivables;
const avoirsTousRecoltes = currentCoffreBalance >= totalOpenReceivables;

// CALCULS PROJETS - Exclure les projets inactifs
const parseJSONSafe = (data) => {
  if (!data || data === null || data === undefined || data === 'null') return [];
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
  } catch {
    return [];
  }
};

// ✅ Filtrer uniquement les projets actifs
const activeProjects = useMemo(() => {
  return projects.filter(p => {
    const status = (p.status || '').toLowerCase();
    return (
      status === 'active' ||
      status === 'actif' ||
      status.startsWith('phase ')
    );
  });
}, [projects]);

// CALCUL INVESTISSEMENT - SEULEMENT Futur et Planifié + projets actifs
const remainingCostSum = useMemo(() => {
  return activeProjects.reduce((sum, p) => {
    try {
      const expenses = parseJSONSafe(p.expenses);
      // EXCLUdre "Déjà Payé"
      const futureExpenses = expenses.filter(e =>
        e.account !== 'Déjà Payé' && e.account !== 'Payé'
      );
      return sum + futureExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    } catch {
      return sum;
    }
  }, 0);
}, [activeProjects]);

const projectsTotalRevenues = useMemo(() => {
  return activeProjects.reduce((sum, p) => {
    const revenues = parseJSONSafe(p.revenues);
    return sum + revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  }, 0);
}, [activeProjects]);

const projectsNetImpact = projectsTotalRevenues - remainingCostSum;

const projectsForecastCoffre = receivablesForecastCoffre + projectsNetImpact;
const projectsForecastTotal = receivablesForecastTotal + projectsNetImpact;

console.log('🔍 PROJETS DEBUG:', {
  'Investissement Global': remainingCostSum.toLocaleString(),
  'Total Revenues': projectsTotalRevenues.toLocaleString(),
  'Net Impact': projectsNetImpact.toLocaleString(),
  projects: activeProjects.map(p => ({ name: p.name, status: p.status }))
});


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

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <Header
          onAddTransaction={() => setShowAdd(true)}
          onLogout={handleLogout}
          onImport={() => setShowImport(true)}
          onRestore={() => setShowBackupImport(true)}
          onBackup={handleExportBackup}
          onShowNotes={() => setActiveTab('notes')} 
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      {
                        transactions.filter(
                          (t) => t.type === "income"
                        ).length
                      }{" "}
                      transactions
                    </span>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-2">
                    Encaissements
                  </h3>
                  <p className="text-3xl font-bold text-green-600">
                    {income.toLocaleString("fr-FR")} Ar
                  </p>
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
                      {
                        transactions.filter(
                          (t) => t.type === "expense"
                        ).length
                      }{" "}
                      transactions
                    </span>
                  </div>
                  <h3 className="text-gray-600 text-sm font-medium mb-2">
                    Dépenses
                  </h3>
                  <p className="text-3xl font-bold text-red-600">
                    {expense.toLocaleString("fr-FR")} Ar
                  </p>
                </button>

              </div>

              {/* PRÉVISIONS COMPLÈTES */}
<section className="mt-6 rounded-2xl border border-blue-800 bg-blue-300 from-slate-50 via-blue-50 to-emerald-50 p-4">
  <h3 className="text-xs font-black tracking-[0.18em] text-slate-700 mb-3">
    PRÉVISIONS COMPLÈTES
  </h3>

  <div className="space-y-3">
    {/* Après règlements */}
    <div className="rounded-xl bg-white/70 border border-slate-100 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
          APRÈS RÈGLEMENTS
        </span>
        <span className="text-lg font-bold text-red-900">
          +{totalOpenReceivables.toLocaleString('fr-FR')} Ar
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <p className="text-sm font-bold text-slate-500">
            COFFRE (+ AVOIR)
          </p>
          <p className="text-2xl font-extrabold text-emerald-700">
            {receivablesForecastCoffre.toLocaleString('fr-FR')}<span className="text-lg font-bold ml-1">Ar</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-500">
            TOTAL (TOUS LES COMPTES)
          </p>
          <p className="text-2xl font-extrabold text-slate-900">
            {receivablesForecastTotal.toLocaleString('fr-FR')}<span className="text-xs font-semibold ml-1">Ar</span>
          </p>
        </div>
      </div>
    </div>

    {/* Après projets */}
    <div className="rounded-xl bg-white/80 border border-emerald-100 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-sm font-bold bg-rose-50 text-rose-700 border border-rose-100">
          APRÈS PROJETS
        </span>
        <span className="text-lg font-bold text-red-900">
          +{projectsNetImpact.toLocaleString('fr-FR')} Ar
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 items-end">
        <div>
          <p className="text-sm font-bold text-slate-500">
            COFFRE (+ AVOIR + PROJETS)
          </p>
          <p className="text-2xl font-extrabold text-emerald-700">
            {projectsForecastCoffre.toLocaleString('fr-FR')}<span className="text-2xl font-semibold ml-1">Ar</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-extrabold text-slate-500">
            TOTAL FINAL (TOUS LES COMPTES)
          </p>
          <p className="text-2xl font-extrabold text-slate-900">
            {projectsForecastTotal.toLocaleString('fr-FR')}<span className="text-2xl font-semibold ml-1">Ar</span>
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3 text-sm text-slate-600">
  <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-200 text-blue-900 font-bold">
    {activeProjects.length} projets
  </span>

  <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-200 text-blue-900 border border-emerald-100 font-bold">
    Résultats Prévisionnels: {remainingCostSum.toLocaleString('fr-FR')} Ar
  </span>
</div>
    </div>
  </div>
</section>

              {/* ✅ CORRECTION: Utiliser accountsWithCorrectAvoir */}
              <AccountList
                accounts={accountsWithCorrectAvoir}
                onSelectAccount={(acc) => {
                  if (acc.name === "Avoir") {
                    setActiveTab("receivables");
                    return;
                  }
                  setSelectedAccount(acc);
                }}
                onAddAccount={() => setShowAddAccount(true)}
                onDeleteAccount={handleDeleteAccount}
                onInitDefaults={handleInitDefaults}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CategoryBreakdown transactions={transactions} />
                <TransactionList
                  transactions={transactions.slice(0, 5)}
                  onViewAll={() => setActiveTab("transactions")}
                  onDelete={deleteTransaction}
                  onTransactionClick={handleTransactionClick}
                />
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
  <div className="space-y-4">
    {/* Filtres projet + compte */}
    <div className="flex flex-wrap gap-3 items-center mb-2 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-gray-600 font-semibold">Projet:</span>
        <select
          className="border rounded-lg px-2 py-1 text-xs"
          value={projectFilterId || ""}
          onChange={e =>
            setProjectFilterId(e.target.value || null)
          }
        >
          <option value="">Tous</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-gray-600 font-semibold">Compte:</span>
        <select
          className="border rounded-lg px-2 py-1 text-xs"
          value={accountFilterId || ""}
          onChange={e =>
            setAccountFilterId(e.target.value || null)
          }
        >
          <option value="">Tous</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {(projectFilterId || accountFilterId) && (
        <button
          className="ml-auto text-xs text-indigo-600 hover:underline"
          onClick={() => {
            setProjectFilterId(null);
            setAccountFilterId(null);
          }}
        >
          Réinitialiser filtres
        </button>
      )}
    </div>

    <TransactionList
      transactions={visibleTransactions}
      onViewAll={() => {
        setProjectFilterId(null);
        setAccountFilterId(null);
      }}
      onDelete={deleteTransaction}
      onTransactionClick={handleTransactionClick}
    />
  </div>
)}


          {/* ✅ CORRECTION: Ajouter le callback onTotalsChange */}
          {activeTab === "receivables" && (
            <ReceivablesScreen
              token={localStorage.getItem("token")}
              accounts={accounts}
              onAfterChange={async () => {
                await accountsHook.refreshAccounts();
              }}
              onTotalsChange={({ totalOpenReceivables }) =>
                setTotalOpenReceivables(totalOpenReceivables)
              }
            />
          )}

{activeTab === 'notes' && (
  <div className="p-6 bg-white rounded-lg shadow-xl">
    <NotesSlide />
  </div>
)}
        </main>
      </div>

      {/* MODALS */}
      {showAdd && (
        <TransactionModal
          onClose={() => setShowAdd(false)}
          accounts={accounts}
          onSave={async (tx) => {
            try {
              await transactionsHook.createTransaction({
                account_id: tx.accountId,
                type: tx.type,
                amount: tx.amount,
                category: tx.category,
                description: tx.description,
                date: tx.date,
                project_id: plgProjectId || null,
                is_posted: true,   // ✅ Ajouter si manquant
                is_planned: false  // ✅ Ajouter si manquant
              });
              showToast("Transaction enregistrée", "success");
              await accountsHook.refreshAccounts();
              await transactionsHook.refreshTransactions();
            } catch (e) {
              showToast("Erreur ajout transaction", "error");
            }
          }}
        />
      )}

      {showAddAccount && (
        <AccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={handleCreateAccount}
        />
      )}

      {showImport && (
        <ImportModal
          isOpen={showImport}
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImport={handleImportTransactions}
        />
      )}

      {showBackupImport && (
        <BackupImportModal
          onClose={() => setShowBackupImport(false)}
          onRestoreSuccess={handleRestoreSuccess}
        />
      )}

      {selectedAccount && (
        <AccountDetails
          account={selectedAccount}
          transactions={transactions}
          onClose={() => setSelectedAccount(null)}
          onDelete={deleteTransaction}
        />
      )}

      {showReports && (
        <ReportsModal
          onClose={() => setShowReports(false)}
          transactions={transactions}
          accounts={accounts}
        />
      )}

      {showBookkeeper && (
        <BookkeeperDashboard
          onClose={() => setShowBookkeeper(false)}
          transactions={transactions}
          accounts={accounts}
          projects={projects}
        />
      )}

      {showOperator && (
  <OperatorDashboard
    onClose={() => setShowOperator(false)}
    projects={projects}
    transactions={transactions}
    accounts={accounts}
  />
)}


      {showContentReplicator && (
        <ContentReplicator
          onClose={() => setShowContentReplicator(false)}
        />
      )}

      <ProjectsListModal
  isOpen={showProjectsList}
  onClose={() => setShowProjectsList(false)}
  onNewProject={() => {
    setEditingProject(null);
    setShowProjectPlanner(true);
  }}
  onEditProject={handleEditProject}
  onActivateProject={handleActivateProject}
  onDeleteProject={async (id) => {
    await projectsService.deleteProject(id);
    await refreshProjects();
  }}
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
        onClose={() => {
          setShowProjectPlanner(false);
          setEditingProject(null);
        }}
        accounts={accounts}
        project={editingProject}
        onProjectSaved={async () => {
          await refreshProjects();
          setEditingProject(null);
        }}
        onProjectUpdated={handleProjectUpdated}
      />

{/* ✅ MODAL D'ÉDITION DE TRANSACTION */}
{editingTransaction && (
  <TransactionEditModal
    transaction={editingTransaction}      // ✅ la vraie transaction
    isOpen={!!editingTransaction}
    onClose={() => setEditingTransaction(null)}
    onDelete={handleTransactionDelete}
    onDeleted={handleTransactionDelete}
    onUpdate={handleTransactionUpdate}
    accounts={accountsWithCorrectAvoir}
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
