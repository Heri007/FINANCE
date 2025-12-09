import React, { useState, useEffect } from 'react';
import transactionsService from './services/transactionsService';
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
        project_id: transaction.project_id || null, // ✅ Préserver project_id existant
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


