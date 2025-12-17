// src/components/vision/ObjectivesTextEditor.jsx
import React, { useState } from 'react';
import { Plus, Save, X, Edit2, CheckCircle2, Circle } from 'lucide-react';

const CATEGORIES = [
  { id: 'short', label: 'Court Terme', subtitle: '3-6 mois' },
  { id: 'medium', label: 'Moyen Terme', subtitle: '6-12 mois' },
  { id: 'long', label: 'Long Terme', subtitle: '1-3 ans' },
];

export function ObjectivesTextEditor({ objectives, onCreate, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});

  const startEdit = (obj) => {
    setEditingId(obj.id);
    setDraft({
      title: obj.title,
      description: obj.description || '',
      deadline: obj.deadline ? obj.deadline.slice(0, 10) : '',
      budget: obj.budget || 0,
      progress: obj.progress || 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const saveEdit = async (id) => {
    await onUpdate(id, draft);
    cancelEdit();
  };

  const addObjective = async (category) => {
    await onCreate({
      title: 'Nouvel objectif',
      description: '',
      category,
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      budget: 0,
    });
  };

  const toggleComplete = async (obj) => {
    await onUpdate(obj.id, {
      completed: !obj.completed,
      progress: !obj.completed ? 100 : 0,
    });
  };

  const getByCategory = (cat) =>
    objectives.filter((o) => o.category === cat);

  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => {
        const list = getByCategory(cat.id);
        return (
          <div key={cat.id}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-900">{cat.label}</h3>
                <p className="text-sm text-gray-600">{cat.subtitle}</p>
              </div>
              <button
                onClick={() => addObjective(cat.id)}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                <Plus className="w-4 h-4" />
                Ajouter
              </button>
            </div>

            {list.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center text-gray-500 text-sm">
                Aucun objectif {cat.label.toLowerCase()} pour le moment
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((obj) => (
                  <div
                    key={obj.id}
                    className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                  >
                    {editingId === obj.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          className="w-full px-3 py-2 border rounded-lg font-semibold"
                          value={draft.title}
                          onChange={(e) =>
                            setDraft({ ...draft, title: e.target.value })
                          }
                        />
                        <textarea
                          className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                          rows={2}
                          value={draft.description}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              description: e.target.value,
                            })
                          }
                          placeholder="Description"
                        />
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <label className="text-gray-600">
                              Deadline
                            </label>
                            <input
                              type="date"
                              className="w-full px-2 py-1 border rounded"
                              value={draft.deadline}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  deadline: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-gray-600">
                              Budget (Ar)
                            </label>
                            <input
                              type="number"
                              className="w-full px-2 py-1 border rounded"
                              value={draft.budget}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  budget: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="text-gray-600">
                              Progression: {draft.progress}%
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              className="w-full"
                              value={draft.progress}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  progress: parseInt(
                                    e.target.value,
                                    10,
                                  ),
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 text-sm bg-gray-200 rounded"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => saveEdit(obj.id)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-1"
                          >
                            <Save className="w-4 h-4" />
                            Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <button
                          onClick={() => toggleComplete(obj)}
                          className="mt-1"
                        >
                          {obj.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-blue-500" />
                          )}
                        </button>
                        <div className="flex-1">
                          <h4
                            className={`font-semibold mb-1 ${
                              obj.completed
                                ? 'line-through text-gray-500'
                                : 'text-gray-900'
                            }`}
                          >
                            {obj.title}
                          </h4>
                          {obj.description && (
                            <p className="text-sm text-gray-600 mb-1">
                              {obj.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mb-1">
                            {obj.deadline &&
                              `Deadline: ${new Date(
                                obj.deadline,
                              ).toLocaleDateString('fr-FR')}`}
                            {obj.budget
                              ? ` • Budget: ${(obj.budget / 1_000_000).toFixed(
                                  1,
                                )}M Ar`
                              : ''}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${obj.progress || 0}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {obj.progress || 0}%
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => startEdit(obj)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  'Supprimer cet objectif ?',
                                )
                              ) {
                                onDelete(obj.id);
                              }
                            }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
