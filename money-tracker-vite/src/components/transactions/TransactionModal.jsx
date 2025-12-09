// src/components/transactions/TransactionModal.jsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { categoryIcons } from '../../utils/constants';

export function TransactionModal({ onClose, onSave, accounts }) {
  const [formData, setFormData] = useState({
    type: "expense",
    amount: "",
    category: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    accountId: accounts[0]?.id || "",
  });

  const expenseCategories = [
    "Transport", "Quotidienne", "Afterwork", "VINA", "Hébergement", 
    "Accessoires", "Crédits Phone", "Habillements", "Soins personnels", 
    "HOME MJG", "Aide", "Frais", "Goûters", "Automobile", "Dons", 
    "DOIT", "Alimentation", "Logement", "Loisirs", "Santé", "Éducation", "PLG FLPT", "Autres"
  ];
  
  const incomeCategories = [
    "Recettes", "Extra Solde", "Transfer (Inward)", "@TAHIANA", 
    "Transfert", "Salaire", "Vente", "Investissement", "PLG FLPT - Revenus",  "Autres"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.category || !formData.accountId) {
      return alert("Remplir tout");
    }
    onSave({ ...formData, amount: parseFloat(formData.amount) });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouvelle Transaction</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              onClick={() => setFormData({ ...formData, type: "expense", category: "" })} 
              className={`py-2 rounded-xl font-semibold ${formData.type === "expense" ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Dépense
            </button>
            <button 
              type="button" 
              onClick={() => setFormData({ ...formData, type: "income", category: "" })} 
              className={`py-2 rounded-xl font-semibold ${formData.type === "income" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              Revenu
            </button>
          </div>
          <input 
            type="number" 
            value={formData.amount} 
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })} 
            className="w-full px-4 py-3 border rounded-xl" 
            placeholder="Montant" 
            required 
          />
          <select 
            value={formData.category} 
            onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
            className="w-full px-4 py-3 border rounded-xl" 
            required
          >
            <option value="">Catégorie...</option>
            {(formData.type === "expense" ? expenseCategories : incomeCategories).map((c) => (
              <option key={c} value={c}>{categoryIcons[c] || '📝'} {c}</option>
            ))}
          </select>
          <input 
            type="text" 
            value={formData.description} 
            onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
            className="w-full px-4 py-3 border rounded-xl" 
            placeholder="Description" 
            required 
          />
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({ ...formData, date: e.target.value })} 
            className="w-full px-4 py-3 border rounded-xl" 
            required 
          />
          <select 
            value={formData.accountId} 
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} 
            className="w-full px-4 py-3 border rounded-xl" 
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold hover:bg-indigo-700 transition"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}

export default TransactionModal;
