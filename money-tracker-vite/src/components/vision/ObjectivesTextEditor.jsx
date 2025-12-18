// src/components/vision/ObjectivesTextEditor.jsx
import React, { useState } from 'react';
import { Plus, Save, Trash2, CheckCircle, Edit, X } from 'lucide-react';

export function ObjectivesTextEditor({ objectives, onCreate, onUpdate, onDelete }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    deadline: '',
    priority: 'medium',
  });

  const [editingId, setEditingId] = useState(null); // ✅ État pour savoir quel objectif est en édition
  const [editData, setEditData] = useState(null);   // ✅ Données de l'objectif en édition

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await onCreate(formData);
    setFormData({ title: '', description: '', deadline: '', priority: 'medium' });
  };

  const startEdit = (obj) => {
    console.log('✏️ Start edit objective', obj.id);
    setEditingId(obj.id);
    setEditData({
      title: obj.title,
      description: obj.description || '',
      deadline: obj.deadline || '',
      priority: obj.priority || 'medium',
    });
  };

  const cancelEdit = () => {
    console.log('❌ Cancel edit');
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = async (objId) => {
    console.log('💾 Save edit objective', objId, editData);
    await onUpdate(objId, editData);
    setEditingId(null);
    setEditData(null);
  };

  const toggleComplete = async (obj) => {
    await onUpdate(obj.id, { ...obj, completed: !obj.completed });
  };

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout - Style ReceivablesScreen */}
      <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200 space-y-4">
        <input
          type="text"
          placeholder="Titre de l'objectif *"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full h-10 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all font-semibold"
        />

        <textarea
          placeholder="Description (optionnel)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
          className="w-full rounded-lg border-2 border-slate-200 text-sm px-3 py-2 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all resize-none font-semibold"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            className="h-10 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all font-semibold"
          />

          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="h-10 rounded-lg border-2 border-slate-200 text-sm px-3 bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all font-semibold"
          >
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
          </select>
        </div>

        <button
          type="submit"
          className="flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
        >
          <Plus size={16} strokeWidth={3} />
          Ajouter l'objectif
        </button>
      </form>

      {/* Liste des objectifs - Style ReceivablesScreen */}
      <div className="space-y-3">
        {objectives.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
            <p className="text-slate-600 font-semibold">Aucun objectif défini.</p>
          </div>
        ) : (
          objectives.map((obj) => (
            <div
              key={obj.id}
              className={`rounded-xl shadow-md border-2 px-5 py-4 transition-all ${
                obj.completed
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white/90 border-slate-200 hover:border-purple-600'
              }`}
            >
              {editingId === obj.id ? (
                // ✅ MODE ÉDITION
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full h-10 rounded-lg border-2 border-purple-600 text-sm px-3 focus:ring-2 focus:ring-purple-600/20 transition-all font-bold"
                  />

                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border-2 border-slate-200 text-sm px-3 py-2 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all resize-none font-semibold"
                    placeholder="Description..."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={editData.deadline}
                      onChange={(e) => setEditData({ ...editData, deadline: e.target.value })}
                      className="h-10 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all font-semibold"
                    />

                    <select
                      value={editData.priority}
                      onChange={(e) => setEditData({ ...editData, priority: e.target.value })}
                      className="h-10 rounded-lg border-2 border-slate-200 text-sm px-3 bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all font-semibold"
                    >
                      <option value="low">Basse</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(obj.id)}
                      className="flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition-all shadow-md"
                    >
                      <Save size={16} strokeWidth={2.5} />
                      Sauvegarder
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center justify-center h-10 px-4 rounded-lg bg-gradient-to-r from-slate-400 to-slate-500 text-white font-bold text-sm hover:from-slate-500 hover:to-slate-600 transition-all shadow-md"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ) : (
                // ✅ MODE AFFICHAGE
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className={`font-bold text-base ${obj.completed ? 'line-through text-green-700' : 'text-slate-900'}`}>
                        {obj.title}
                      </p>
                      {obj.description && (
                        <p className="text-sm text-slate-600 mt-1 font-semibold">{obj.description}</p>
                      )}
                    </div>
                    {obj.priority && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        obj.priority === 'high' ? 'bg-red-100 text-red-700' :
                        obj.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {obj.priority === 'high' ? 'Haute' : obj.priority === 'medium' ? 'Moyenne' : 'Basse'}
                      </span>
                    )}
                  </div>

                  {obj.deadline && (
                    <p className="text-xs text-slate-500 mb-3 font-semibold">
                      📅 {new Date(obj.deadline).toLocaleDateString('fr-FR')}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleComplete(obj)}
                      className={`flex items-center gap-2 h-10 px-4 rounded-lg font-bold text-sm transition-all shadow-md ${
                        obj.completed
                          ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white hover:from-slate-500 hover:to-slate-600'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                      }`}
                    >
                      <CheckCircle size={16} strokeWidth={2.5} />
                      {obj.completed ? 'Rouvrir' : 'Compléter'}
                    </button>

                    <button
                      onClick={() => startEdit(obj)}
                      className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                    >
                      <Edit size={16} strokeWidth={2.5} />
                      Éditer
                    </button>

                    <button
                      onClick={() => onDelete(obj.id)}
                      className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold text-sm hover:from-red-600 hover:to-rose-700 transition-all shadow-md"
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
