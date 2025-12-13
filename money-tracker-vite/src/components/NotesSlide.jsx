// src/components/NotesSlide.jsx - VERSION AGRANDIE ET LISIBLE
import React, { useState, useEffect } from 'react';
import { Save, Trash2, Clock, Plus, ChevronLeft, FileText } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function NotesSlide() {
  const [view, setView] = useState('list'); // 'list' ou 'edit'
  const [notesList, setNotesList] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // 1. CHARGER LA LISTE AU DÉMARRAGE
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`${API_BASE}/notes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.id ? [data] : []);
        list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        setNotesList(list);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNote = (note) => {
    setCurrentNote({ ...note });
    setSaveStatus('Prêt');
    setView('edit');
  };

  const createNote = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: '' })
      });
      
      if (response.ok) {
        const newNote = await response.json();
        setNotesList([newNote, ...notesList]);
        openNote(newNote);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentNote = async () => {
    if (!currentNote || !currentNote.id) return;
    
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
        const updated = await response.json();
        setSaveStatus('✅ Sauvegardé');
        setNotesList(prev => prev.map(n => n.id === updated.id ? updated : n));
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (error) {
      setSaveStatus('❌ Erreur');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (view === 'edit' && currentNote?.id) {
      const timer = setTimeout(saveCurrentNote, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentNote?.content]);

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette note ?")) return;

    try {
      await fetch(`${API_BASE}/notes/${id}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNotesList(prev => prev.filter(n => n.id !== id));
      if (view === 'edit' && currentNote?.id === id) {
        setView('list');
      }
    } catch (e) { console.error(e); }
  };

  if (loading && view === 'list') {
    return <div className="p-12 text-center text-gray-500 text-lg">Chargement...</div>;
  }

  // --- VUE LISTE (AGRANDIE) ---
  if (view === 'list') {
    return (
      // h-[80vh] force une grande hauteur par défaut
      <div className="flex flex-col bg-gray-50 rounded-xl overflow-hidden shadow-lg border border-gray-200 h-[75vh]">
        <div className="p-6 bg-white border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <FileText className="text-blue-600" size={28} />
            Mes Notes ({notesList.length})
          </h2>
          <button 
            onClick={createNote}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 text-base font-semibold transition-all shadow-md"
          >
            <Plus size={20} /> Nouvelle Note
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {notesList.length === 0 ? (
            <div className="text-center text-gray-400 mt-20">
              <p className="text-xl">Aucune note pour le moment.</p>
              <p className="text-sm mt-3">Cliquez sur "Nouvelle Note" pour commencer.</p>
            </div>
          ) : (
            notesList.map(note => (
              <div 
                key={note.id}
                onClick={() => openNote(note)}
                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-400 cursor-pointer transition-all group relative"
              >
                <div className="pr-10">
                  {/* Titre plus grand */}
                  <p className="font-bold text-gray-900 text-lg mb-2 line-clamp-1">
                    {note.content ? note.content.split('\n')[0].substring(0, 80) : 'Nouvelle note...'}
                  </p>
                  
                  {/* Contenu : Affichage de 6 lignes au lieu de 2 */}
                  <p className="text-base text-gray-600 line-clamp-6 leading-relaxed whitespace-pre-wrap">
                    {note.content || '(Vide)'}
                  </p>
                  
                  <div className="flex items-center gap-2 mt-4 text-sm text-gray-400 bg-gray-50 inline-block px-3 py-1 rounded-lg">
                    <Clock size={14} />
                    {new Date(note.updated_at).toLocaleString('fr-FR', {
                      day: 'numeric', month: 'long', hour: '2-digit', minute:'2-digit'
                    })}
                  </div>
                </div>
                
                <button 
                  onClick={(e) => deleteNote(e, note.id)}
                  className="absolute top-6 right-6 text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- VUE ÉDITEUR (AGRANDIE) ---
  return (
    // h-[80vh] force une grande hauteur pour l'édition
    <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow-2xl border border-gray-200 h-[80vh]">
      {/* Header Éditeur */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
        <button 
          onClick={() => {
            saveCurrentNote(); 
            setView('list');
          }}
          className="flex items-center text-gray-700 hover:text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-base font-bold"
        >
          <ChevronLeft size={24} className="mr-1" /> Retour liste
        </button>
        
        <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          {saveStatus || (isSaving ? 'Enregistrement...' : 'Mode Édition')}
        </div>

        <button 
          onClick={(e) => deleteNote(e, currentNote.id)}
          className="text-red-500 hover:text-white hover:bg-red-500 p-3 rounded-lg transition-colors border border-red-200"
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* Zone de texte géante */}
      <div className="flex-1 relative bg-white">
        <textarea
            key={currentNote.id}
            value={currentNote.content}
            onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })}
            placeholder="Écrivez votre note ici..."
            // Texte plus grand (text-lg) et plus aéré (leading-relaxed)
            className="w-full h-full p-8 resize-none outline-none text-gray-800 font-mono text-lg leading-loose"
            autoFocus
            spellCheck={false}
        />
      </div>
      
      <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500 flex justify-between uppercase tracking-wide">
         <span>ID: {currentNote.id}</span>
         <span>{currentNote.content ? currentNote.content.length : 0} caractères</span>
      </div>
    </div>
  );
}