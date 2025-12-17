// src/components/vision/VisionList.jsx
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export function VisionList({ onSelect, onCreate }) {
  const [visions, setVisions] = useState([]);
  const [loading, setLoading] = useState(true);

  console.log('🔁 VisionList render', { visionsCount: visions.length, visions });

  useEffect(() => {
    const load = async () => {
      console.log('📥 VisionList → loading /vision/list');
      try {
        const data = await apiRequest('vision/list');
        console.log('📊 /vision/list RESPONSE:', data);
        setVisions(data || []);
      } catch (e) {
        console.error('❌ Erreur chargement liste visions', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div>Chargement des visions...</div>;

  return (
    <div style={{ border: '2px solid green', padding: 16, marginTop: 8 }}>
      <h3 style={{ marginBottom: 8, fontSize: 18 }}>MES VISIONS</h3>

      <button
        onClick={() => {
          console.log('🖱️ VisionList → onCreate clicked');
          onCreate();
        }}
        style={{
          marginBottom: 12,
          padding: '4px 8px',
          background: '#4f46e5',
          color: 'white',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Nouvelle vision
      </button>

      <div style={{ marginBottom: 8 }}>
        Nbre de vision = {visions.length}
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {visions.map((v) => (
          <li
            key={v.id}
            onClick={() => {
              console.log('🖱️ VisionList → onSelect clicked', v);
              onSelect(v);
            }}
            style={{
              border: '1px solid blue',
              borderRadius: 4,
              padding: 8,
              marginBottom: 8,
              cursor: 'pointer',
              background: '#f9fafb',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>
              #{v.id} — {(v.content || '').slice(0, 80) || 'Vision sans contenu'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {v.created_at &&
                new Date(v.created_at).toLocaleString('fr-FR')}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
