// src/components/VisionBoard.jsx
import React, { useState, useEffect } from 'react';
import { Target, Lightbulb, Calendar, ListChecks, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../services/api';
import { VisionTextEditor } from './vision/VisionTextEditor';
import { ObjectivesTextEditor } from './vision/ObjectivesTextEditor';
import { TimelineTextEditor } from './vision/TimelineTextEditor';
import { VisionList } from './vision/VisionList';

export default function VisionBoard() {
  const [vision, setVision] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('vision');
  const [selectedVision, setSelectedVision] = useState(null);
  const [mode, setMode] = useState('list'); // 'list' | 'edit'

  console.log('🔁 VisionBoard render', { activeTab, mode, vision, selectedVision });

  const fetchVisionData = async () => {
    console.log('🎯 fetchVisionData() CALLED');
    try {
      const data = await apiRequest('vision');
      console.log('📊 /vision RESPONSE:', data);
      setVision(data.vision);
      setObjectives(data.objectives || []);
    } catch (err) {
      console.error('❌ Erreur chargement vision:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 VisionBoard mounted → fetching data');
    fetchVisionData();
  }, []);

  const createObjective = async (payload) => {
    console.log('➕ createObjective CALLED with payload:', payload);
    await apiRequest('vision/objectives', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await fetchVisionData();
  };

  const updateObjective = async (id, payload) => {
    console.log('💾 updateObjective CALLED', { id, payload });
    await apiRequest(`vision/objectives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await fetchVisionData();
  };

  const deleteObjective = async (id) => {
    console.log('🗑️ deleteObjective CALLED', { id });
    await apiRequest(`vision/objectives/${id}`, {
      method: 'DELETE',
    });
    await fetchVisionData();
  };

  if (loading) {
    console.log('⏳ VisionBoard loading...');
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-2 border-slate-200 p-8">
        <div className="text-center text-slate-600 font-semibold">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec dégradé premium */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 rounded-2xl p-6 shadow-lg border-2 border-purple-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Target className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Vision & Objectifs</h2>
              <p className="text-sm text-white/90 mt-1 font-semibold">
                Vision stratégique, objectifs et timeline de croissance
              </p>
            </div>
          </div>

          {/* Badge mode édition */}
          {mode === 'edit' && (
            <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                Mode Édition
              </p>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-3 mt-5">
          {[
            { id: 'vision', label: 'Vision', icon: Lightbulb },
            { id: 'objectives', label: 'Objectifs', icon: ListChecks },
            { id: 'timeline', label: 'Timeline', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                console.log('🖱️ Tab click', tab.id);
                setActiveTab(tab.id);
                setMode('list'); // Reset au mode liste
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-purple-600 shadow-lg scale-105'
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" strokeWidth={2.5} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border-2 border-slate-200 p-6">
        {activeTab === 'vision' &&
          (mode === 'list' ? (
            <VisionList
              onSelect={(v) => {
                console.log('✅ VisionList onSelect', v);
                setSelectedVision(v);
                setMode('edit');
              }}
              onCreate={() => {
                console.log('➕ VisionList onCreate (new vision)');
                setSelectedVision({
                  id: null,
                  content: '',
                  mission: '',
                  values: [],
                });
                setMode('edit');
              }}
            />
          ) : (
            <>
              {/* Bouton retour */}
              <button
                onClick={async () => {
                  console.log('🔙 VisionBoard → back to list requested');
                  await fetchVisionData();
                  setMode('list');
                }}
                className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                Retour à la liste
              </button>

              <VisionTextEditor
                vision={selectedVision || vision}
                onChange={async (updated) => {
                  console.log('💾 VisionTextEditor onChange', updated);
                  setSelectedVision(updated);
                  await fetchVisionData();
                  setMode('list');
                }}
                onBackToList={async () => {
                  console.log('🔙 VisionBoard → back to list requested');
                  await fetchVisionData();
                  setMode('list');
                }}
              />
            </>
          ))}

        {activeTab === 'objectives' && (
          <ObjectivesTextEditor
            objectives={objectives}
            onCreate={createObjective}
            onUpdate={updateObjective}
            onDelete={deleteObjective}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineTextEditor
            objectives={objectives}
            onCreateStep={createObjective}
            onUpdateStep={updateObjective}
          />
        )}
      </div>
    </div>
  );
}
