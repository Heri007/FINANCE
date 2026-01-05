// src/components/vision/VisionTextEditor.jsx
import React, { useState } from 'react';
import { Save, Plus, X } from 'lucide-react';
import { apiRequest } from '../../services/api';

export function VisionTextEditor({ vision, onChange }) {
  const [content, setContent] = useState(vision?.content || '');
  const [mission, setMission] = useState(vision?.mission || '');
  const [values, setValues] = useState(vision?.values || []);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      alert('Le contenu de la vision est requis');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        content: content.trim(),
        mission: mission.trim(),
        values: values.filter((v) => v.trim()),
      };

      const method = vision?.id ? 'PUT' : 'POST';
      const endpoint = vision?.id ? `vision/${vision.id}` : 'vision';

      const updated = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      if (onChange) onChange(updated);
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addValue = () => {
    if (newValue.trim()) {
      setValues([...values, newValue.trim()]);
      setNewValue('');
    }
  };

  const removeValue = (index) => {
    setValues(values.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Vision */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vision Stratégique *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Décrivez votre vision à long terme..."
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Mission */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mission (optionnel)
        </label>
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Votre mission concrète..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Valeurs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Valeurs Fondamentales
        </label>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
            placeholder="Ex: Innovation, Excellence..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={addValue}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {values.map((val, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium"
            >
              {val}
              <button onClick={() => removeValue(idx)} className="hover:text-purple-900">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  );
}
