// src/BackupImportModal.jsx - VERSION SIMPLIFIÉE ET CORRIGÉE
import React, { useState } from 'react';
import { X, Upload, AlertTriangle } from 'lucide-react';
import api from './services/api';

export function BackupImportModal({ onClose, onRestoreSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

 const handleRestore = async () => {
  if (!file) return;
  
  if (!window.confirm(
    'ATTENTION: Cette action va remplacer toutes vos données actuelles par celles du backup.'
  )) return;

  setStatus('restoring');
  setLogs([]);
  addLog('📖 Lecture du fichier de sauvegarde...');

  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const backupData = JSON.parse(e.target.result);

      // Validation de version
      if (!backupData.version || parseFloat(backupData.version) < 2.0) {
        throw new Error('Version de backup non supportée. Version 2.0+ requise.');
      }

      // ✅ CORRECTION: Utiliser snake_case comme dans le fichier JSON
      const {
        accounts,
        transactions,
        receivables = [],
        projects = [],
        notes = [],
        visions = [],
        objectives = [],
        employees = [],
        project_partners = [],
        profit_distributions = [],
        partner_payments = [],
        project_expense_lines = [],      // ✅ CORRIGÉ: snake_case
        project_revenue_lines = []       // ✅ CORRIGÉ: snake_case
      } = backupData;

      // Validation basique
      if (!Array.isArray(accounts) || !Array.isArray(transactions)) {
        throw new Error('Format invalide: accounts et transactions doivent être des tableaux');
      }

      addLog(`✅ Fichier valide:`);
      addLog(`  - ${accounts.length} comptes`);
      addLog(`  - ${transactions.length} transactions`);
      addLog(`  - ${receivables.length} receivables`);
      addLog(`  - ${projects.length} projets`);
      addLog(`  - ${project_expense_lines.length} lignes de dépenses`);  // ✅ CORRIGÉ
      addLog(`  - ${project_revenue_lines.length} lignes de revenus`);   // ✅ CORRIGÉ
      addLog(`  - ${notes?.length || 0} notes`);
      addLog(`  - ${visions?.length || 0} visions`);
      addLog(`  - ${objectives?.length || 0} objectifs`);
      addLog(`  - ${employees?.length || 0} employés`);
      addLog(`  - ${project_partners?.length || 0} associés`);
      addLog(`  - ${profit_distributions?.length || 0} distributions`);
      addLog(`  - ${partner_payments?.length || 0} paiements`);

      // ✅ Envoi de la restauration au serveur
addLog('📤 Envoi de la restauration au serveur...');

const restorePayload = {
  backup: backupData,  // Envoyer TOUT le backup tel quel
  options: {
    includeProjects: projects.length > 0,
    dryRun: false
  }
};

const response = await api.post('backup/restore-full', restorePayload);

// ✅ CORRECTION: Gérer les deux cas (response.data OU response)
const result = response.data || response;

// ✅ Validation de la structure de réponse
if (!result || !result.summary) {
  console.error('⚠️ Format de réponse inattendu:', result);
  addLog('⚠️ Restauration effectuée mais format de réponse inattendu');
  addLog('Vérifiez les données dans la base de données');
  setStatus('success');
  setTimeout(() => {
    onRestoreSuccess?.();
    onClose();
  }, 3000);
  return;
}

// ✅ Affichage du résumé
addLog('✅ RESTAURATION RÉUSSIE !');
addLog(`📊 Comptes restaurés: ${result.summary.accounts}`);
addLog(`📊 Transactions restaurées: ${result.summary.transactions}`);
addLog(`📊 Receivables restaurés: ${result.summary.receivables}`);
addLog(`📊 Projets restaurés: ${result.summary.projects}`);
addLog(`📊 Lignes de dépenses: ${result.summary.expenseLines || 0}`);
addLog(`📊 Lignes de revenus: ${result.summary.revenueLines || 0}`);

setStatus('success');

setTimeout(() => {
  onRestoreSuccess?.();
  onClose();
}, 3000);

    } catch (error) {
      console.error('❌ Erreur globale:', error);
      addLog(`🔴 ERREUR CRITIQUE: ${error.message}`);
      addLog('Vérifiez:');
      addLog('- La connexion au serveur');
      addLog('- Le format du fichier backup');
      addLog('- Les logs du serveur backend');
      setStatus('error');
    }
  };

  reader.onerror = () => {
    addLog('❌ Erreur de lecture du fichier');
    setStatus('error');
  };

  reader.readAsText(file);
};

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative max-h-[90vh] overflow-hidden flex flex-col">
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          disabled={status === 'restoring'}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-6 h-6 text-indigo-600" />
          Restaurer une Sauvegarde
        </h2>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Avertissement */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-700 font-medium mb-1">
                  Cette action est <strong>irréversible</strong>
                </p>
                <p className="text-xs text-amber-600">
                  Toutes vos données actuelles (comptes, transactions, projets,
                  receivables) seront remplacées par celles du backup.
                </p>
              </div>
            </div>
          </div>

          {/* Zone de Drop / Sélection */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              file
                ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
              id="backup-file"
              disabled={status === 'restoring'}
            />
            <label
              htmlFor="backup-file"
              className={`cursor-pointer flex flex-col items-center ${
                status === 'restoring' ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <Upload
                className={`w-12 h-12 mb-3 transition-colors ${
                  file ? 'text-indigo-600' : 'text-gray-400'
                }`}
              />
              <span
                className={`font-medium transition-colors ${
                  file ? 'text-indigo-700' : 'text-gray-600'
                }`}
              >
                {file ? file.name : 'Cliquez pour choisir le fichier JSON'}
              </span>
              {file && (
                <span className="text-xs text-indigo-500 mt-2 px-3 py-1 bg-indigo-100 rounded-full">
                  Fichier sélectionné
                </span>
              )}
              {!file && (
                <span className="text-xs text-gray-400 mt-2">
                  Format .json • Version 2.0
                </span>
              )}
            </label>
          </div>

          {/* Console de logs */}
          {logs.length > 0 && (
            <div className="relative">
              <div className="absolute top-2 right-2 text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {logs.length} logs
              </div>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800">
                {logs.map((log, i) => (
                  <div key={i} className="mb-1 break-words leading-relaxed">
                    {log}
                  </div>
                ))}
                {/* Auto-scroll */}
                <div
                  ref={(el) => el?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bouton d'action */}
        <button
          onClick={handleRestore}
          disabled={!file || status === 'restoring'}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all mt-4 flex items-center justify-center gap-2 ${
            status === 'restoring'
              ? 'bg-gray-400 cursor-wait'
              : status === 'success'
                ? 'bg-green-500 hover:bg-green-600'
                : status === 'error'
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl active:scale-95'
          }`}
        >
          {status === 'restoring' && (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              ircle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
              strokeWidth="4" fill="none" /
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {status === 'restoring'
            ? 'Restauration en cours...'
            : status === 'success'
              ? '✅ Restauration Terminée avec Succès'
              : status === 'error'
                ? '❌ Échec de la Restauration'
                : 'Lancer la Restauration'}
        </button>

        {status === 'error' && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Consultez les logs ci-dessus pour plus de détails
          </p>
        )}
      </div>
    </div>
  );
}
