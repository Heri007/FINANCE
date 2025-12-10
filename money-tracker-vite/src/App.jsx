// FICHIER: src/App.jsx - VERSION CORRIGÉE
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

// Contexts
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

// Composants (tous vos imports actuels)
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { AccountList } from './components/accounts/AccountList';
import { AccountDetails } from './components/accounts/AccountDetails';
import { AccountModal } from './components/accounts/AccountModal';
import TransactionList from './components/transactions/TransactionList';
import { TransactionModal } from './components/transactions/TransactionModal';
import { CategoryBreakdown } from './components/transactions/CategoryBreakdown';
import TransactionEditModal from './TransactionEditModal';
import { TransactionDetailsModal } from './TransactionDetailsModal';
import { ProjectPlannerModal } from './ProjectPlannerModal';
import { ProjectsListModal } from './ProjectsListModal';
import ReceivablesScreen from './components/ReceivablesScreen';
import NotesSlide from './components/NotesSlide';
import ImportModal from './ImportModal';
import { BackupImportModal } from './BackupImportModal';
import { BookkeeperDashboard } from './BookkeeperDashboard';
import { OperatorDashboard } from './OperatorDashboard';
import { ContentReplicator } from './ContentReplicator';
import { ReportsModal } from './ReportsModal';
import { Toast } from './components/common/Toast';
import { StatCard } from './components/common/StatCard';
import { PinInput } from './components/common/PinInput';
import { formatCurrency } from './utils/formatters';

const DEFAULT_ACCOUNTS = [
  { name: 'Argent Liquide', type: 'cash', balance: 0 },
  { name: 'MVola', type: 'mobile', balance: 0 },
  { name: 'Orange Money', type: 'mobile', balance: 0 },
  { name: 'Compte BOA', type: 'bank', balance: 0 },
  { name: 'Coffre', type: 'cash', balance: 0 },
  { name: 'Avoir', type: 'credit', balance: 0 },
  { name: 'Redotpay', type: 'digital', balance: 0 },
];

