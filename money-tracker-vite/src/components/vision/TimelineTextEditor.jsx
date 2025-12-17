// src/components/vision/TimelineTextEditor.jsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export function TimelineTextEditor({ objectives, onCreateStep, onUpdateStep }) {
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: 'Nouvelle étape',
    description: '',
    deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
  });

  const sorted = [...objectives].sort((a, b) => {
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  });

  const upcoming = sorted.filter((o) => !o.completed);

  const handleCreate = async () => {
    await onCreateStep({
      title: draft.title,
      description: draft.description,
      category: 'short', // ou 'timeline' si tu ajoutes une catégorie dédiée
      deadline: draft.deadline,
      budget: 0,
    });
    setCreating(false);
    setDraft({
      title: 'Nouvelle étape',
      description: '',
      deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
    });
  };

  return (
    <div className="relative space-y-6">
      {/* Note globale Timeline (front-only) */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Note Timeline
        </h3>
        <textarea
          className="w-full p-2 border rounded-lg text-sm resize-none"
          rows={3}
          placeholder="Décrire les grandes étapes de la trajectoire..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* Formulaire d’ajout rapide */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
        >
          <Plus className="w-4 h-4" />
          {creating ? 'Annuler' : 'Ajouter une étape'}
        </button>

        {creating && (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <label className="text-gray-600">Titre</label>
              <input
                type="text"
                className="w-full px-2 py-1 border rounded"
                value={draft.title}
                onChange={(e) =>
                  setDraft({ ...draft, title: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-gray-600">Description</label>
              <textarea
                className="w-full px-2 py-1 border rounded resize-none"
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-gray-600">Date clé</label>
              <input
                type="date"
                className="w-full px-2 py-1 border rounded"
                value={draft.deadline}
                onChange={(e) =>
                  setDraft({ ...draft, deadline: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-sm rounded bg-indigo-600 text-white"
              >
                Créer l’étape
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {upcoming.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          Aucune étape à venir
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-300 via-blue-300 to-green-300" />
          <div className="space-y-8">
            {upcoming.slice(0, 8).map((obj, idx) => {
              const date = obj.deadline ? new Date(obj.deadline) : new Date();
              const month = date.toLocaleDateString('fr-FR', {
                month: 'short',
              });
              const year = date.getFullYear();
              const color = idx === 0 ? 'purple' : idx < 3 ? 'blue' : 'green';

              return (
                <div key={obj.id} className="flex gap-6 items-start relative">
                  <div
                    className={`w-16 h-16 rounded-xl bg-${color}-500 text-white flex flex-col items-center justify-center font-bold text-sm shadow-lg z-10`}
                  >
                    <span>{month}</span>
                    <span>{year}</span>
                  </div>
                  <div
                    className={`flex-1 bg-${color}-50 rounded-xl p-4 border border-${color}-100`}
                  >
                    <h4 className="font-semibold mb-1 text-gray-900">
                      {obj.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {idx === 0 ? '🔥 En cours' : '⏳ À venir'} •{' '}
                      {obj.progress || 0}% d’avancement
                    </p>
                    {obj.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {obj.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
