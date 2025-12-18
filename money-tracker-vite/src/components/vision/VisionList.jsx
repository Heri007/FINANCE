// src/components/vision/VisionList.jsx
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { apiRequest } from '../../services/api';

export function VisionList({ onSelect, onCreate }) {
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVisions();
  }, []);

  const loadVisions = async () => {
    try {
      const data = await apiRequest('vision/list');
      setVisions(data || []);
    } catch (err) {
      console.error('Erreur chargement visions:', err);
      setVisions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette vision ?')) return;
    
    try {
      await apiRequest(`vision/${id}`, { method: 'DELETE' });
      await loadVisions();
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
        <p className="text-slate-600 font-semibold">Chargement des visions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bouton Créer */}
      <button
        onClick={onCreate}
        className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
      >
        <Plus size={18} strokeWidth={3} />
        Créer une nouvelle vision
      </button>

      {/* Liste */}
      {visions.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <p className="text-slate-600 font-semibold">Aucune vision créée.</p>
        </div>
      ) : (
        visions.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-xl shadow-md border-2 border-slate-200 px-5 py-4 hover:border-purple-600 hover:shadow-lg transition-all group"
          >
            <div className="flex-1">
              <p className="font-bold text-slate-900 text-base line-clamp-2">
                {v.content?.substring(0, 80) || 'Vision sans contenu'}...
              </p>
              <p className="mt-2 text-xs text-slate-500 font-semibold">
                Créée le {new Date(v.created_at).toLocaleString('fr-FR')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelect(v)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
              >
                <Edit size={16} strokeWidth={2.5} />
                Éditer
              </button>

              <button
                onClick={() => handleDelete(v.id)}
                className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm hover:from-red-600 hover:to-rose-700 transition-all shadow-md"
              >
                <Trash2 size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
