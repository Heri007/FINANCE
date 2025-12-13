// src/ProjectPlannerModal.jsx - VERSION FUSIONNÉE (Finance + Operator)

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, DollarSign, TrendingUp, TrendingDown,
  Save, FileText, CheckCircle, Zap, Copy, Flame, Anchor, Download
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { v4 as uuidv4 } from 'uuid';

// Services & Utils
import { projectsService } from './services/projectsService';
import { operatorService } from './services/operatorService';
import { transactionsService } from './services/transactionsService';
import { formatCurrency } from './utils/formatters';
import { CalculatorInput } from './components/common/CalculatorInput';
import { normalizeDate } from './utils/transactionUtils';

export function ProjectPlannerModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved = null,
  onProjectUpdated = null
}) {
  // --- ÉTATS DU FORMULAIRE ---
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('PRODUCTFLIP');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  
  // Financier (Lignes détaillées)
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  
  // États Operator
  const [relatedSOPs, setRelatedSOPs] = useState([]);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [showSOPSection, setShowSOPSection] = useState(true);
  const [showTaskSection, setShowTaskSection] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [loadingOperational, setLoadingOperational] = useState(false);

  // --- CHARGEMENT INITIAL ---
  useEffect(() => {
    if (project) {
      setProjectName(project.name || '');
      setDescription(project.description || '');
      setProjectType(project.type || 'PRODUCTFLIP');
      setStatus(project.status || 'active');
      setStartDate(project.startDate ? new Date(project.startDate) : new Date());
      setEndDate(project.endDate ? new Date(project.endDate) : null);
      
      const parseList = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        try { return JSON.parse(data); } catch { return []; }
      };

      // Restauration des lignes avec ID et Dates
      const loadedExpenses = parseList(project.expenses).map(e => ({
        ...e, 
        id: e.id || uuidv4(),
        date: e.date ? new Date(e.date) : new Date(),
        amount: parseFloat(e.amount) || 0
      }));
      
      const loadedRevenues = parseList(project.revenues).map(r => ({
        ...r,
        id: r.id || uuidv4(),
        date: r.date ? new Date(r.date) : new Date(),
        amount: parseFloat(r.amount) || 0
      }));

      setExpenses(loadedExpenses);
      setRevenues(loadedRevenues);

      // Chargement Operator
      loadOperationalData(project.id);
    } else {
      // Reset
      setProjectName('');
      setDescription('');
      setProjectType('PRODUCTFLIP');
      setStatus('active');
      setStartDate(new Date());
      setExpenses([]);
      setRevenues([]);
      setRelatedSOPs([]);
      setRelatedTasks([]);
    }
  }, [project, isOpen]);

  // ✅ CHARGEMENT ROBUSTE DES SOPs ET TÂCHES
  const loadOperationalData = async (projectId) => {
      setLoadingOperational(true);
      try {
        const [allSOPs, allTasks] = await Promise.all([
          operatorService.getSOPs(),
          operatorService.getTasks()
        ]);

        console.log("📥 Données brutes chargées :", allSOPs.length, "SOPs,", allTasks.length, "Tâches");

        // 1. Filtrer les Tâches
        // On convertit tout en String pour éviter les erreurs de type (24 vs "24")
        const linkedTasks = allTasks.filter(
          task => String(task.projectid || task.projectId) === String(projectId)
        );
        setRelatedTasks(linkedTasks);

        // 2. Filtrer les SOPs
        // ASTUCE : Si le projet contient "Natiora" ou "Élevage", on affiche TOUTES les SOPs d'élevage
        // Cela force l'affichage même si les liens sont cassés
        const isLivestockProject = 
            (project?.type === 'LIVESTOCK') || 
            (project?.name || '').toLowerCase().includes('élevage') ||
            (project?.name || '').toLowerCase().includes('natiora');

        let linkedSOPs = [];

        if (isLivestockProject) {
            // On prend tout ce qui ressemble à de l'élevage ou de l'infra
            linkedSOPs = allSOPs.filter(s => 
                s.category === 'Élevage' || 
                s.category === 'Infrastructure' || 
                s.category === 'Logistique' ||
                s.category === 'Vente'
            );
        } else {
            // Sinon filtre classique par tâche
            const sopsUsedInTasks = new Set(linkedTasks.map(t => t.sopid).filter(Boolean));
            linkedSOPs = allSOPs.filter(s => sopsUsedInTasks.has(s.id));
        }

        console.log(`🎯 Résultat pour projet ${projectId}: ${linkedTasks.length} tâches, ${linkedSOPs.length} SOPs`);
        
        setRelatedSOPs(linkedSOPs);

        // Forcer l'affichage des sections
        if (linkedSOPs.length > 0) setShowSOPSection(true);
        if (linkedTasks.length > 0) setShowTaskSection(true);

      } catch (error) {
        console.error('Erreur chargement données opérationnelles', error);
      } finally {
        setLoadingOperational(false);
      }
  };

  // Modifier aussi le useEffect pour appeler cette fonction correctement
  useEffect(() => {
    if (isOpen && project?.id) {
      loadOperationalData(project.id);
    }
  }, [isOpen, project]);

  // --- ACTIONS FINANCIÈRES (Payer / Encaisser) ---

  const handlePayerDepense = async (exp, index) => {
    try {
      if (!exp.account) return alert('Choisis un compte pour cette dépense');
      
      const accountObj = accounts.find(a => a.name === exp.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Payer ${formatCurrency(exp.amount)} depuis ${exp.account} ?`)) return;

      // 1. Créer la transaction réelle
      await transactionsService.createTransaction({
        type: 'expense',
        amount: parseFloat(exp.amount),
        category: exp.category || 'Projet',
        description: `${projectName} - ${exp.description}`,
        date: new Date().toISOString().split('T')[0],
        account_id: accountObj.id,
        project_id: project?.id || null,
        is_posted: true,   // ✅ IMPORTANT: Marquer comme payé
        is_planned: false  // ✅ Ce n'est plus une prévision
      });

      // 2. Mettre à jour la ligne dans le projet (isPaid = true)
      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: true };
      setExpenses(updated);

      // 3. Sauvegarder le projet silencieusement pour persister l'état "Payé"
      await saveProjectState(updated, revenues);

      if (onProjectUpdated) onProjectUpdated();
      alert('Dépense payée et enregistrée !');

    } catch (error) {
      console.error(error);
      alert('Erreur paiement: ' + error.message);
    }
  };

  const handleEncaisser = async (rev, index) => {
    try {
      if (!rev.account) return alert('Choisis un compte pour encaisser');
      
      const accountObj = accounts.find(a => a.name === rev.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Encaisser ${formatCurrency(rev.amount)} sur ${rev.account} ?`)) return;

      await transactionsService.createTransaction({
        type: 'income',
        amount: parseFloat(rev.amount),
        category: 'Projet - Revenu',
        description: `${projectName} - ${rev.description}`,
        date: new Date().toISOString().split('T')[0],
        account_id: accountObj.id,
        project_id: project?.id || null,
        is_posted: true,
        is_planned: false
      });

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: true };
      setRevenues(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();
      alert('Revenu encaissé !');

    } catch (error) {
      console.error(error);
      alert('Erreur encaissement: ' + error.message);
    }
  };

  // Fonction utilitaire pour sauvegarder l'état sans fermer le modal
  const saveProjectState = async (currentExpenses, currentRevenues) => {
    if (!project?.id) return; // Ne marche que si le projet existe déjà
    const payload = {
      expenses: JSON.stringify(currentExpenses),
      revenues: JSON.stringify(currentRevenues)
    };
    await projectsService.updateProject(project.id, payload);
  };

  // --- GESTION LIGNES ---
  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };
  const updateRevenue = (id, field, value) => {
    setRevenues(revenues.map(r => r.id === id ? { ...r, [field]: value } : r));
  };
  const removeExpense = (id) => setExpenses(expenses.filter(e => e.id !== id));
  const removeRevenue = (id) => setRevenues(revenues.filter(r => r.id !== id));
  
  const duplicateExpense = (idx) => {
    const item = expenses[idx];
    setExpenses([...expenses, { ...item, id: uuidv4(), isPaid: false }]);
  };

  // --- TEMPLATES ---
  const applyTemplate = (template) => {
    if (expenses.length > 0 && !window.confirm("Écraser les données actuelles ?")) return;
    setProjectName(template.name);
    setProjectType(template.type);
    setDescription(template.description);
    setExpenses(template.expenses);
    setRevenues(template.revenues);
  };

  const templates = {
    productFlip: {
      name: "Achat/Revente Rapide",
      type: "PRODUCTFLIP",
      description: "Achat de stock pour revente immédiate.",
      expenses: [{ id: uuidv4(), description: "Achat Stock", amount: 500000, category: "Achat", date: new Date(), account: "Coffre" }],
      revenues: [{ id: uuidv4(), description: "Vente Client", amount: 750000, category: "Vente", date: new Date(), account: "Coffre" }]
    },
    // ... ajoutez vos autres templates ici (PLG, Bois, etc.)
  };

  // --- CALCULS ---
  const totalRevenues = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;
  
  const totalAvailable = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);
  
  const remainingBudget = totalAvailable - totalExpenses;

  // --- SAUVEGARDE FINALE ---
  const handleSave = async () => {
    if (!projectName) return alert("Le nom est obligatoire");
    
    setLoading(true);
    try {
      const payload = {
        name: projectName,
        description,
        type: projectType,
        status,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        totalCost: totalExpenses,
        totalRevenues: totalRevenues,
        netProfit,
        roi,
        remainingBudget,
        totalAvailable,
        expenses: JSON.stringify(expenses),
        revenues: JSON.stringify(revenues)
      };

      if (project?.id) {
        await projectsService.updateProject(project.id, payload);
      } else {
        await projectsService.createProject(payload);
      }

      if (onProjectSaved) onProjectSaved();
      onClose();
    } catch (e) {
      alert("Erreur sauvegarde: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-pink-600 p-6 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {project ? `Édition : ${project.name}` : "Nouveau Projet"}
            </h2>
            <p className="text-purple-100 text-sm">Planification Financière & Opérationnelle</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => applyTemplate(templates.productFlip)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs transition">
              Template Flip
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* Info Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input 
                type="text" 
                value={projectName} 
                onChange={e => setProjectName(e.target.value)} 
                className="w-full border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 font-bold text-lg"
                placeholder="Nom du Projet"
              />
              <div className="grid grid-cols-2 gap-4">
                <select value={projectType} onChange={e => setProjectType(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5">
                  <option value="PRODUCTFLIP">Achat/Revente</option>
                  <option value="LIVESTOCK">Élevage</option>
                  <option value="FISHING">Pêche</option>
                  <option value="REALESTATE">Immobilier</option>
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5">
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={2}
                className="w-full border-gray-300 rounded-lg p-2.5 text-sm"
                placeholder="Description..."
              />
            </div>

            {/* KPI Live */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-600 font-bold uppercase">Coût Total</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="text-xs text-green-600 font-bold uppercase">Revenus</div>
                <div className="text-xl font-bold text-green-700">{formatCurrency(totalRevenues)}</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-600 font-bold uppercase">Marge Nette</div>
                <div className={`text-xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-bold uppercase">Solde après projet</div>
                <div className="text-xl font-bold text-slate-700">
                  {formatCurrency(totalAvailable + netProfit)}
                </div>
              </div>
            </div>
          </div>

          {/* Section Operator (SOPs/Tasks) */}
          {project && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <FileText size={16} /> Procédures ({relatedSOPs.length})
                </h3>
                <ul className="text-sm space-y-1">
                  {relatedSOPs.map(s => <li key={s.id} className="bg-white px-2 py-1 rounded border">• {s.title}</li>)}
                  {relatedSOPs.length === 0 && <li className="text-slate-400 italic">Aucune SOP liée</li>}
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <CheckCircle size={16} /> Tâches ({relatedTasks.length})
                </h3>
                <ul className="text-sm space-y-1">
                  {relatedTasks.map(t => <li key={t.id} className="bg-white px-2 py-1 rounded border">• {t.title}</li>)}
                  {relatedTasks.length === 0 && <li className="text-slate-400 italic">Aucune tâche liée</li>}
                </ul>
              </div>
            </div>
          )}

          {/* TABLEAU DES DÉPENSES (LE CŒUR DU SYSTÈME) */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-red-800 flex items-center gap-2">
                <TrendingDown size={20} /> Dépenses & Investissements
              </h3>
              <button 
                onClick={() => setExpenses([...expenses, { id: uuidv4(), description: '', amount: 0, date: new Date(), account: '', isPaid: false }])}
                className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm hover:bg-red-100 transition flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {expenses.map((exp, idx) => (
                <div key={exp.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${exp.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-red-100'}`}>
                  {/* Description */}
                  <div className="col-span-4">
                    <input 
                      type="text" 
                      value={exp.description} 
                      onChange={e => updateExpense(exp.id, 'description', e.target.value)}
                      placeholder="Description de la dépense"
                      className="w-full text-sm border-gray-300 rounded focus:ring-red-500"
                      disabled={exp.isPaid}
                    />
                  </div>
                  
                  {/* Montant */}
                  <div className="col-span-3">
                    <CalculatorInput 
                      value={exp.amount} 
                      onChange={val => updateExpense(exp.id, 'amount', val)}
                      className="w-full text-sm border-gray-300 rounded text-right font-mono"
                      placeholder="0 Ar"
                      disabled={exp.isPaid}
                    />
                  </div>

                  {/* Compte */}
                  <div className="col-span-3">
                    <select 
                      value={exp.account || ''} 
                      onChange={e => updateExpense(exp.id, 'account', e.target.value)}
                      className="w-full text-sm border-gray-300 rounded"
                      disabled={exp.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-1">
                    {exp.isPaid ? (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center">
                        <CheckCircle size={12} className="mr-1"/> Payé
                      </span>
                    ) : (
                      <button 
                        onClick={() => handlePayerDepense(exp, idx)}
                        disabled={!exp.account || !exp.amount}
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        Payer
                      </button>
                    )}
                    
                    {!exp.isPaid && (
                      <button onClick={() => removeExpense(exp.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TABLEAU DES REVENUS */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                <TrendingUp size={20} /> Revenus Prévisionnels
              </h3>
              <button 
                onClick={() => setRevenues([...revenues, { id: uuidv4(), description: '', amount: 0, date: new Date(), account: '', isPaid: false }])}
                className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm hover:bg-green-100 transition flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {revenues.map((rev, idx) => (
                <div key={rev.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${rev.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-green-100'}`}>
                  <div className="col-span-4">
                    <input 
                      type="text" 
                      value={rev.description} 
                      onChange={e => updateRevenue(rev.id, 'description', e.target.value)}
                      placeholder="Source du revenu"
                      className="w-full text-sm border-gray-300 rounded focus:ring-green-500"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <CalculatorInput 
                      value={rev.amount} 
                      onChange={val => updateRevenue(rev.id, 'amount', val)}
                      className="w-full text-sm border-gray-300 rounded text-right font-mono"
                      placeholder="0 Ar"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <select 
                      value={rev.account || ''} 
                      onChange={e => updateRevenue(rev.id, 'account', e.target.value)}
                      className="w-full text-sm border-gray-300 rounded"
                      disabled={rev.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    {rev.isPaid ? (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center">
                        <CheckCircle size={12} className="mr-1"/> Reçu
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleEncaisser(rev, idx)}
                        disabled={!rev.account || !rev.amount}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        Encaisser
                      </button>
                    )}
                    {!rev.isPaid && (
                      <button onClick={() => removeRevenue(rev.id)} className="text-gray-400 hover:text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-between items-center rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
            Annuler
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-purple-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-purple-700 shadow-lg hover:shadow-purple-200 transition flex items-center gap-2 disabled:opacity-70"
          >
            <Save size={18} />
            {loading ? 'Enregistrement...' : 'Enregistrer le Projet'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ProjectPlannerModal;