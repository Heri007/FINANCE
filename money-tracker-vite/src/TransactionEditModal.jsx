// src/TransactionEditModal.jsx - VERSION COMPLÈTE AVEC CATÉGORIES ET PROJETS
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Calendar, DollarSign, Tag, FileText, Wallet, CheckCircle, XCircle, Briefcase } from 'lucide-react';
import { useFinance } from './contexts/FinanceContext';

const getCategoryIcon = (category) => {
  const iconMap = {
    'Voiture': '🚗', 'Transport': '🚌', 'Automobile': '🚗',
    'Alimentation': '🍽️', 'Restaurant': '🍽️', 'Nourriture': '🍽️',
    'Logement': '🏠', 'Maison': '🏠', 'Loyer': '🏠',
    'Salaire': '💰', 'Revenu': '💰', 'Cadeau': '🎁',
    'Shopping': '🛒', 'Courses': '🛒', 'Loisirs': '🎮',
    'Santé': '💊', 'Éducation': '📚', 'Vêtements': '👕',
    'Autre': '📝', 'Autres': '📝', 'PLG FLPT': '⚓',
    'Bois': '🔥', 'Transfert': '↔️', 'Carburant': '⛽',
    'Frais': '📄', 'Stock': '📦', 'DOIT': '💵',
    'Quotidienne': '🏪', 'Afterwork': '🍻', 'VINA': '🍷',
    'Hébergement': '🛏️', 'Accessoires': '👜', 'Crédits Phone': '📱',
    'Habillements': '👔', 'Soins personnels': '💅', 'HOME MJG': '🏡',
    'Aide': '🤝', 'Goûters': '🍪', 'Dons': '💝',
    'Recettes': '💵', 'Extra Solde': '💰', 'Transfer (Inward)': '↔️',
    '@TAHIANA': '👤', 'Vente': '💸', 'Investissement': '📈'
  };
  
  const normalized = category?.toLowerCase() || '';
  for (const [key, icon] of Object.entries(iconMap)) {
    if (key.toLowerCase() === normalized || normalized.includes(key.toLowerCase())) {
      return icon;
    }
  }
  return '💵';
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount || 0) + ' Ar';
};

// ✅ CATÉGORIES PAR TYPE
const EXPENSE_CATEGORIES = [
  "Transport", "Quotidienne", "Afterwork", "VINA", "Hébergement", "Accessoires",
  "Crédits Phone", "Habillements", "Soins personnels", "HOME MJG", "Aide", "Frais",
  "Goûters", "Automobile", "Dons", "DOIT", "Alimentation", "Logement", "Loisirs",
  "Santé", "Éducation", "Autres", "Voiture", "Carburant", "Stock", "Bois"
];

const INCOME_CATEGORIES = [
  "Recettes", "Extra Solde", "Transfer (Inward)", "@TAHIANA", "Transfert",
  "Salaire", "Vente", "Investissement", "Cadeau", "Autres"
];

