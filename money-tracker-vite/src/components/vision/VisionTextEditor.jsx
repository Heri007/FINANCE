// src/components/vision/VisionTextEditor.jsx
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { apiRequest } from '../../services/api';

export function VisionTextEditor({ vision, onChange, onBackToList }) {
  const [content, setContent] = useState(vision?.content || '');
  const [mission, setMission] = useState(vision?.mission || '');
  const [values, setValues] = useState(
    Array.isArray(vision?.values) ? vision.values.join('\n') : ''
  );
  const [saving, setSaving] = useState(false);

  console.log('🔁 VisionTextEditor render', { vision });

  useEffect(() => {
    console.log('🔄 VisionTextEditor useEffect vision changed', vision);
    setContent(vision?.content || '');
    setMission(vision?.mission || '');
    setValues(
      Array.isArray(vision?.values) ? vision.values.join('\n') : ''
    );
  }, [vision]);

  const handleSave = async () => {
  setSaving(true);
  try {
    const payload = { content, mission, values }
    let updated;
    if (!vision?.id) {
      console.log('🆕 Création nouvelle vision');
      updated = await apiRequest('vision', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      console.log('♻️ Mise à jour vision existante');
      updated = await apiRequest('vision', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    }

    onChange(updated);
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-gray-900 mb-2">Vision</h3>
        {onBackToList && (
          <button
            type="button"
            onClick={() => {
              console.log('🔙 VisionTextEditor → back to list');
              onBackToList();
            }}
            className="text-sm px-3 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            ← Retour à la liste
          </button>
        )}
        <textarea
          className="w-full p-4 border rounded-xl resize-none focus:ring-2 focus:ring-purple-300 outline-none"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Décrivez votre vision à long terme..."
        />
      </div>
      

      <div>
        <h3 className="font-bold text-gray-900 mb-2">Mission</h3>
        <textarea
          className="w-full p-3 border rounded-xl resize-none focus:ring-2 focus:ring-purple-300 outline-none"
          rows={2}
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Votre mission principale..."
        />
      </div>

      <div>
        <h3 className="font-bold text-gray-900 mb-2">Valeurs</h3>
        <textarea
          className="w-full p-3 border rounded-xl resize-none focus:ring-2 focus:ring-purple-300 outline-none text-sm"
          rows={3}
          value={values}
          onChange={(e) => setValues(e.target.value)}
          placeholder="Une valeur par ligne"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
