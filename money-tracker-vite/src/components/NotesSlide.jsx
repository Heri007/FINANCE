// src/components/NotesSlide.jsx - CORRIGÉ POUR NOTE EXISTANTE
import React, { useState, useEffect } from 'react';
import { Save, Trash2, Clock, Plus, List } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function NotesSlide() {
  const [currentNote, setCurrentNote] = useState({ id: null, content: '' });
  const [notesList, setNotesList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);

  // ✅ CHARGER LA NOTE EXISTANTE (ou liste)
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch(`${API_BASE}/notes`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // ✅ SI 1 SEULE NOTE (cas actuel) - l'afficher directement
          if (data.id && !Array.isArray(data)) {
            setCurrentNote(data);
            setNotesList([data]);
            setSaveStatus('✅ Note chargée');
          } 
          // ✅ SI LISTE DE NOTES
          else if (Array.isArray(data)) {
            setNotesList(data);
            if (data.length > 0) {
              setCurrentNote(data[0]);
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement notes:', error);
        setSaveStatus('❌ Erreur chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  // Auto-sauvegarde 5s
  useEffect(() => {
    if (currentNote.content && currentNote.id) {
      const timer = setTimeout(() => saveNote(), 5000);
      return () => clearTimeout(timer);
    }
  }, [currentNote.content, currentNote.id]);

  const saveNote = async () => {
    if (!currentNote.id) return;
    
    setIsSaving(true);
    setSaveStatus('Sauvegarde...');

    try {
      const response = await fetch(`${API_BASE}/notes/${currentNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: currentNote.content })
      });

      if (response.ok) {
        const note = await response.json();
        setLastSaved(note.updated_at);
        setSaveStatus('✅ Sauvegardé');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setSaveStatus('❌ Erreur serveur');
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setSaveStatus('❌ Erreur réseau');
    } finally {
      setIsSaving(false);
    }
  };

  const createNewNote = async () => {
    try {
      const response = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      const newNote = await response.json();
      
      setCurrentNote(newNote);
      setNotesList([newNote, ...notesList]);
      setSaveStatus('🆕 Nouvelle note');
      setShowList(false);
    } catch (error) {
      console.error('Erreur création:', error);
    }
  };

  const loadNote = (note) => {
    setCurrentNote(note);
    setShowList(false);
    setSaveStatus(`Chargée: ${new Date(note.updated_at).toLocaleDateString('fr-FR')}`);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div>Chargement des notes...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl shadow-lg">
      {/* Header */}
      <div className="mb-6 pb-4 border-b-2 border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            📝 Bloc-Notes
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              {notesList.length} note{notesList.length > 1 ? 's' : ''}
            </span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowList(!showList)}
              className="p-2 hover:bg-slate-200 rounded-lg transition-all"
              title="Voir toutes les notes"
            >
              <List size={20} className={showList ? 'text-blue-600' : ''} />
            </button>
            <button
              onClick={createNewNote}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-md transition-all flex items-center gap-1"
              title="Nouvelle note"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {lastSaved && (
          <div className="text-sm text-slate-600 flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
            <Clock size={16} />
            Dernière sauvegarde: {formatTime(lastSaved)}
          </div>
        )}
      </div>

      {/* Liste des notes (optionnelle) */}
      {showList && notesList.length > 0 && (
        <div className="mb-6 max-h-48 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200">
          {notesList.map((note) => (
            <div
              key={note.id}
              onClick={() => loadNote(note)}
              className="p-4 border-b last:border-b-0 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-start group"
            >
              <div className="flex-1 pr-4">
                <div className="font-medium text-slate-900 text-sm leading-tight line-clamp-2" title={note.content}>
                  {note.content || '[Note vide]'}
                </div>
                <div className="text-xs text-slate-500 mt-1.5">
                  {formatTime(note.updated_at)}
                </div>
              </div>
              <div className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {note.content.length} chars
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone d'édition */}
      <textarea
        value={currentNote.content}
        onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })}
        placeholder="Votre note existante s'affiche ici... Tapez pour modifier (auto-sauvegarde 5s)"
        className="flex-1 p-6 border-2 border-dashed border-slate-300 rounded-2xl resize-none focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50/50 font-mono text-base leading-relaxed shadow-inner"
        rows={12}
      />

      {/* Contrôles + Stats */}
      <div className="mt-6 pt-5 border-t-2 border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-medium text-slate-700 px-3 py-1.5 bg-slate-100 rounded-lg">
            {saveStatus}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={saveNote}
              disabled={isSaving || !currentNote.id}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
            >
              <Save size={18} />
              {isSaving ? 'Sauvegarde...' : 'Sauvegarder maintenant'}
            </button>
            
            <button
              onClick={() => {
                if (confirm('Vider cette note ?')) {
                  setCurrentNote({ ...currentNote, content: '' });
                  saveNote();
                }
              }}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 font-medium text-sm"
              disabled={isSaving}
            >
              <Trash2 size={18} />
              Effacer
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 text-right grid grid-cols-2 gap-4 font-mono bg-slate-50 p-2 rounded-lg">
          <span>• {currentNote.content.length} caractères</span>
          <span>• {currentNote.content.split('\n').length} lignes</span>
        </div>
      </div>
    </div>
  );
}