const TransactionEditModal = ({ transaction, onClose, accounts }) => {
  const { 
    transactions,
    projects,
    updateTransaction, 
    deleteTransaction,
    updateProject,
    refreshAccounts, 
    refreshTransactions, 
    refreshProjects 
  } = useFinance();

  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: '',
    accountid: '',
    projectId: null,
    isPosted: false,
  });

  useEffect(() => {
    if (transaction) {
      console.log('📝 Transaction chargée:', transaction);
      setFormData({
        type: transaction.type || 'expense',
        amount: transaction.amount || '',
        category: transaction.category || '',
        description: transaction.description || '',
        date: transaction.transactiondate?.split('T')[0] || transaction.date?.split('T')[0] || '',
        accountid: transaction.account_id || '',
        projectId: transaction.project_id || null,
        isPosted: transaction.is_posted === true || transaction.isposted === true,
      });
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        account_id: parseInt(formData.accountid),
        type: formData.type,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description,
        transactiondate: formData.date,
        is_posted: formData.isPosted,
        is_planned: false,
        project_id: formData.projectId || null,
        project_line_id: formData.projectlineid || null,
      };

      console.log('📤 PAYLOAD ENVOYÉ:', payload);
      await updateTransaction(transaction.id, payload);
      
      await refreshAccounts?.();
      await refreshTransactions?.();
      await refreshProjects?.();

      console.log('✅ Transaction mise à jour avec succès');
      onClose();
    } catch (error) {
      console.error('❌ ERREUR:', error);
      alert('Erreur lors de la mise à jour: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      return;
    }

    try {
      const projectId = transaction.project_id || transaction.projectId;
      await deleteTransaction(transaction.id);
      console.log('🗑️ Transaction supprimée');

      if (projectId) {
        try {
          const proj = projects.find(p => String(p.id) === String(projectId));
          
          if (!proj) {
            console.warn('⚠️ Projet non trouvé dans le contexte');
            return;
          }

          const projectTx = transactions.filter(t => 
            String(t.project_id || t.projectId) === String(projectId)
          );

          const parseList = (data) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            try {
              return JSON.parse(data);
            } catch {
              return [];
            }
          };

          const expenses = parseList(proj.expenses).map(e => ({ ...e }));
          const revenues = parseList(proj.revenues).map(r => ({ ...r }));

          const matchTx = (line, txs, type) => {
            return txs.find(t => {
              const tAmount = parseFloat(t.amount || 0);
              const lAmount = parseFloat(line.amount || 0);
              const sameAmount = Math.abs(tAmount - lAmount) < 0.01;
              const sameType = (type === 'expense' && t.type === 'expense') ||
                              (type === 'revenue' && t.type === 'income');
              const descMatch = line.description && t.description ?
                t.description.includes(line.description) ||
                line.description.includes(t.description) : true;
              return sameAmount && sameType && descMatch;
            });
          };

          for (let i = 0; i < expenses.length; i++) {
            const found = matchTx(expenses[i], projectTx, 'expense');
            expenses[i].isPaid = !!found;
          }

          for (let i = 0; i < revenues.length; i++) {
            const found = matchTx(revenues[i], projectTx, 'revenue');
            revenues[i].isPaid = !!found;
          }

          const payload = {
            name: proj.name,
            description: proj.description,
            type: proj.type,
            status: proj.status,
            start_date: proj.start_date || proj.startDate,
            end_date: proj.end_date || proj.endDate,
            total_cost: proj.total_cost || 0,
            total_revenues: proj.total_revenues || 0,
            net_profit: proj.net_profit || 0,
            roi: proj.roi || 0,
            remaining_budget: proj.remaining_budget || 0,
            total_available: proj.total_available || 0,
            expenses: JSON.stringify(expenses),
            revenues: JSON.stringify(revenues),
          };

          await updateProject(projectId, payload);
          console.log('🔄 Projet resynchronisé après suppression de transaction');
        } catch (syncErr) {
          console.warn('⚠️ Erreur lors de la resynchronisation du projet:', syncErr);
        }
      }

      await refreshAccounts?.();
      await refreshTransactions?.();
      await refreshProjects?.();

      onClose();
    } catch (error) {
      console.error('❌ Erreur suppression:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  if (!transaction) return null;

  // ✅ Catégories dynamiques selon le type
  const availableCategories = formData.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* 🎨 HEADER AVEC GRADIENT */}
        <div className={`p-6 border-b border-gray-100 bg-gradient-to-r ${
          formData.type === 'income' 
            ? 'from-green-50 to-emerald-50' 
            : 'from-red-50 to-rose-50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                formData.type === 'income' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {getCategoryIcon(formData.category)}
              </div>
              
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Modifier la Transaction
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  ID: <span className="font-mono font-semibold">{transaction.id}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          {/* Badges statut */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
              formData.type === 'income'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-red-100 text-red-700 border border-red-200'
            }`}>
              {formData.type === 'income' ? '↗' : '↘'}
              {formData.type === 'income' ? 'Encaissement' : 'Dépense'}
            </span>
            
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
              formData.isPosted
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-orange-100 text-orange-700 border border-orange-200'
            }`}>
              {formData.isPosted ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {formData.isPosted ? 'Validée / Postée' : 'Non validé'}
            </span>

            {formData.projectId && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                <Briefcase className="w-4 h-4" />
                Projet assigné
              </span>
            )}
          </div>
        </div>

        {/* 📋 FORMULAIRE SCROLLABLE */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            
            {/* Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Tag className="w-4 h-4" />
                Type de transaction
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value, category: '' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="expense">💸 Dépense</option>
                <option value="income">💰 Encaissement</option>
              </select>
            </div>

            {/* Montant */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4" />
                Montant (Ar)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg font-bold"
                placeholder="0.00"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                {formatCurrency(formData.amount)}
              </p>
            </div>

            {/* ✅ CATÉGORIE EN SELECT SCROLLABLE */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Tag className="w-4 h-4" />
                Catégorie
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="">-- Sélectionner une catégorie --</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryIcon(cat)} {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                rows="3"
                placeholder="Détails de la transaction..."
              />
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Compte */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Wallet className="w-4 h-4" />
                Compte
              </label>
              <select
                value={formData.accountid}
                onChange={(e) => setFormData({ ...formData, accountid: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
              >
                <option value="">-- Choisir un compte --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ PROJET EN SELECT SCROLLABLE */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Briefcase className="w-4 h-4" />
                Projet <span className="text-gray-400 text-xs font-normal">(optionnel)</span>
              </label>
              <select
                value={formData.projectId || ""}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value || null })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">-- Aucun projet --</option>
                {projects?.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.status || 'En cours'})
                  </option>
                ))}
              </select>
            </div>

            {/* Checkbox validation */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <input
                type="checkbox"
                id="is_posted"
                checked={formData.isPosted}
                onChange={(e) => setFormData({ ...formData, isPosted: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="is_posted" className="text-sm font-medium text-gray-700 cursor-pointer">
                ✅ Transaction Validée / Postée
                <span className="block text-xs text-gray-500 mt-1">
                  Cocher cette case met à jour automatiquement le solde du compte
                </span>
              </label>
            </div>
          </div>
        </form>

        {/* 🎯 FOOTER AVEC ACTIONS */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-sm font-semibold"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-semibold"
            >
              Annuler
            </button>
            
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionEditModal;
