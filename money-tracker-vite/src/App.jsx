// FICHIER: src/App.jsx - VERSION REFACTORISÉE AVEC CONTEXT
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

// ✅ NOUVEAUX CONTEXTS
import { useUser } from './contexts/UserContext';
import { useFinance } from './contexts/FinanceContext';

// Hooks
import { useToast } from './hooks/useToast';

// Services
import { accountsService } from './services/accountsService';
import { transactionsService } from './services/transactionsService';
import { projectsService } from './services/projectsService';
import { API_BASE } from './services/api';
import backupService from './services/backupService';

// Composants Layout
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';

// Composants Accounts
import { AccountList } from './components/accounts/AccountList';
import { AccountDetails } from './components/accounts/AccountDetails';
import { AccountModal } from './components/accounts/AccountModal';

// Composants Transactions
import TransactionList from './components/transactions/TransactionList';
import { TransactionModal } from './components/transactions/TransactionModal';
import { CategoryBreakdown } from './components/transactions/CategoryBreakdown';
import TransactionEditModal from './TransactionEditModal';
import { TransactionDetailsModal } from './TransactionDetailsModal';

// Composants Projets
import { ProjectPlannerModal } from './ProjectPlannerModal';
import { ProjectsListModal } from './ProjectsListModal';

// Autres composants
import ReceivablesScreen from './components/ReceivablesScreen';
import NotesSlide from './components/NotesSlide';
import ImportModal from './ImportModal';
import { BackupImportModal } from './BackupImportModal';
import { BookkeeperDashboard } from './BookkeeperDashboard';
import { OperatorDashboard } from './OperatorDashboard';
import { ContentReplicator } from './ContentReplicator';
import { ReportsModal } from './ReportsModal';

// Composants communs
import { Toast } from './components/common/Toast';
import { StatCard } from './components/common/StatCard';
import { PinInput } from './components/common/PinInput';

// Utilitaires
import { formatCurrency } from './utils/formatters';

/* ============================================================================
   CONSTANTES
============================================================================ */
const DEFAULT_ACCOUNTS = [
  { name: 'Argent Liquide', type: 'cash', balance: 0 },
  { name: 'MVola', type: 'mobile', balance: 0 },
  { name: 'Orange Money', type: 'mobile', balance: 0 },
  { name: 'Compte BOA', type: 'bank', balance: 0 },
  { name: 'Coffre', type: 'cash', balance: 0 },
  { name: 'Avoir', type: 'credit', balance: 0 },
  { name: 'Redotpay', type: 'digital', balance: 0 },
];

