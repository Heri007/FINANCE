// src/components/vision/TimelineTextEditor.jsx
import React, { useState } from 'react';
import { Plus, Calendar } from 'lucide-react';

export function TimelineTextEditor({ objectives, onCreateStep }) {
  const [formData, setFormData] = useState({
    title: '',
    deadline: '',
    priority: 'medium',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.deadline) return;

    await onCreateStep(formData);
    setFormData({ title: '', deadline: '', priority: 'medium' });
  };

  const sortedObjectives = [...objectives].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  return (
    <div className="space-y-6">
      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
        <input
          type="text"
          placeholder="Étape ou jalon *"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
          </select>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Ajouter à la timeline
        </button>
      </form>

      {/* Timeline */}
      <div className="space-y-4">
        {sortedObjectives.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
            <p className="text-gray-600">Aucune étape définie.</p>
          </div>
        ) : (
          sortedObjectives.map((obj, idx) => (
            <div key={obj.id} className="flex gap-4 items-start">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full border-2 border-white shadow-md ${obj.completed ? 'bg-green-500' : 'bg-purple-600'}`} />
                {idx < sortedObjectives.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-300 mt-1" style={{ minHeight: '60px' }} />
                )}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-xl border px-4 py-3 ${
                obj.completed ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <p className={`font-medium text-sm ${obj.completed ? 'line-through text-green-700' : 'text-gray-900'}`}>
                    {obj.title}
                  </p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    obj.priority === 'high' ? 'bg-red-100 text-red-700' :
                    obj.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {obj.priority === 'high' ? 'Haute' : obj.priority === 'medium' ? 'Moyenne' : 'Basse'}
                  </span>
                </div>
                {obj.deadline && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(obj.deadline).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
