// src/components/NotesSlide.jsx
import React, { useState, useEffect } from "react";
import { Save, Trash2, Clock, Plus, ChevronLeft, FileText } from "lucide-react";
import { API_BASE } from "../services/api";

export default function NotesSlide() {
  const [view, setView] = useState("list"); // 'list' ou 'edit'
  const [notesList, setNotesList] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Charger les notes au démarrage
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const response = await fetch(`${API_BASE}/notes`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.id ? [data] : [];
        list.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at)
        );
        setNotesList(list);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
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
      const response = await fetch(`${API_BASE}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ content: "" }),
      });
      if (response.ok) {
        const newNote = await response.json();
        setNotesList((prev) => [newNote, ...prev]);
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
    setSaveStatus("Sauvegarde...");
    try {
      const response = await fetch(`${API_BASE}/notes/${currentNote.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ content: currentNote.content || "" }),
      });
      if (response.ok) {
        const updated = await response.json();
        setSaveStatus("✅ Sauvegardé");
        setNotesList((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
        );
        setTimeout(() => setSaveStatus(""), 2000);
      }
    } catch (error) {
      console.error(error);
      setSaveStatus("❌ Erreur");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto‑save après 3s d’inactivité en mode édition
  useEffect(() => {
    if (view === "edit" && currentNote?.id) {
      const timer = setTimeout(saveCurrentNote, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentNote?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette note ?")) return;
    try {
      await fetch(`${API_BASE}/notes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setNotesList((prev) => prev.filter((n) => n.id !== id));
      if (view === "edit" && currentNote?.id === id) {
        setView("list");
        setCurrentNote(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Vue liste
  if (view === "list") {
    return (
      <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Notes de travail
            </h2>
          </div>
          <button
            onClick={createNote}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nouvelle note
          </button>
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
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
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
    );
  }

  // Vue édition
  return (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
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
  );
}
