// src/components/ImportModal.jsx - VERSION AVEC SIGNATURE LOCALE ANTI-DOUBLONS

import React, { useState } from 'react';
import Papa from 'papaparse';
import { parseJSONSafe, normalizeDate } from './domain/finance/parsers';
import { buildTransactionSignature } from './domain/finance/signature';

const ImportModal = ({ isOpen, onClose, accounts, onImport }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [logs, setLogs] = useState([]);

  if (!isOpen) return null;

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);
    console.log(msg);
  };

  const handleFileChange = (e) => {
    setSelectedFiles(Array.from(e.target.files));
    setLogs([]);
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      alert('Veuillez sélectionner au moins un fichier');
      return;
    }

    setIsImporting(true);
    setLogs([]);
    addLog('📁 Début de l\'analyse des fichiers CSV...');
    addLog(`🏦 Comptes disponibles: ${accounts.length}`);

    const EXPLICIT_MAPPING = {
      argent_liquide: 1,
      argentliquide: 1,
      mvola: 2,
      orange_money: 3,
      orangemoney: 3,
      boa: 4,
      compte_boa: 4,
      compteboa: 4,
      coffre: 5,
      avoir: 7,
      redotpay: 6
    };

    // ⚠️ Idéalement: injecter CUTOFF_DATE par compte depuis le backend
    // const CUTOFF_DATE = '2025-12-10';

    // 1) Mapping fichiers → comptes
    const fileMappings = {};

    selectedFiles.forEach(file => {
      const fileName = file.name.toLowerCase()
        .replace(/-/g, '_')
        .replace(/\s+/g, '_')
        .replace('.csv', '')
        .replace('_mga', '')
        .replace('mga', '')
        .trim();

      addLog(`🔍 Analyse: ${file.name} → "${fileName}"`);

      const explicitId = EXPLICIT_MAPPING[fileName];
      if (explicitId) {
        const account = accounts.find(a => a.id === explicitId);
        if (account) {
          fileMappings[file.name] = explicitId;
          addLog(`✅ ${file.name} → ${account.name} (ID ${explicitId})`, 'success');
          return;
        }
      }

      const matchedAccount = accounts.find(acc => {
        const accName = acc.name.toLowerCase()
          .replace(/[-\s]/g, '_')
          .replace(/[éèê]/g, 'e')
          .replace(/[àâ]/g, 'a');
        return accName.includes(fileName) || fileName.includes(accName) || accName === fileName;
      });

      if (matchedAccount) {
        fileMappings[file.name] = matchedAccount.id;
        addLog(`✅ ${file.name} → ${matchedAccount.name} (auto-détecté)`, 'success');
      } else {
        addLog(`⚠️ ${file.name} → Aucun compte correspondant`, 'warning');
      }
    });

    // 2) Parser tous les CSV
    const allTransactions = [];

    for (const file of selectedFiles) {
      const targetAccountId = fileMappings[file.name];

      if (!targetAccountId) {
        addLog(`❌ ${file.name} ignoré: aucun compte`, 'warning');
        continue;
      }

      await new Promise((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => {
            return header.trim().replace(/[\u200B-\u200D]/g, '');
          },
          complete: (results) => {
            addLog(`📄 ${file.name}: ${results.data.length} lignes`);

            if (results.data.length === 0) {
              resolve();
              return;
            }

            const firstRow = results.data[0];
            const allKeys = Object.keys(firstRow);

            const dateKey = allKeys.find(key => {
              const k = key.toUpperCase().replace(/-/g, '');
              return k.includes('TRANDATE') || k.includes('DATE');
            });

            const quantityKey = allKeys.find(key => {
              const k = key.toUpperCase().replace(/-/g, '');
              return k.includes('QUANTIT') || k.includes('AMOUNT');
            });

            const descriptionKey = allKeys.find(key => {
              const k = key.toUpperCase().replace(/-/g, '');
              return k.includes('PAYEE') || k.includes('DESC');
            });

            const categoryKey = allKeys.find(key => {
              const k = key.toUpperCase().replace(/-/g, '');
              return k.includes('CATEG') || k.includes('CATEGORY');
            });

            if (!dateKey || !quantityKey) {
              addLog(`❌ ${file.name}: colonnes essentielles manquantes`, 'error');
              resolve();
              return;
            }

            addLog(`   📊 Colonnes: DATE=${dateKey}, MONTANT=${quantityKey}, DESC=${descriptionKey || 'N/A'}`);

            const transactions = results.data
              .map((row) => {
                const rawAmount = row[quantityKey] || '0';
                const dateStr = row[dateKey];
                const description = row[descriptionKey] || 'Import CSV';
                const category = row[categoryKey] || 'Autre';

                const cleanAmountStr = rawAmount.toString()
                  .replace(/\s/g, '')
                  .replace(/,/g, '.');
                let amount = parseFloat(cleanAmountStr);

                if (isNaN(amount) || !dateStr) {
                  return null;
                }

                const type = amount < 0 ? 'expense' : 'income';
                amount = Math.abs(amount);

                // Normalisation date
                let cleanDate;
                if (dateStr.includes('-')) {
                  cleanDate = dateStr.split(' ')[0].substring(0, 10);
                } else if (dateStr.includes('/')) {
                  const parts = dateStr.split(' ')[0].split('/');
                  if (parts.length === 3) {
                    let [day, month, year] = parts;
                    if (year.length === 2) year = '20' + year;
                    cleanDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  } else {
                    return null;
                  }
                } else {
                  return null;
                }

                if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
                  return null;
                }

                // Filtre date de coupure
                //if (cleanDate <= CUTOFF_DATE) {
                //  return null;
               // }

                return {
                  accountId: targetAccountId,
                  description: description.trim(),
                  category: category.trim(),
                  amount,
                  type,
                  date: cleanDate,
                  remarks: row['REMARQUES'] || row['REMARQUE'] || ''
                };
              })
              .filter(Boolean);

            addLog(`   ✅ ${file.name}: ${transactions.length} transactions valides`);
            allTransactions.push(...transactions);
            resolve();
          },
          error: (err) => {
            addLog(`❌ ${file.name}: ${err.message}`, 'error');
            resolve();
          }
        });
      });
    }

    if (allTransactions.length === 0) {
      addLog('⚠️ Aucune transaction valide trouvée', 'warning');
      alert('Aucune transaction valide trouvée dans les fichiers (ou toutes avant la date de coupure)');
      setIsImporting(false);
      return;
    }

    // 3) Filtre ANTI-DOUBLONS LOCAL (dans le batch)
    const uniqueMap = new Map();
    for (const t of allTransactions) {
      const sig = createLocalSig(t);
      if (!uniqueMap.has(sig)) {
        uniqueMap.set(sig, t);
      }
    }
    const uniqueTransactions = Array.from(uniqueMap.values());

    addLog(`📊 Total extrait: ${allTransactions.length} transactions`);
    addLog(`🧹 Après dédoublonnage local: ${uniqueTransactions.length} transactions`);
    addLog('🔄 Vérification des doublons côté serveur en cours...');

    try {
      await onImport(uniqueTransactions); // le backend élimine aussi ce qui est déjà en base
      addLog('✅ Import terminé avec succès !', 'success');

      setTimeout(() => {
        setSelectedFiles([]);
        setLogs([]);
        onClose();
      }, 2000);
    } catch (error) {
      addLog(`❌ Erreur: ${error.message}`, 'error');
      setIsImporting(false);
    }
  };

  const sig = buildTransactionSignature({
  accountId: t.accountId,
  date: t.date,
  amount: t.amount,
  type: t.type,
  description: t.description,
  category: t.category || 'Autre',
});

