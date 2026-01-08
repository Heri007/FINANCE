import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, TrendingUp, Check, X } from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

export function ProfitDistributionPanel({ projectId }) {
  const [distributions, setDistributions] = useState([]);
  const [selectedDist, setSelectedDist] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (projectId) loadDistributions();
  }, [projectId]);

  const loadDistributions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/projects/${projectId}/distributions`);
      setDistributions(response.data || []); // CORRECTION: Assurer un tableau par défaut
      console.log('✅ Distributions chargées:', response.data?.length || 0);
    } catch (err) {
      console.error('Erreur chargement distributions:', err);
      setDistributions([]); // CORRECTION: Tableau vide en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const generateDistributions = async () => {
    if (!confirm('Générer les distributions bi-mestrielles selon le business plan ?')) return;

    setLoading(true);
    try {
      const response = await api.post(`/projects/${projectId}/distributions/generate`);
      alert(response.data.message);
      loadDistributions();
    } catch (err) {
      alert('Erreur: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadDistributionDetail = async (distId) => {
    try {
      const response = await api.get(`/distributions/${distId}`);
      setSelectedDist(response.data.distribution);
      setPayments(response.data.payments || []); // CORRECTION
    } catch (err) {
      console.error('Erreur:', err);
      alert('Erreur chargement détails: ' + (err.response?.data?.error || err.message));
    }
  };

  // CORRECTION: État de chargement
  if (loading && distributions.length === 0) {
    return (
      <div className="bg-purple-50 p-4 rounded-lg text-center">
        <p className="text-gray-600">Chargement des distributions...</p>
      </div>
    );
  }

  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Distribution des Bénéfices ({distributions?.length || 0})
        </h3>
        <button
          onClick={generateDistributions}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Génération...' : 'Générer Distributions'}
        </button>
      </div>

      {/* CORRECTION: Vérification avant d'afficher */}
      {distributions && distributions.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg border-2 border-purple-200">
          <TrendingUp className="w-12 h-12 text-purple-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">Aucune distribution générée.</p>
          <p className="text-sm text-gray-400">
            Cliquez sur "Générer Distributions" pour créer les 6 bimestres automatiquement.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {distributions.map(dist => (
            <div
              key={dist.id}
              onClick={() => loadDistributionDetail(dist.id)}
              className="bg-white p-4 rounded-lg border-2 border-purple-200 cursor-pointer hover:shadow-lg transition hover:border-purple-400"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{dist.distribution_period}</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(dist.period_start_date).toLocaleDateString('fr-FR')} - {' '}
                    {new Date(dist.period_end_date).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="mt-2 flex gap-4 text-sm flex-wrap">
                    <span className="text-green-600 font-medium">
                      Revenus: {formatCurrency(dist.total_revenue || 0)}
                    </span>
                    <span className="text-red-600 font-medium">
                      Coûts: {formatCurrency(dist.total_costs || 0)}
                    </span>
                    <span className="font-bold text-purple-600">
                      Profit: {formatCurrency(dist.profit_to_distribute || 0)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    dist.distribution_phase === 'Remboursement' 
                      ? 'bg-orange-100 text-orange-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {dist.distribution_phase}
                  </span>
                  <p className="text-sm mt-2 text-gray-600">
                    {parseFloat(dist.reimbursement_percentage || 0).toFixed(1)}% remboursé
                  </p>
                  <p className="text-xs text-gray-500">
                    {dist.paid_count || 0}/{dist.total_partners || 0} associés payés
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal détail distribution */}
      {selectedDist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDist(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{selectedDist.distribution_period}</h3>
              <button onClick={() => setSelectedDist(null)} className="hover:bg-gray-100 p-2 rounded">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Profit à distribuer</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(selectedDist.profit_to_distribute || 0)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Revenus: </span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(selectedDist.total_revenue || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Coûts: </span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(selectedDist.total_costs || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Paiements aux associés</h4>
                {payments && payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map(payment => (
                      <div key={payment.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                        <div>
                          <p className="font-semibold">{payment.partner_name}</p>
                          <p className="text-sm text-gray-600">
                            {payment.percentage_applied}% = {formatCurrency(payment.amount_allocated || 0)}
                          </p>
                          {payment.payment_date && (
                            <p className="text-xs text-gray-500">
                              Payé le {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                        {payment.is_paid ? (
                          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                            <Check className="w-4 h-4" /> Payé
                          </span>
                        ) : (
                          <button 
                            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                            onClick={() => alert('Fonction de paiement à implémenter')}
                          >
                            Payer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4 bg-gray-50 rounded">
                    Aucun paiement associé. Ajoutez des associés au projet d'abord.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
