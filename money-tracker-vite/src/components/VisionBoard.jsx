// src/components/VisionBoard.jsx
import React, { useState, useEffect } from 'react';
import { Target, Lightbulb, Calendar, ListChecks } from 'lucide-react';
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
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Vision & Objectifs
              </h2>
              <p className="text-sm text-gray-600">
                Vision, objectifs et timeline stratégique
              </p>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mt-4">
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
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:bg-white/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-6">
        {activeTab === 'vision' && (
  mode === 'list' ? (
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
    <VisionTextEditor
      vision={selectedVision || vision}
      onChange={async (updated) => {
        console.log('💾 VisionTextEditor onChange', updated);
        setSelectedVision(updated);
        // Option 1 : rester en édition, mais rafraîchir la vision active
        await fetchVisionData();
        // Option 2 : revenir à la liste directement
        setMode('list');
      }}
      onBackToList={async () => {
        console.log('🔙 VisionBoard → back to list requested');
        // rafraîchir la vision active + repasser en mode liste
        await fetchVisionData();
        setMode('list');
              }}
            />
          )
        )}

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
