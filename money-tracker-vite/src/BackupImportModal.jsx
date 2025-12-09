// src/components/BackupImportModal.jsx - VERSION CORRIGÉE
import React, { useState } from 'react';
import { X, Upload, AlertTriangle } from 'lucide-react';
import { API_BASE } from './services/api'; // ✅ Chemin corrigé

export function BackupImportModal({ onClose, onRestoreSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => setLogs(prev => [...prev, msg]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleRestore = async () => {
    if (!file) return;
    
    if (!window.confirm('⚠️ ATTENTION : Cette action va effacer toutes les données actuelles et restaurer le backup.\n\nConfirmer ?')) {
      return;
    }

    setStatus('restoring');
    setLogs([]);
    addLog('📂 Lecture du fichier de sauvegarde...');

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        
        // ✅ Validation renforcée
        if (!backupData.version || parseFloat(backupData.version) < 2.0) {
          throw new Error('Version de backup non supportée. Version 2.0+ requise.');
        }

        const { accounts, transactions, receivables = [], projects = [] } = backupData;

        if (!Array.isArray(accounts) || !Array.isArray(transactions)) {
          throw new Error('Format invalide: "accounts" et "transactions" doivent être des tableaux');
        }

        addLog(`✅ Fichier valide: ${accounts.length} comptes, ${transactions.length} transactions, ${receivables.length} avoirs, ${projects.length} projets`);

        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        // ÉTAPE 1: Réinitialiser la base
        addLog('🧹 Nettoyage de la base de données...');
        const resetRes = await fetch(`${API_BASE}/reset-data`, { method: 'POST', headers });

        if (!resetRes.ok) {
          const errorData = await resetRes.json();
          throw new Error(`Impossible de vider la base: ${errorData.error}`);
        }

        addLog('✅ Base nettoyée avec succès');

        // ÉTAPE 2: Restaurer les comptes
        addLog(`🔄 Restauration de ${accounts.length} comptes...`);
        const idMap = {};

        for (const acc of accounts) {
          const res = await fetch(`${API_BASE}/accounts`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              name: acc.name,
              type: acc.type,
              balance: 0 
            })
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(`Erreur création compte ${acc.name}: ${error.error}`);
          }

          const newAcc = await res.json();
          const oldId = acc.id || acc.accountId;
          idMap[oldId] = newAcc.id;
          
          addLog(`  • Compte créé: ${acc.name} (ID ${newAcc.id})`);
        }

        // ✅ ÉTAPE 2.5: Restaurer les PROJETS
        const projectIdMap = {};
        
        if (projects.length > 0) {
          addLog(`🔄 Restauration de ${projects.length} projets...`);
          
          for (const proj of projects) {
            try {
              const body = {
                name: proj.name,
                description: proj.description || '',
                budget: parseFloat(proj.budget || 0),
                start_date: proj.start_date,
                end_date: proj.end_date || null,
                status: proj.status || 'active',
                is_recurring: proj.is_recurring || false,
                recurrence_type: proj.recurrence_type || null
              };

              const res = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
              });

              if (!res.ok) {
                const err = await res.json();
                addLog(`⚠️ Erreur projet ${proj.name}: ${err.error}`);
              } else {
                const newProj = await res.json();
                projectIdMap[proj.id] = newProj.id;
                addLog(`  • Projet créé: ${proj.name} (ID ${newProj.id})`);
              }
            } catch (err) {
              addLog(`⚠️ Exception projet ${proj.name}: ${err.message}`);
            }
          }
          addLog(`✅ ${Object.keys(projectIdMap).length}/${projects.length} projets restaurés`);
        }

        // ÉTAPE 3: Restaurer les transactions
        addLog(`🔄 Restauration de ${transactions.length} transactions...`);

        const sortedTransactions = [...transactions].sort((a, b) => {
          const dateA = new Date(a.date || a.transaction_date);
          const dateB = new Date(b.date || b.transaction_date);
          return dateA - dateB;
        });

        let successCount = 0;
        let failedTransactions = [];

        for (const trx of sortedTransactions) {
          try {
            const oldAccId = trx.account_id || trx.accountId;
            const newAccId = idMap[oldAccId];

            if (!newAccId) {
              failedTransactions.push(`Skipped: ${trx.description} (Compte ID ${oldAccId} introuvable)`);
              continue;
            }

            const rawDate = trx.date || trx.transaction_date;
            const formattedDate = rawDate ? rawDate.split('T')[0] : new Date().toISOString().split('T')[0];

            const transactionData = {
              account_id: newAccId,
              type: trx.type,
              amount: parseFloat(trx.amount),
              category: trx.category,
              description: trx.description,
              date: formattedDate,
              is_planned: trx.is_planned || false,
                            is_posted: trx.is_posted !== undefined ? trx.is_posted : true,
              project_id: trx.project_id ? (projectIdMap[trx.project_id] || null) : null, // ✅ Mapping des projets
              remarks: trx.remarks || ''
            };

            const response = await fetch(`${API_BASE}/transactions`, {
              method: 'POST',
              headers,
              body: JSON.stringify(transactionData)
            });

            if (!response.ok) {
              const error = await response.json();
              failedTransactions.push(`${trx.description}: ${error.error}`);
            } else {
              successCount++;
              // Log visuel tous les 20 items pour montrer la progression
              if (successCount % 20 === 0) {
                addLog(`  ... ${successCount}/${sortedTransactions.length} restaurées`);
              }
            }
          } catch (err) {
            failedTransactions.push(`${trx.description}: ${err.message}`);
          }
        }

        addLog(`✅ ${successCount}/${sortedTransactions.length} transactions restaurées`);
        
        if (failedTransactions.length > 0) {
          addLog(`⚠️ ${failedTransactions.length} erreurs de transactions`);
          // Log les 5 premières erreurs pour diagnostic
          failedTransactions.slice(0, 5).forEach(err => addLog(`  • ${err}`));
          if (failedTransactions.length > 5) {
            addLog(`  • ... et ${failedTransactions.length - 5} autres erreurs`);
          }
        }

        // ---------------------------------------------------------------------