// transactions bulk creation is handled via onImport(...) inside handleImport,
// so we must not perform await calls during render; keep rendering the component.
return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <h2 style={{ margin: 0 }}>Import CSV Incrémental</h2>
          <button
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* File Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            padding: '15px',
            background: '#f5f5f5',
            border: '2px dashed #ccc',
            borderRadius: '8px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'all 0.3s'
          }}
          onMouseEnter={(e) => e.target.style.background = '#e8f5e9'}
          onMouseLeave={(e) => e.target.style.background = '#f5f5f5'}
          >
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={isImporting}
            />
            <span style={{ fontSize: '16px', color: '#333' }}>
              {selectedFiles.length === 0 
                ? '📁 Cliquez pour sélectionner des fichiers CSV'
                : `📁 ${selectedFiles.length} fichier(s) sélectionné(s)`
              }
            </span>
          </label>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && !isImporting && (
          <div style={{
            marginBottom: '20px',
            padding: '15px',
            background: '#f9f9f9',
            borderRadius: '8px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Fichiers sélectionnés :</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {selectedFiles.map((file, index) => (
                <li key={index} style={{ padding: '5px 0', fontSize: '14px', color: '#555' }}>
                  {file.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Logs Area */}
        {logs.length > 0 && (
          <div style={{
            flex: 1,
            marginBottom: '20px',
            padding: '15px',
            background: '#f5f5f5',
            borderRadius: '8px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px',
            maxHeight: '300px'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{
                padding: '4px 0',
                color: log.type === 'error' ? '#d32f2f' :
                       log.type === 'warning' ? '#f57c00' :
                       log.type === 'success' ? '#388e3c' : '#333'
              }}>
                <span style={{ color: '#999', marginRight: '8px' }}>{log.time}</span>
                {log.msg}
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        {!isImporting && logs.length === 0 && (
          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>📋 Instructions</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Le nom du fichier doit correspondre au nom d'un compte</li>
              <li>Colonnes détectées automatiquement: DATE, MONTANT, DESCRIPTION, CATÉGORIE</li>
              <li><strong>Les doublons sont ignorés automatiquement</strong></li>
              <li>Seules les nouvelles transactions seront importées</li>
              <li>Les lignes antérieures ou égales au 2025‑12‑03 sont ignorées (évite les doublons avec le backup)</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              flex: 1,
              padding: '12px',
              background: (isImporting || selectedFiles.length === 0) ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (isImporting || selectedFiles.length === 0) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onClick={handleImport}
            disabled={selectedFiles.length === 0 || isImporting}
            onMouseEnter={(e) => {
              if (!isImporting && selectedFiles.length > 0) e.target.style.background = '#45a049';
            }}
            onMouseLeave={(e) => {
              if (!isImporting && selectedFiles.length > 0) e.target.style.background = '#4CAF50';
            }}
          >
            {isImporting ? '⏳ Import en cours...' : '🚀 Lancer l\'import'}
          </button>

          <button
            style={{
              padding: '12px 24px',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              transition: 'all 0.3s'
            }}
            onClick={onClose}
            disabled={isImporting}
            onMouseEnter={(e) => {
              if (!isImporting) e.target.style.background = '#e0e0e0';
            }}
            onMouseLeave={(e) => {
              if (!isImporting) e.target.style.background = '#f5f5f5';
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
