import React, { useState, useEffect, useMemo } from 'react';
import { Link2, AlertCircle, CheckCircle, Search, Filter, X, RefreshCw, Zap, ArrowRight } from 'lucide-react';
import { linkingService } from '../services/linkingService';
import { formatCurrency } from '../utils/formatters';

export default function ProjectReconciliation({ projectId, onUpdate }) {
  const [unlinkedTxs, setUnlinkedTxs] = useState([]);
  const [projectLines, setProjectLines] = useState({ expenses: [], revenues: [] });
  const [loading, setLoading] = useState(true);
  
  // États de sélection
  const [selectedTx, setSelectedTx] = useState(null);
  const [filterType, setFilterType] = useState('expense'); // 'expense' | 'income'
  const [searchTerm, setSearchTerm] = useState('');

  // 1. CHARGEMENT DES DONNÉES
  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [txData, linesData] = await Promise.all([
        linkingService.getUnlinked(projectId),
        linkingService.getProjectLines(projectId)
      ]);

      if (txData.success) setUnlinkedTxs(txData.data);
      if (linesData.success) {
        setProjectLines({
          expenses: linesData.data.expenseLines || [],
          revenues: linesData.data.revenueLines || []
        });
      }
    } catch (error) {
      console.error("Erreur chargement réconciliation:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // 2. FILTRAGE
  const filteredTxs = useMemo(() => {
    return unlinkedTxs.filter(t => 
      t.type === filterType &&
      (searchTerm === '' || t.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [unlinkedTxs, filterType, searchTerm]);

  const filteredLines = useMemo(() => {
    const lines = filterType === 'expense' ? projectLines.expenses : projectLines.revenues;
    return lines.filter(l => 
      searchTerm === '' || l.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projectLines, filterType, searchTerm]);

  // 3. ACTIONS
  const handleLink = async (lineId) => {
    if (!selectedTx) return alert("Sélectionnez d'abord une transaction à gauche !");

    try {
      const res = await linkingService.linkTransaction(selectedTx.transaction_id, lineId);
      if (res.success) {
        // Optimistic UI update
        setUnlinkedTxs(prev => prev.filter(t => t.transaction_id !== selectedTx.transaction_id));
        setSelectedTx(null);
        alert("Transaction liée avec succès ! ✅");
        loadData(); // Recharger pour mettre à jour les montants 'actual_amount'
        if (onUpdate) onUpdate();
      } else {
        alert("Erreur: " + res.error);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur réseau");
    }
  };

  const handleAutoLink = async () => {
    if (!confirm("Lancer la liaison automatique pour ce projet ?")) return;
    setLoading(true);
    try {
      const res = await linkingService.autoLink(projectId);
      if (res.success) {
        alert(`${res.linkedCount} transactions liées automatiquement ! 🚀`);
        loadData();
        if (onUpdate) onUpdate();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ---
  return (
    <div className="h-full flex flex-col bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
      
      {/* Header Toolbar */}
      <div className="p-4 bg-white border-b flex justify-between items-center sticky top-0 z-10">
        <div className="flex gap-2">
          <button 
            onClick={() => { setFilterType('expense'); setSelectedTx(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'expense' ? 'bg-red-100 text-red-700 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Dépenses
          </button>
          <button 
            onClick={() => { setFilterType('income'); setSelectedTx(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filterType === 'income' ? 'bg-green-100 text-green-700 shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Revenus
          </button>
        </div>
        
        <div className="flex gap-2 items-center">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Chercher..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 pr-3 py-2 text-sm border rounded-lg w-40 focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <button onClick={handleAutoLink} className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg" title="Auto-Link">
                <Zap size={18} />
            </button>
            <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg" title="Rafraîchir">
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        
        {/* COLONNE GAUCHE : TRANSACTIONS RÉELLES */}
        <div className="border-r border-gray-200 flex flex-col bg-white">
          <div className="p-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b flex justify-between">
            <span>Transactions Bancaires (Non liées)</span>
            <span className="bg-gray-200 px-2 rounded-full text-gray-700">{filteredTxs.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredTxs.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-20" />
                    Toutes les transactions sont liées !
                </div>
            )}
            
            {filteredTxs.map(tx => (
              <div 
                key={tx.transaction_id}
                onClick={() => setSelectedTx(tx)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedTx?.transaction_id === tx.transaction_id 
                    ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500' 
                    : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-800 text-sm line-clamp-2">{tx.transaction_description}</span>
                  <span className={`font-bold text-sm whitespace-nowrap ${tx.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                  <span className="bg-white px-2 py-0.5 rounded border border-gray-100">
                    {new Date(tx.transaction_date).toLocaleDateString()}
                  </span>
                  <span>{tx.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* COLONNE DROITE : LIGNES DU BUDGET */}
        <div className="flex flex-col bg-gray-50/50">
          <div className="p-3 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b flex justify-between">
             <span>Lignes du Budget (Cibles)</span>
             <span className="bg-gray-200 px-2 rounded-full text-gray-700">{filteredLines.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredLines.map(line => {
              const projected = parseFloat(line.projected_amount || line.projectedAmount || 0);
              const actual = parseFloat(line.actual_amount || line.actualAmount || 0);
              const isFull = actual >= projected;
              const isSelected = false; // Pas besoin de selection state ici, le bouton fait l'action

              // Calcul de la différence avec la transaction sélectionnée (Aide visuelle)
              const diff = selectedTx ? Math.abs(projected - parseFloat(selectedTx.amount)) : 0;
              const isMatch = selectedTx && diff < (projected * 0.1); // 10% tolérance

              return (
                <div 
                  key={line.id}
                  className={`p-3 rounded-lg border bg-white transition-all relative ${
                    isMatch ? 'border-green-400 ring-2 ring-green-100' : 'border-gray-200'
                  } ${isFull ? 'opacity-75' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-gray-800 text-sm">{line.description}</span>
                    {selectedTx && (
                        <button 
                            onClick={() => handleLink(line.id)}
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700 shadow-sm transition-transform active:scale-95"
                        >
                            Lier
                        </button>
                    )}
                  </div>

                  <div className="flex justify-between items-end mb-1">
                    <div className="text-xs text-gray-500">
                        Prévu: <span className="font-bold text-gray-700">{formatCurrency(projected)}</span>
                    </div>
                    {actual > 0 && (
                        <div className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                          Payé: {formatCurrency(actual)}
                        </div>
                    )}
                  </div>
                  
                  {/* Barre de progression */}
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${actual > projected ? 'bg-red-500' : 'bg-green-500'}`} 
                      style={{ width: `${Math.min((actual / projected) * 100, 100)}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      
      {/* Footer Info */}
      <div className="bg-white border-t p-2 text-center text-xs text-gray-400">
        Sélectionnez une transaction à gauche, puis cliquez sur "Lier" sur la ligne correspondante à droite.
      </div>
    </div>
  );
}