export default function App() {
  // ✅ TOUS LES HOOKS EN PREMIER (AVANT TOUT RETURN)
  const auth = useUser();
  const finance = useFinance();
  const { toast, showToast, hideToast } = useToast();

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

  // ✅ useEffect DOIT ÊTRE ICI (avant les returns conditionnels)
  useEffect(() => {
    const migrateProjects = async () => {
      if (!auth.isAuthenticated) return;
      
      try {
        const result = await projectsService.migrateFromLocalStorage();
        if (result.migrated > 0) {
          showToast(`✅ ${result.migrated} projets migrés vers la base de données`, 'success');
          refreshProjects();
        }
      } catch (error) {
        console.error('Migration échouée:', error);
      }
    };

    migrateProjects();
  }, [auth.isAuthenticated, refreshProjects, showToast]);

  // ✅ MAINTENANT les returns conditionnels (après tous les hooks)
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

  // ✅ HANDLERS (après les returns conditionnels, c'est OK car ils ne sont pas des hooks)
  const handleLogout = async () => {
    try {
      await auth.logout();
      showToast('Déconnexion réussie', 'success');
    } catch (error) {
      showToast('Erreur lors de la déconnexion', 'error');
    }
  };

  const handleInitDefaults = async () => {
    if (!confirm('Voulez-vous créer les 7 comptes par défaut ?')) return;
    try {
      await Promise.all(DEFAULT_ACCOUNTS.map((account) => accountsService.create(account)));
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
  };

  // ✅ RENDU PRINCIPAL
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onAddTransaction={() => setShowAdd(true)}
        onLogout={handleLogout}
        onImport={() => setShowImport(true)}
        onRestore={() => setShowBackupImport(true)}
        onBackup={async () => {
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
        onShowBookkeeper={() => setShowBookkeeper(true)}
        onShowOperator={() => setShowOperator(true)}
        onShowContent={() => setShowContentReplicator(true)}
        onShowReports={() => setShowReports(true)}
        onShowNotes={() => setActiveTab('notes')}
        onShowProjectPlanner={() => {
          setEditingProject(null);
          setShowProjectPlanner(true);
        }}
        onShowProjectsList={() => setShowProjectsList(true)}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
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

        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <AccountList
              accounts={accounts}
              onSelectAccount={setSelectedAccount}
              onAddAccount={() => setShowAddAccount(true)}
              onInitDefaults={handleInitDefaults}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Transactions récentes */}
              <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold">Transactions Récentes</h2>
                  <div className="text-sm text-gray-500">Dernières 10</div>
                </div>
                <TransactionList
                  transactions={transactions.slice(0, 10)}
                  accounts={accounts}
                  onTransactionClick={handleTransactionClick}
                  onDelete={handleDeleteTransaction}
                />
              </div>

              {/* Prévisions & États de caisse */}
              <aside className="space-y-4">
                <div className="bg-white rounded-lg shadow p-5">
                  <h3 className="text-lg font-semibold mb-3">Prévisions</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Coffre actuel</div>
                      <div className="font-bold text-gray-900">{formatCurrency(currentCoffreBalance)}</div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Prévision Avoirs (coffre)</div>
                      <div className={`font-bold ${receivablesForecastCoffre >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(receivablesForecastCoffre || 0)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Prévision Projets (coffre)</div>
                      <div className={`font-bold ${projectsForecastCoffre >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(projectsForecastCoffre || 0)}
                      </div>
                    </div>

                    <div className="border-t pt-3 mt-2 flex items-center justify-between">
                      <div className="text-sm font-medium">Coffre projeté</div>
                      <div className={`font-bold ${((currentCoffreBalance || 0) + (receivablesForecastCoffre || 0) + (projectsForecastCoffre || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatCurrency((currentCoffreBalance || 0) + (receivablesForecastCoffre || 0) + (projectsForecastCoffre || 0))}
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">Total projeté (tous comptes)</div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Solde total actuel</div>
                      <div className="font-medium">{formatCurrency(totalBalance)}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Prévision totale (arrivée)</div>
                      <div className="font-medium">{formatCurrency((receivablesForecastTotal || 0) + (projectsForecastTotal || 0))}</div>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between font-bold">
                      <div>Solde total projeté</div>
                      <div className={`${((totalBalance || 0) + (receivablesForecastTotal || 0) + (projectsForecastTotal || 0)) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {formatCurrency((totalBalance || 0) + (receivablesForecastTotal || 0) + (projectsForecastTotal || 0))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <h4 className="text-sm font-semibold mb-2">Actions rapides</h4>
                  <button onClick={refreshAccounts} className="w-full mb-2 px-3 py-2 bg-indigo-600 text-white rounded-lg">Rafraîchir Comptes</button>
                  <button onClick={refreshTransactions} className="w-full px-3 py-2 bg-gray-100 rounded-lg">Rafraîchir Transactions</button>
                </div>
              </aside>
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
              onDelete={handleDeleteTransaction} // ✅ CORRIGÉ
            />
            <CategoryBreakdown transactions={transactions} />
          </div>
        )}

        {activeTab === 'receivables' && (
          <ReceivablesScreen
            onRefresh={refreshReceivables}
            totalOpenReceivables={totalOpenReceivables}
          />
        )}

        {activeTab === 'projects' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Gestion des Projets</h2>
              <div className="space-x-2">
                <button
                  onClick={() => setShowProjectsList(true)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  📋 Liste
                </button>
                <button
                  onClick={() => {
                    setEditingProject(null);
                    setShowProjectPlanner(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  + Nouveau
                </button>
              </div>
            </div>
          </div>
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
          onSuccess={handleRestoreSuccess}
        />
      )}

      {showImport && (
        <ImportModal
          accounts={accounts}
          onClose={() => setShowImport(false)}
          onImport={handleImportTransactions}
        />
      )}

      {showBookkeeper && (
        <BookkeeperDashboard
          accounts={accounts}
          transactions={transactions}
          projects={projects}
          onClose={() => setShowBookkeeper(false)}
        />
      )}

      {showOperator && (
        <OperatorDashboard
          accounts={accounts}
          transactions={transactions}
          onClose={() => setShowOperator(false)}
        />
      )}

      {showContentReplicator && (
        <ContentReplicator onClose={() => setShowContentReplicator(false)} />
      )}

      {showReports && (
        <ReportsModal
          accounts={accounts}
          transactions={transactions}
          projects={projects}
          onClose={() => setShowReports(false)}
        />
      )}

      {showProjectPlanner && (
        <ProjectPlannerModal
          isOpen={showProjectPlanner}
          project={editingProject}
          accounts={accounts}
          onClose={() => {
            setShowProjectPlanner(false);
            setEditingProject(null);
          }}
          onSuccess={async () => {
            await refreshProjects();
            setShowProjectPlanner(false);
            setEditingProject(null);
            showToast('Projet enregistré !', 'success');
          }}
        />
      )}

      {showProjectsList && (
        <ProjectsListModal
          isOpen={showProjectsList}
          projects={projects}
          accounts={accounts}
          onClose={() => setShowProjectsList(false)}
          onEdit={(project) => {
            setEditingProject(project);
            setShowProjectPlanner(true);
            setShowProjectsList(false);
          }}
        />
      )}

      {transactionDetailsModal && (
        <TransactionDetailsModal
          type={transactionDetailsModal}
          transactions={transactions}
          accounts={accounts}
          onClose={() => setTransactionDetailsModal(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
