// src/components/NotesSlide.jsx
import React, { useState, useEffect } from "react";
import { Save, Trash2, Clock, Plus, ChevronLeft, FileText, X } from "lucide-react";
import { apiRequest } from '../services/api';

export default function NotesSlide({ isOpen, onClose }) {
  // Si pas ouvert, ne rien rendre
  if (!isOpen) return null;

  const [view, setView] = useState("list");
  const [notesList, setNotesList] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen]);

  const fetchNotes = async () => {
    try {
      console.log('🔍 Fetching notes...');
      const data = await apiRequest('/notes');
      console.log('📝 Notes received:', data.length);
      const list = Array.isArray(data) ? data : data.id ? [data] : [];
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
      );
      setNotesList(list);
    } catch (error) {
      console.error("❌ Erreur chargement:", error);
    } finally {
      setLoading(false);
    }
  };

  const openNote = (note) => {
    setCurrentNote({ ...note });
    setSaveStatus("Prêt");
    setView("edit");
  };

  const createNote = async () => {
    try {
      setLoading(true);
      const newNote = await apiRequest('/notes', {
        method: 'POST',
        body: JSON.stringify({ content: "" }),
      });
      setNotesList((prev) => [newNote, ...prev]);
      openNote(newNote);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentNote = async () => {
    if (!currentNote || !currentNote.id) return;
    setIsSaving(true);
    setSaveStatus("Sauvegarde...");
    try {
      const updated = await apiRequest(`/notes/${currentNote.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: currentNote.content || "" }),
      });
      setSaveStatus("✅ Sauvegardé");
      setNotesList((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (error) {
      console.error(error);
      setSaveStatus("❌ Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (view === "edit" && currentNote?.id) {
      const timer = setTimeout(saveCurrentNote, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentNote?.content]); // eslint-disable-line

  const deleteNote = async (e, id) => {
  e.stopPropagation();
  if (!confirm("Supprimer cette note ?")) return;
  try {
    await apiRequest(`/notes/${id}`, { method: 'DELETE' });
    setNotesList((prev) => prev.filter((n) => n.id !== id));
    if (view === "edit" && currentNote?.id === id) {
      setView("list");
      setCurrentNote(null);
    }
  } catch (error) {
    // Si 404, la note n'existe déjà plus (OK)
    if (error?.status === 404) {
      console.log('⚠️ Note déjà supprimée');
      setNotesList((prev) => prev.filter((n) => n.id !== id));
      if (view === "edit" && currentNote?.id === id) {
        setView("list");
        setCurrentNote(null);
      }
    } else {
      console.error('❌ Erreur suppression:', error);
      alert('Erreur lors de la suppression de la note');
    }
  }
};


  // Vue liste
  if (view === "list") {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="flex flex-col h-[600px] max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                Notes de travail
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={createNote}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                Nouvelle note
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-gray-500">
                Chargement des notes...
              </div>
            )}

            {!loading && notesList.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                Aucune note pour le moment.
                <br />
                Cliquez sur &quot;Nouvelle note&quot; pour commencer.
              </div>
            )}

            <ul className="divide-y divide-gray-100">
              {notesList.map((note) => (
                <li
                  key={note.id}
                  onClick={() => openNote(note)}
                  className="px-6 py-4 hover:bg-blue-300 cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-extrabold text-gray-900 truncate">
                        {note.content
                          ? note.content.split("\n")[0].substring(0, 80)
                          : "Nouvelle note..."}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(
                          note.updated_at || note.created_at
                        ).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteNote(e, note.id)}
                    className="p-2 rounded-full hover:bg-red-50 text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Vue édition
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex flex-col h-[600px] max-w-4xl w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("list")}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-indigo-100 text-indigo-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800">
                Édition de note
              </span>
              <span className="text-xs text-gray-500">
                {currentNote?.updated_at
                  ? new Date(currentNote.updated_at).toLocaleString("fr-FR")
                  : "Nouvelle note"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus && (
              <span className="text-xs text-gray-500">{saveStatus}</span>
            )}
            <button
              onClick={saveCurrentNote}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              Sauvegarder
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <textarea
          className="flex-1 w-full p-6 font-mono text-sm text-gray-800 outline-none resize-none"
          placeholder="Écrivez vos notes ici..."
          value={currentNote?.content || ""}
          onChange={(e) =>
            setCurrentNote((prev) => ({ ...prev, content: e.target.value }))
          }
        />
      </div>
    </div>
  );
}
