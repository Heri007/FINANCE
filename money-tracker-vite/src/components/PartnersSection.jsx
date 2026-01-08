import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

export function PartnersSection({ projectId, totalInvestment }) {
  const [partners, setPartners] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    partner_name: '',
    partner_role: '',
    capital_contribution: 0,
    contribution_percentage: 0,
    phase1_percentage: 10,
    phase2_percentage: 12,
    is_capital_investor: false
  });

  useEffect(() => {
    if (projectId) loadPartners();
  }, [projectId]);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/projects/${projectId}/partners`);
      setPartners(response.data || []); // CORRECTION: Assurer un tableau par défaut
      console.log('✅ Associés chargés:', response.data?.length || 0);
    } catch (err) {
      console.error('Erreur chargement associés:', err);
      setPartners([]); // CORRECTION: Tableau vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/partners/${editingId}`, formData);
      } else {
        await api.post(`/projects/${projectId}/partners`, formData);
      }
      loadPartners();
      resetForm();
      alert('Associé enregistré avec succès!');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet associé ?')) return;
    try {
      await api.delete(`/partners/${id}`);
      loadPartners();
      alert('Associé supprimé!');
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    }
  };

  const resetForm = () => {
    setFormData({
      partner_name: '',
      partner_role: '',
      capital_contribution: 0,
      contribution_percentage: 0,
      phase1_percentage: 10,
      phase2_percentage: 12,
      is_capital_investor: false
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  // CORRECTION: Vérification de sécurité
  if (loading) {
    return (
      <div className="bg-indigo-50 p-4 rounded-lg text-center">
        <p className="text-gray-600">Chargement des associés...</p>
      </div>
    );
  }

  return (
    <div className="bg-indigo-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Associés du Projet ({partners?.length || 0})
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Annuler' : 'Ajouter Associé'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Nom Associé *</label>
              <input
                type="text"
                value={formData.partner_name}
                onChange={(e) => setFormData({...formData, partner_name: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Rôle</label>
              <input
                type="text"
                value={formData.partner_role}
                onChange={(e) => setFormData({...formData, partner_role: e.target.value})}
                className="w-full p-2 border rounded"
                placeholder="Ex: Expert élevage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Apport Capital (Ar)</label>
              <input
                type="number"
                value={formData.capital_contribution}
                onChange={(e) => setFormData({...formData, capital_contribution: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">% Apport Total</label>
              <input
                type="number"
                step="0.01"
                value={formData.contribution_percentage}
                onChange={(e) => setFormData({...formData, contribution_percentage: parseFloat(e.target.value) || 0})}
                className="w-full p-2 border rounded"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">% Phase Remboursement *</label>
              <input
                type="number"
                step="0.01"
                value={formData.phase1_percentage}
                onChange={(e) => setFormData({...formData, phase1_percentage: parseFloat(e.target.value) || 10})}
                className="w-full p-2 border rounded"
                required
                placeholder="80 ou 10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">% Distribution Normale *</label>
              <input
                type="number"
                step="0.01"
                value={formData.phase2_percentage}
                onChange={(e) => setFormData({...formData, phase2_percentage: parseFloat(e.target.value) || 12})}
                className="w-full p-2 border rounded"
                required
                placeholder="70 ou 18 ou 12"
              />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_capital_investor}
                  onChange={(e) => setFormData({...formData, is_capital_investor: e.target.checked})}
                />
                <span className="text-sm font-medium">Investisseur principal (remboursement prioritaire)</span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {editingId ? 'Mettre à Jour' : 'Ajouter'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {/* CORRECTION: Vérification de partners avant map */}
        {partners && partners.length > 0 ? (
          partners.map(partner => (
            <div key={partner.id} className="bg-white p-3 rounded-lg border-2 border-indigo-200 flex justify-between items-center">
              <div className="flex-1">
                <p className="font-semibold text-lg">{partner.partner_name}</p>
                <p className="text-sm text-gray-600">{partner.partner_role || 'Aucun rôle défini'}</p>
                <div className="flex gap-4 mt-1 text-sm flex-wrap">
                  <span className="text-blue-600">
                    Capital: {formatCurrency(partner.capital_contribution || 0)} ({partner.contribution_percentage || 0}%)
                  </span>
                  <span className="text-purple-600">
                    Phase 1: {partner.phase1_percentage}% | Phase 2: {partner.phase2_percentage}%
                  </span>
                  {partner.is_capital_investor && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                      Investisseur Principal
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFormData(partner);
                    setEditingId(partner.id);
                    setShowAddForm(true);
                  }}
                  className="text-blue-600 hover:bg-blue-100 p-2 rounded"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(partner.id)}
                  className="text-red-600 hover:bg-red-100 p-2 rounded"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-8">
            Aucun associé défini. Ajoutez les associés pour activer la distribution des bénéfices.
          </p>
        )}
      </div>

      {/* Info sur l'investissement total */}
      {totalInvestment > 0 && partners && partners.length > 0 && (
        <div className="mt-4 bg-blue-50 p-3 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Investissement total à rembourser:</strong> {formatCurrency(totalInvestment)}
          </p>
        </div>
      )}
    </div>
  );
}
