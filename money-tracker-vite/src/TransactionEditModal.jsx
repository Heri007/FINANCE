import React, { useState, useEffect } from 'react';
import transactionsService from './services/transactionsService';
import { projectsService } from './services/projectsService';
import { X, Trash2 } from 'lucide-react';

const TransactionEditModal = ({ transaction, onClose, onUpdate, onDelete, accounts }) => {
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: '',
    account_id: '',
    isPosted: false, // État local en camelCase
  });

  useEffect(() => {
    if (transaction) {
      console.log('📄 Transaction chargée:', transaction);
      setFormData({
        type: transaction.type || 'expense',
        amount: transaction.amount || '',
        category: transaction.category || '',
        description: transaction.description || '',
        date: transaction.transaction_date?.split('T')[0] || transaction.date?.split('T')[0] || '',
        account_id: transaction.account_id || '',
        isPosted: transaction.is_posted === true || transaction.isposted === true, // ✅ Lecture du statut
      });
    }
  }, [transaction]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // ✅ Construire le payload avec TOUS les champs en snake_case
      const payload = {
        account_id: parseInt(formData.account_id), // ✅ snake_case
        type: formData.type,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description,
        transaction_date: formData.date, // ✅ snake_case
        is_posted: formData.isPosted, // ✅ snake_case
        is_planned: false, // ✅ Valeur par défaut
        project_id: transaction.project_id || null,
        project_line_id: formData.project_line_id || null  // ✅ Préserver project_id existant
      };

      console.log('🔵 PAYLOAD ENVOYÉ:', payload);

      await transactionsService.updateTransaction(transaction.id, payload);
      console.log('✅ Transaction mise à jour avec succès');
      
      onUpdate(); // Rafraîchir la liste
      onClose(); // Fermer le modal
    } catch (error) {
      console.error('❌ ERREUR:', error);
      alert(`Erreur lors de la mise à jour: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
      try {
        await transactionsService.deleteTransaction(transaction.id);
        console.log('✅ Transaction supprimée');
        // Si la transaction était liée à un projet, tenter de resynchroniser l'état des lignes
        try {
          const projectId = transaction.project_id || transaction.projectId;
          if (projectId) {
            // Récupérer le projet et les transactions restants pour ce projet
            const proj = await projectsService.getById(projectId);
            const allTx = await transactionsService.getAll();
            const projectTx = allTx.filter(t => String(t.project_id || t.projectId) === String(projectId));

            const parseList = (data) => {
              if (!data) return [];
              if (Array.isArray(data)) return data;
              try { return JSON.parse(data); } catch { return []; }
            };

            const expenses = parseList(proj.expenses).map(e => ({ ...e }));
            const revenues = parseList(proj.revenues).map(r => ({ ...r }));

            // Marquer isPaid true si un transaction correspondant existe
            const matchTx = (line, txs, type) => {
              return txs.find(t => {
                const tAmount = parseFloat(t.amount || 0);
                const lAmount = parseFloat(line.amount || 0);
                const sameAmount = Math.abs(tAmount - lAmount) < 0.01;
                const sameType = (type === 'expense' && (t.type === 'expense')) || (type === 'revenue' && (t.type === 'income'));
                const descMatch = line.description && t.description ? (t.description.includes(line.description) || line.description.includes(t.description)) : true;
                return sameAmount && sameType && descMatch;
              });
            };

            // Update flags
            for (let i = 0; i < expenses.length; i++) {
              const found = matchTx(expenses[i], projectTx, 'expense');
              expenses[i].isPaid = !!found;
            }
            for (let i = 0; i < revenues.length; i++) {
              const found = matchTx(revenues[i], projectTx, 'revenue');
              revenues[i].isPaid = !!found;
            }

            // Construire payload complet en gardant les champs existants du projet
            const payload = {
              name: proj.name || proj.name,
              description: proj.description || proj.description,
              type: proj.type || proj.type,
              status: proj.status || proj.status,
              startDate: proj.startDate || proj.startDate,
              endDate: proj.endDate || proj.endDate,
              totalCost: proj.totalCost || 0,
              totalRevenues: proj.totalRevenues || 0,
              netProfit: proj.netProfit || 0,
              roi: proj.roi || 0,
              remainingBudget: proj.remainingBudget || 0,
              totalAvailable: proj.totalAvailable || 0,
              expenses: JSON.stringify(expenses),
              revenues: JSON.stringify(revenues)
            };

            await projectsService.updateProject(projectId, payload);
            console.log('🔁 Projet resynchronisé après suppression de transaction');
          }
        } catch (syncErr) {
          console.warn('⚠️ Erreur lors de la resynchronisation du projet:', syncErr);
        }

        onDelete(); // Rafraîchir la liste
        onClose(); // Fermer le modal
      } catch (error) {
        console.error('❌ Erreur suppression:', error);
        alert(`Erreur lors de la suppression: ${error.message}`);
      }
    }
  };

  const handleCheckboxChange = (e) => {
    const checked = e.target.checked;
    console.log('✅ Checkbox changé:', checked);
    setFormData(prev => ({ ...prev, isPosted: checked }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Modifier la Transaction</h2>
          <span className="modal-id">ID: {transaction?.id}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Type */}
          <div className="form-group">
            <label>Type</label>
            <select 
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="income">💰 Revenu</option>
              <option value="expense">💸 Dépense</option>
            </select>
          </div>

          {/* Montant */}
          <div className="form-group">
            <label>Montant (Ar)</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              required
            />
          </div>

          {/* Catégorie */}
          <div className="form-group">
            <label>Catégorie</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>

          {/* Compte */}
          <div className="form-group">
            <label>Compte</label>
            <select
              value={formData.account_id}
              onChange={(e) => setFormData({...formData, account_id: e.target.value})}
              required
            >
              <option value="">Sélectionner un compte</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Checkbox Validé/Posté */}
          <div className="form-group-checkbox">
            <label>
              <input
                type="checkbox"
                id="is_posted"
                checked={formData.isPosted}
                onChange={handleCheckboxChange}
              />
              <span>✓ Transaction Validée / Postée</span>
            </label>
            <small>Cocher cette case met à jour automatiquement le solde du compte</small>
          </div>

          {/* Boutons */}
          <div className="modal-actions">
            <button type="button" className="btn-delete" onClick={handleDelete}>
              🗑️ Supprimer
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              💾 Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionEditModal;