/* ============================================================================
   COMPOSANT PRINCIPAL APP
============================================================================ */
export default function App() {
  // ✅ CONTEXTS GLOBAUX
  const auth = useUser();
  const finance = useFinance();
  const { toast, showToast, hideToast } = useToast();

  // Déstructuration pour faciliter l'accès
  const {
    accounts,
    transactions,
    projects,
    visibleTransactions,
    totalBalance,
    income,
    expense,
    totalOpenReceivables,
    activeProjects,
    remainingCostSum,
    projectsTotalRevenues,
    projectsNetImpact,
    currentCoffreBalance,
    receivablesForecastCoffre,
    receivablesForecastTotal,
    projectsForecastCoffre,
    projectsForecastTotal,
    projectFilterId,
    setProjectFilterId,
    accountFilterId,
    setAccountFilterId,
    refreshAccounts,
    refreshTransactions,
    refreshProjects,
    refreshReceivables,
    createAccount,
    deleteAccount,
    createTransaction,
    deleteTransaction,
    parseJSONSafe,
  } = finance;

  // ========== ÉTATS UI LOCAUX ==========
  const [activeTab, setActiveTab] = useState('overview');
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

  // ========== GESTION AUTHENTIFICATION ==========
  const handleLogout = async () => {
    try {
      await auth.logout();
      showToast('Déconnexion réussie', 'success');
    } catch (error) {
      showToast('Erreur lors de la déconnexion', 'error');
    }
  };

  const handlePinSubmit = async (pin) => {
    try {
      if (!auth.hasPin) {
        if (auth.pinStep === 'enter') {
          auth.setFirstPin(pin);
          auth.setPinStep('confirm');
          return;
        }
        if (auth.pinStep === 'confirm') {
          if (pin !== auth.firstPin) {
            showToast('Les PIN ne correspondent pas', 'error');
            auth.setFirstPin('');
            auth.setPinStep('enter');
            return;
          }
          await auth.setupPin(auth.firstPin);
          showToast('PIN créé avec succès', 'success');
        }
      } else {
        await auth.login(pin);
        showToast('Connexion réussie', 'success');
      }
    } catch (error) {
      showToast(error.message || 'Erreur de connexion', 'error');
      auth.setFirstPin('');
      auth.setPinStep('enter');
    }
  };

  // ========== INTERFACE PIN ==========
  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <PinInput
          onSubmit={handlePinSubmit}
          hasPin={auth.hasPin}
          pinStep={auth.pinStep}
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      </div>
    );
  }

  // ========== GESTION DES COMPTES ==========
  const handleInitDefaults = async () => {
    if (!confirm('Voulez-vous créer les 7 comptes par défaut ?')) return;
    
    try {
      await Promise.all(
        DEFAULT_ACCOUNTS.map((account) => accountsService.create(account))
      );
      showToast('Comptes créés avec succès !', 'success');
      await refreshAccounts();
    } catch (e) {
      showToast('Erreur lors de l\'initialisation', 'error');
    }
  };

  const handleCreateAccount = async (data) => {
    try {
      await createAccount(data);
      showToast(`Compte ${data.name} créé !`, 'success');
      setShowAddAccount(false);
    } catch (e) {
      showToast('Erreur création compte', 'error');
    }
  };

  const handleDeleteAccount = async (id) => {
    try {
      await deleteAccount(id);
      showToast('Supprimé', 'success');
    } catch (e) {
      showToast('Erreur suppression', 'error');
    }
  };

  // ========== GESTION DES TRANSACTIONS ==========
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
      showToast('Ajouté', 'success');
      setShowAdd(false);
    } catch (e) {
      showToast('Erreur ajout', 'error');
    }
  };

  const handleDeleteTransaction = async (id) => {
    const numericId = Number(id);
    if (!numericId || Number.isNaN(numericId)) {
      showToast('ID de transaction invalide', 'error');
      return;
    }
    if (!confirm('Supprimer ?')) return;
    try {
      await deleteTransaction(numericId);
      showToast('Supprimé', 'success');
    } catch (e) {
      showToast('Erreur suppression', 'error');
    }
  };

  const handleTransactionClick = (transaction) => {
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
  };

  // ========== RENDU PRINCIPAL ==========
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onLogout={handleLogout}
        onExport={async () => {
          try {
            const backupData = await backupService.fetchFull();
            const serverResult = await backupService.createLegacy(
              backupData.accounts,
              backupData.transactions,
              backupData.receivables || [],
              backupData.projects || [],
              `snapshot-${new Date().toISOString().split('T')[0]}`
            );
            showToast(`Backup créé: ${serverResult.filename}`, 'success');
          } catch (error) {
            showToast(`Erreur backup: ${error.message}`, 'error');
          }
        }}
        onImport={() => setShowBackupImport(true)}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* STATISTIQUES GLOBALES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <StatCard
            title="Solde Total"
            value={formatCurrency(totalBalance)}
            icon={<Wallet className="w-6 h-6" />}
            trend={totalBalance >= 0 ? 'up' : 'down'}
          />
          <StatCard
            title="Revenus"
            value={formatCurrency(income)}
            icon={<TrendingUp className="w-6 h-6" />}
            trend="up"
            color="green"
          />
          <StatCard
            title="Dépenses"
            value={formatCurrency(expense)}
            icon={<TrendingDown className="w-6 h-6" />}
            trend="down"
            color="red"
          />
        </div>

        {/* NAVIGATION */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {/* CONTENU */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <AccountList
              accounts={accounts}
              onAccountClick={setSelectedAccount}
              onAddAccount={() => setShowAddAccount(true)}
              onInitDefaults={handleInitDefaults}
            />
            
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Transactions Récentes</h2>
              <TransactionList
                transactions={transactions.slice(0, 10)}
                accounts={accounts}
                onTransactionClick={handleTransactionClick}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Transactions</h2>
              <button
                onClick={() => setShowAdd(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                + Ajouter
              </button>
            </div>
            <TransactionList
              transactions={visibleTransactions}
              accounts={accounts}
              onTransactionClick={handleTransactionClick}
              onDeleteTransaction={handleDeleteTransaction}
            />
          </div>
        )}

        {activeTab === 'receivables' && (
          <ReceivablesScreen
            onRefresh={refreshReceivables}
            totalOpenReceivables={totalOpenReceivables}
          />
        )}

        {activeTab === 'notes' && <NotesSlide />}
      </div>

      {/* MODALS */}
      {showAdd && (
        <TransactionModal
          accounts={accounts}
          projects={projects}
          onClose={() => setShowAdd(false)}
          onSubmit={addTransaction}
        />
      )}

      {showAddAccount && (
        <AccountModal
          onClose={() => setShowAddAccount(false)}
          onSubmit={handleCreateAccount}
        />
      )}

      {selectedAccount && (
        <AccountDetails
          account={selectedAccount}
          transactions={transactions.filter((t) => t.account_id === selectedAccount.id)}
          onClose={() => setSelectedAccount(null)}
          onDelete={handleDeleteAccount}
        />
      )}

      {editingTransaction && (
        <TransactionEditModal
          transaction={editingTransaction}
          accounts={accounts}
          projects={projects}
          onClose={() => setEditingTransaction(null)}
          onUpdate={handleTransactionUpdate}
          onDelete={handleTransactionDelete}
        />
      )}

      {showBackupImport && (
        <BackupImportModal
          onClose={() => setShowBackupImport(false)}
          onSuccess={async () => {
            await refreshAccounts();
            await refreshTransactions();
            await refreshProjects();
            showToast('Restauré avec succès !', 'success');
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