// ÉTAPE 4: Restaurer les AVOIRS (Receivables)
// ---------------------------------------------------------------------
let recSuccess = 0; // ✅ Déclarer AVANT le if pour être accessible partout

if (receivables.length > 0) {
  addLog(`🔄 Restauration de ${receivables.length} avoirs...`);
  
  for (const r of receivables) {
    try {
      // ✅ Amélioration du mapping des comptes
      const oldAccId = r.account_id || r.accountId;
      let newAccId = idMap[oldAccId];
      
      if (!newAccId) {
        // Chercher le compte "Avoir" par son nom
        const avoirAccount = accounts.find(a => a.name.toLowerCase() === 'avoir');
        newAccId = avoirAccount ? idMap[avoirAccount.id] : null;
      }

      if (!newAccId) {
        addLog(`⚠️ Avoir ignoré (pas de compte): ${r.person}`);
        continue;
      }

      const body = {
        account_id: newAccId,
        person: r.person,
        description: r.description,
        amount: parseFloat(r.amount),
        status: r.status || 'open',
        source_account_id: r.source_account_id ? idMap[r.source_account_id] || null : null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };

      const res = await fetch(`${API_BASE}/receivables/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        addLog(`⚠️ Erreur avoir ${r.person}: ${err.error}`);
      } else {
        recSuccess++;
      }
    } catch (err) {
      addLog(`⚠️ Exception avoir ${r.person}: ${err.message}`);
    }
  }
  addLog(`✅ ${recSuccess}/${receivables.length} avoirs restaurés`);
}

        // ---------------------------------------------------------------------
        // ÉTAPE 5: Recalculer les soldes (Sécurité)
        // ---------------------------------------------------------------------
        addLog('🔄 Recalcul et vérification des soldes...');
        
        const recalcRes = await fetch(`${API_BASE}/accounts/recalculate-all`, {
          method: 'POST',
          headers
        });

        if (!recalcRes.ok) {
          const error = await recalcRes.json();
          throw new Error(`Erreur recalcul des soldes: ${error.error}`);
        }

        const recalcData = await recalcRes.json();

        // ---------------------------------------------------------------------
        // RAPPORT FINAL
        // ---------------------------------------------------------------------
        addLog(`\n📊 === RAPPORT FINAL ===`);
        addLog(`✅ ${accounts.length} comptes restaurés`);
        addLog(`✅ ${Object.keys(projectIdMap).length}/${projects.length} projets restaurés`);
        addLog(`✅ ${successCount}/${transactions.length} transactions restaurées`);
        addLog(`✅ ${receivables.length > 0 ? `${recSuccess}/${receivables.length}` : '0'} avoirs restaurés`);
        
        if (failedTransactions.length > 0) {
          addLog(`⚠️ ${failedTransactions.length} erreurs transactions (voir logs détaillés)`);
        }

        addLog(`\n💰 VÉRIFICATION DES SOLDES:`);
        let mismatchCount = 0;
        
        recalcData.results.forEach(r => {
          const originalAccount = accounts.find(a => a.name === r.accountName);
          let statusIcon = "✅";
          
          if (originalAccount) {
            const backupBalance = parseFloat(originalAccount.balance);
            const diff = Math.abs(r.newBalance - backupBalance);
            
            if (diff > 0.01) {
              statusIcon = "⚠️";
              mismatchCount++;
              addLog(`${statusIcon} ${r.accountName}: ${r.newBalance.toLocaleString('fr-FR')} Ar (Backup: ${backupBalance.toLocaleString('fr-FR')} Ar - Écart: ${diff.toLocaleString('fr-FR')} Ar)`);
            } else {
              addLog(`${statusIcon} ${r.accountName}: ${r.newBalance.toLocaleString('fr-FR')} Ar`);
            }
          }
        });

        if (mismatchCount === 0 && failedTransactions.length === 0) {
          addLog(`\n🎉 SUCCÈS TOTAL: Restauration complète et cohérente.`);
          setStatus('success');
          setTimeout(() => {
            onRestoreSuccess();
            onClose();
          }, 4000);
        } else if (mismatchCount > 0) {
          addLog(`\n⚠️ ATTENTION: ${mismatchCount} écart(s) de solde détecté(s).`);
          addLog(`Vérifiez les transactions manquantes ou en erreur.`);
          setStatus('warning');
        } else {
          addLog(`\n✅ Restauration terminée avec quelques erreurs mineures.`);
          setStatus('warning');
        }

      } catch (error) {
        console.error('❌ Erreur globale:', error);
        addLog(`\n❌ ERREUR CRITIQUE: ${error.message}`);
        addLog(`\nSi le problème persiste, vérifiez:`);
        addLog(`• La connexion au serveur`);
        addLog(`• Le format du fichier backup`);
        addLog(`• Les logs du serveur backend`);
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
          disabled={status === "restoring"}
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
                  Toutes vos données actuelles (comptes, transactions, projets, avoirs) seront remplacées par celles du backup.
                </p>
              </div>
            </div>
          </div>

          {/* Zone de Drop / Sélection */}
          <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            file ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'border-gray-300 hover:bg-gray-50 hover:border-gray-400'
          }`}>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileChange} 
              className="hidden" 
              id="backup-file"
              disabled={status === "restoring"}
            />
            <label
              htmlFor="backup-file"
              className={`cursor-pointer flex flex-col items-center ${status === "restoring" ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Upload className={`w-12 h-12 mb-3 transition-colors ${file ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span className={`font-medium transition-colors ${file ? 'text-indigo-700' : 'text-gray-600'}`}>
                {file ? file.name : "Cliquez pour choisir le fichier JSON"}
              </span>
              {file && (
                <span className="text-xs text-indigo-500 mt-2 px-3 py-1 bg-indigo-100 rounded-full">
                  ✓ Fichier sélectionné
                </span>
              )}
              {!file && (
                <span className="text-xs text-gray-400 mt-2">
                  Format: .json • Version 2.0+
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
                <div ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "end" })} />
              </div>
            </div>
          )}
        </div>

        {/* Bouton d'action */}
        <button
          onClick={handleRestore}
          disabled={!file || status === "restoring"}
          className={`w-full py-3 rounded-xl font-semibold text-white transition-all mt-4 flex items-center justify-center gap-2 ${
            status === "restoring" 
              ? "bg-gray-400 cursor-wait" 
              : status === "success"
              ? "bg-green-500 hover:bg-green-600"
              : status === "warning"
              ? "bg-amber-500 hover:bg-amber-600"
              : status === "error"
              ? "bg-red-500 hover:bg-red-600"
              : "bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl active:scale-95"
          }`}
        >
          {status === "restoring" && (
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {status === "restoring" ? "Restauration en cours..." 
           : status === "success" ? "✓ Restauration Terminée avec Succès"
           : status === "warning" ? "⚠️ Terminée avec Avertissements"
           : status === "error" ? "❌ Échec de la Restauration"
           : "🚀 Lancer la Restauration"}
        </button>

        {/* Message d'aide en cas d'erreur */}
        {status === "error" && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Consultez les logs ci-dessus pour plus de détails
          </p>
        )}
      </div>
    </div>
  );
}
