import React, { useState } from 'react';
import {
  Plus,
  LogOut,
  Upload,
  Download,
  FileText,
  Calculator,
  UserCog,
  Copy,
  BarChart3,
  FolderKanban,
  List,
  Menu,
  X,
} from 'lucide-react';

export function Header({
  onAddTransaction,
  onLogout,
  onImport,
  onRestore,
  onBackup,
  onShowNotes,
  onShowBookkeeper,
  onShowOperator,
  onShowContent,
  onShowReports,
  onShowProjectPlanner,
  onShowProjectsList,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className="
      bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800
      shadow-xl 
      border-b-4 border-slate-600
      sticky top-0 z-50
      backdrop-blur-sm
    "
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Titre */}
          <div className="flex items-center gap-4">
            <div className="bg-slate-600 p-3 rounded-xl shadow-lg">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">MONEY 💰</h1>
              <p className="text-xs text-slate-300 font-semibold uppercase tracking-widest">
                Gestion de Porte-Feuille
              </p>
            </div>
          </div>

          {/* Navigation Desktop */}
          <nav className="hidden lg:flex items-center gap-2">
            {/* Transaction */}
            <button
              onClick={onAddTransaction}
              className="
                flex items-center gap-2 
                bg-emerald-600 hover:bg-emerald-700
                text-white font-bold 
                px-4 py-2.5 
                rounded-lg 
                shadow-md hover:shadow-lg
                transition-all duration-200
                border-2 border-emerald-500
              "
            >
              <Plus size={18} strokeWidth={3} />
              <span className="text-sm">Transaction</span>
            </button>

            {/* Import/Export */}
            <div className="flex items-center gap-2 border-l-2 border-slate-600 pl-2 ml-2">
              <button
                onClick={onImport}
                className="
                  flex items-center gap-2 
                  bg-slate-600 hover:bg-slate-500
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Importer CSV"
              >
                <Upload size={16} strokeWidth={2.5} />
                <span className="text-xs">Import CSV</span>
              </button>

              <button
                onClick={onBackup}
                className="
                  flex items-center gap-2 
                  bg-slate-600 hover:bg-slate-500
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Exporter Backup"
              >
                <Download size={16} strokeWidth={2.5} />
                <span className="text-xs">Backup</span>
              </button>

              <button
                onClick={onRestore}
                className="
                  flex items-center gap-2 
                  bg-amber-600 hover:bg-amber-700
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Restaurer"
              >
                <Upload size={16} strokeWidth={2.5} />
                <span className="text-xs">Restaurer</span>
              </button>
            </div>

            {/* Outils */}
            <div className="flex items-center gap-2 border-l-2 border-slate-600 pl-2 ml-2">
              <button
                onClick={onShowNotes}
                className="
                  p-2.5 rounded-lg 
                  bg-slate-600 hover:bg-blue-600
                  text-white 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Notes"
              >
                <FileText size={18} strokeWidth={2.5} />
              </button>

              <button
                onClick={onShowReports}
                className="
                  p-2.5 rounded-lg 
                  bg-slate-600 hover:bg-indigo-600
                  text-white 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Rapports"
              >
                <BarChart3 size={18} strokeWidth={2.5} />
              </button>

              <button
                onClick={onShowBookkeeper}
                className="
                  p-2.5 rounded-lg 
                  bg-slate-600 hover:bg-purple-600
                  text-white 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Bookkeeper"
              >
                <Calculator size={18} strokeWidth={2.5} />
              </button>

              <button
                onClick={onShowOperator}
                className="
                  p-2.5 rounded-lg 
                  bg-slate-600 hover:bg-teal-600
                  text-white 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Operator"
              >
                <UserCog size={18} strokeWidth={2.5} />
              </button>

              <button
                onClick={onShowContent}
                className="
                  p-2.5 rounded-lg 
                  bg-slate-600 hover:bg-pink-600
                  text-white 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Content Replicator"
              >
                <Copy size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Projets */}
            <div className="flex items-center gap-2 border-l-2 border-slate-600 pl-2 ml-2">
              <button
                onClick={onShowProjectPlanner}
                className="
                  flex items-center gap-2 
                  bg-blue-600 hover:bg-blue-700
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Planifier Projet"
              >
                <FolderKanban size={16} strokeWidth={2.5} />
                <span className="text-xs">Planifier Projet</span>
              </button>

              <button
                onClick={onShowProjectsList}
                className="
                  flex items-center gap-2 
                  bg-indigo-600 hover:bg-indigo-700
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Mes Projets"
              >
                <List size={16} strokeWidth={2.5} />
                <span className="text-xs">Mes Projets</span>
              </button>
            </div>

            {/* Logout */}
            <div className="border-l-2 border-slate-600 pl-2 ml-2">
              <button
                onClick={onLogout}
                className="
                  flex items-center gap-2 
                  bg-rose-600 hover:bg-rose-700
                  text-white font-semibold
                  px-3 py-2.5 
                  rounded-lg 
                  shadow-md hover:shadow-lg
                  transition-all duration-200
                "
                title="Déconnexion"
              >
                <LogOut size={16} strokeWidth={2.5} />
                <span className="text-xs">Logout</span>
              </button>
            </div>
          </nav>

          {/* Burger Menu (Mobile) */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-slate-600 text-white"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Menu Mobile */}
        {isMenuOpen && (
          <div className="lg:hidden mt-4 pt-4 border-t-2 border-slate-600 space-y-2">
            <button
              onClick={() => {
                onAddTransaction();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-emerald-600 text-white font-bold px-4 py-3 rounded-lg"
            >
              <Plus size={18} />
              <span>Nouvelle Transaction</span>
            </button>

            <button
              onClick={() => {
                onImport();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <Upload size={18} />
              <span>Import CSV</span>
            </button>

            <button
              onClick={() => {
                onBackup();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <Download size={18} />
              <span>Exporter Backup</span>
            </button>

            <button
              onClick={() => {
                onRestore();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-amber-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <Upload size={18} />
              <span>Restaurer</span>
            </button>

            <button
              onClick={() => {
                onShowReports();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-slate-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <BarChart3 size={18} />
              <span>Rapports</span>
            </button>

            <button
              onClick={() => {
                onShowProjectPlanner();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-blue-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <FolderKanban size={18} />
              <span>Planifier Projet</span>
            </button>

            <button
              onClick={() => {
                onShowProjectsList();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-indigo-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <List size={18} />
              <span>Mes Projets</span>
            </button>

            <button
              onClick={() => {
                onLogout();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-rose-600 text-white font-semibold px-4 py-3 rounded-lg"
            >
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
