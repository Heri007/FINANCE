// src/components/layout/Header.jsx
import React from 'react';
import { Wallet, Plus, Save, Calculator, Eye } from 'lucide-react';

export function Header({ 
  onAddTransaction, 
  onLogout, 
  onImport, 
  onRestore, 
  onBackup,
  onShowBookkeeper, 
  onShowNotes,
  onShowOperator, 
  onShowContent, 
  onShowReports,
  onShowProjectPlanner,   // ✅ Vérifiez que c'est bien là
  onShowProjectsList,     // ✅ Vérifiez que c'est bien là
}) {
  return (
    <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
      <div className="px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Money Tracker</h1>
              <p className="text-indigo-100 text-sm">Gestion de mes finances</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <button
    onClick={onShowNotes}
    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
    title="Bloc-Notes"
  >
    📝 Notes
  </button>
            <button onClick={onShowBookkeeper} className="bg-blue-500/80 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-blue-500/100 transition">
              Bookkeeper
            </button>
            <button onClick={onShowOperator} className="bg-purple-500/80 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-purple-500/100 transition">
              Operator
            </button>
            <button onClick={onShowContent} className="bg-pink-500/80 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-pink-500/100 transition">
              Content
            </button>
            <button onClick={onShowReports} className="bg-indigo-500/80 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-indigo-500/100 transition">
              Rapports
            </button>
            <button onClick={onBackup} className="bg-indigo-800/50 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-indigo-800 transition flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Sauvegarder</span>
            </button>
            <button onClick={onRestore} className="bg-emerald-500/80 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-emerald-500/100 transition">
              Restaurer
            </button>
            <button onClick={onImport} className="bg-white/20 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-white/30 transition">
              Import CSV
            </button>
            <button onClick={onAddTransaction} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105">
              <Plus className="w-5 h-5" />
              <span>Transaction</span>
            </button>
            <button onClick={onLogout} className="bg-white/20 backdrop-blur-sm text-white px-4 py-3 rounded-xl font-semibold hover:bg-white/30 transition">
              Sortir
            </button>
            
            {/* ✅ BOUTON PLANIFIER PROJET */}
            <button 
              onClick={onShowProjectPlanner} 
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Calculator size={18} />
              <span>📊 Planifier Projet</span>
            </button>
            
            {/* ✅ BOUTON MES PROJETS */}
            <button 
              onClick={onShowProjectsList} 
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Eye size={18} />
              <span>📁 Mes Projets</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
