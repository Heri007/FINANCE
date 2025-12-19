// src/components/projects/modals/CarriereModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, FileText, Calculator, Truck, TrendingDown, TrendingUp } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';

// Taux selon le Code Minier 2023 (Loi n°2023-007)
const TAUX_RISTOURNE = 0.02; // 2%
const TAUX_REDEVANCE = 0.03; // 3%
const TAUX_TOTAL_DTSPM = TAUX_RISTOURNE + TAUX_REDEVANCE; // 5%

export function CarriereModal({ 
  isOpen, 
  onClose, 
  accounts = [], 
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction 
}) {
  
  // ===== ÉTATS DE BASE =====
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // ===== ÉTATS SPÉCIFIQUES CARRIÈRE =====
  const [lieu, setLieu] = useState('');
  const [substances, setSubstances] = useState('');
  const [perimetre, setPerimetre] = useState('');
  const [numeroPermis, setNumeroPermis] = useState('');
  const [typePermis, setTypePermis] = useState('PRE'); // PRE, PE, etc.

  // ===== GESTION DES LP1 =====
  const [lp1List, setLp1List] = useState([]);
  const [showLP1Form, setShowLP1Form] = useState(false);
  
  // Formulaire LP1
  const [newLP1, setNewLP1] = useState({
    numeroLP1: '',
    substance: '',
    quantiteKg: 0,
    prixUnitaireUSD: 0,
    dateEmission: new Date(),
    numeroOV: '',
    statut: 'En attente' // En attente, Payé, Exporté
  });

  // ===== CHARGES & VENTES =====
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== LISTE DES SUBSTANCES COMMUNES =====
  const substancesList = [
    'Agate', 'Quartz', 'Améthyste', 'Citrine', 'Labradorite',
    'Tourmaline', 'Béryl', 'Graphite', 'Mica', 'Feldspath',
    'Calcaire', 'Sable', 'Gravier', 'Argile', 'Autre'
  ];

  // ===== CHARGEMENT PROJET EXISTANT =====
  useEffect(() => {
    if (project) {
      setProjectName(project.name || '');
      setDescription(project.description || '');
      setStatus(project.status || 'active');
      
      const start = project.startDate || project.start_date;
      const end = project.endDate || project.end_date;
      setStartDate(start ? new Date(start) : new Date());
      setEndDate(end ? new Date(end) : null);

      // Champs spécifiques carrière (stockés dans metadata JSON)
      if (project.metadata) {
        const meta = typeof project.metadata === 'string' 
          ? JSON.parse(project.metadata) 
          : project.metadata;
        
        setLieu(meta.lieu || '');
        setSubstances(meta.substances || '');
        setPerimetre(meta.perimetre || '');
        setNumeroPermis(meta.numeroPermis || '');
        setTypePermis(meta.typePermis || 'PRE');
        setLp1List(meta.lp1List || []);
      }

      // Charger expenses et revenues
      const parseList = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        try { return JSON.parse(data); } catch { return []; }
      };

      setExpenses(parseList(project.expenses).map(e => ({
        ...e,
        id: e.id || uuidv4(),
        date: e.date ? new Date(e.date) : new Date(),
        amount: parseFloat(e.amount) || 0
      })));

      setRevenues(parseList(project.revenues).map(r => ({
        ...r,
        id: r.id || uuidv4(),
        date: r.date ? new Date(r.date) : new Date(),
        amount: parseFloat(r.amount) || 0
      })));
    } else {
      resetForm();
    }
  }, [project, isOpen]);

  const resetForm = () => {
    setProjectName('');
    setDescription('');
    setStatus('active');
    setStartDate(new Date());
    setEndDate(null);
    setLieu('');
    setSubstances('');
    setPerimetre('');
    setNumeroPermis('');
    setTypePermis('PRE');
    setLp1List([]);
    setExpenses([]);
    setRevenues([]);
  };

  // ===== CALCULS AUTOMATIQUES LP1 =====
  const calculateLP1Values = (lp1) => {
    const valeurTotale = lp1.quantiteKg * lp1.prixUnitaireUSD;
    const ristourne = valeurTotale * TAUX_RISTOURNE;
    const redevance = valeurTotale * TAUX_REDEVANCE;
    const totalDTSPM = valeurTotale * TAUX_TOTAL_DTSPM;

    return {
      valeurTotale,
      ristourne,
      redevance,
      totalDTSPM
    };
  };

  // ===== AJOUTER UN LP1 =====
  const handleAddLP1 = () => {
    if (!newLP1.numeroLP1 || !newLP1.substance || newLP1.quantiteKg <= 0) {
      alert('Veuillez remplir tous les champs obligatoires du LP1');
      return;
    }

    const lp1WithCalcs = {
      ...newLP1,
      id: uuidv4(),
      ...calculateLP1Values(newLP1)
    };

    setLp1List([...lp1List, lp1WithCalcs]);

    // Ajouter automatiquement la charge de redevance/ristourne
    addRedevanceRistourneExpense(lp1WithCalcs);

    // Ajouter automatiquement la ligne de revenu (cession LP1)
    addLP1Revenue(lp1WithCalcs);

    // Reset formulaire
    setNewLP1({
      numeroLP1: '',
      substance: '',
      quantiteKg: 0,
      prixUnitaireUSD: 0,
      dateEmission: new Date(),
      numeroOV: '',
      statut: 'En attente'
    });
    setShowLP1Form(false);
  };

  // ===== AJOUTER CHARGE REDEVANCE/RISTOURNE =====
  const addRedevanceRistourneExpense = (lp1) => {
    const newExpense = {
      id: uuidv4(),
      description: `Redevance + Ristourne LP1 ${lp1.numeroLP1} (${lp1.substance})`,
      amount: lp1.totalDTSPM,
      category: 'Redevances Minières',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false,
      lp1Id: lp1.id, // Lien avec le LP1
      metadata: {
        ristourne: lp1.ristourne,
        redevance: lp1.redevance,
        valeurBase: lp1.valeurTotale
      }
    };

    setExpenses(prev => [...prev, newExpense]);
  };

  // ===== AJOUTER REVENU CESSION LP1 =====
  const addLP1Revenue = (lp1) => {
    const newRevenue = {
      id: uuidv4(),
      description: `Cession LP1 ${lp1.numeroLP1} - ${lp1.substance} (${lp1.quantiteKg}kg)`,
      amount: lp1.valeurTotale,
      category: 'Cession LP1',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false,
      lp1Id: lp1.id,
      metadata: {
        numeroLP1: lp1.numeroLP1,
        numeroOV: lp1.numeroOV,
        quantite: lp1.quantiteKg,
        prixUnitaire: lp1.prixUnitaireUSD
      }
    };

    setRevenues(prev => [...prev, newRevenue]);
  };

  // ===== SUPPRIMER LP1 =====
  const handleDeleteLP1 = (lp1Id) => {
    if (!confirm('Supprimer ce LP1 et ses charges/revenus associés ?')) return;

    // Supprimer le LP1
    setLp1List(prev => prev.filter(lp => lp.id !== lp1Id));

    // Supprimer les charges liées
    setExpenses(prev => prev.filter(e => e.lp1Id !== lp1Id));

    // Supprimer les revenus liés
    setRevenues(prev => prev.filter(r => r.lp1Id !== lp1Id));
  };

  // ===== AJOUTER CHARGE MANUELLE =====
  const addExpense = () => {
    setExpenses([...expenses, {
      id: uuidv4(),
      description: '',
      amount: 0,
      category: 'Exploitation',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false
    }]);
  };

  // ===== AJOUTER VENTE MANUELLE =====
  const addRevenue = () => {
    setRevenues([...revenues, {
      id: uuidv4(),
      description: '',
      amount: 0,
      category: 'Vente Substance',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false
    }]);
  };

  // ===== CATÉGORIES =====
  const expenseCategories = [
    { value: 'Exploitation', label: '⛏️ Exploitation' },
    { value: 'Équipements', label: '🔧 Équipements' },
    { value: 'Transport', label: '🚚 Transport' },
    { value: 'Main d\'œuvre', label: '👷 Main d\'œuvre' },
    { value: 'Redevances Minières', label: '📜 Redevances' },
    { value: 'Permis & Admin', label: '📋 Permis & Admin' },
    { value: 'Autre', label: '📦 Autre' }
  ];

  const revenueCategories = [
    { value: 'Cession LP1', label: '📄 Cession LP1' },
    { value: 'Vente Substance', label: '💎 Vente Substance' },
    { value: 'Autre', label: '💰 Autre' }
  ];

  // ===== CALCULS FINANCIERS =====
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalRevenues = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

  // ===== SAUVEGARDE =====
  const handleSave = async () => {
    if (!projectName.trim()) {
      alert('Le nom du projet est obligatoire');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: projectName.trim(),
        description: description.trim(),
        type: 'CARRIERE',
        status,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        totalCost: totalExpenses,
        totalRevenues,
        netProfit,
        roi: parseFloat(roi),
        expenses: JSON.stringify(expenses),
        revenues: JSON.stringify(revenues),
        metadata: JSON.stringify({
          lieu,
          substances,
          perimetre,
          numeroPermis,
          typePermis,
          lp1List
        })
      };

      if (project?.id) {
        await projectsService.updateProject(project.id, payload);
      } else {
        await projectsService.createProject(payload);
      }

      if (onProjectSaved) onProjectSaved();
      onClose();
    } catch (error) {
      alert('Erreur lors de la sauvegarde : ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                {project ? 'Modifier' : 'Nouveau'} Projet Carrière
              </h2>
              <p className="text-amber-100 text-sm">
                Gestion des LP1, Redevances & Ristournes automatiques
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: INFORMATIONS GÉNÉRALES */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Informations Générales
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom du Projet *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Carrière Agate Ibity 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="active">🟢 Actif</option>
                  <option value="completed">✅ Terminé</option>
                  <option value="paused">⏸️ En pause</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Description du projet..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Début</label>
                <DatePicker
                  selected={startDate}
                  onChange={setStartDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Fin (Optionnelle)</label>
                <DatePicker
                  selected={endDate}
                  onChange={setEndDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded"
                  isClearable
                  placeholderText="Non définie"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: DONNÉES CARRIÈRE */}
          <div className="bg-amber-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              ⛏️ Données Spécifiques Carrière
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lieu / Zone</label>
                <input
                  type="text"
                  value={lieu}
                  onChange={(e) => setLieu(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Ibity, Antsirabe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Substances Exploitées</label>
                <input
                  type="text"
                  value={substances}
                  onChange={(e) => setSubstances(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Agate, Quartz rose"
                  list="substances-list"
                />
                <datalist id="substances-list">
                  {substancesList.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Périmètre</label>
                <input
                  type="text"
                  value={perimetre}
                  onChange={(e) => setPerimetre(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: 500 ha, Carré 1234"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Type Permis</label>
                  <select
                    value={typePermis}
                    onChange={(e) => setTypePermis(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="PRE">PRE</option>
                    <option value="PE">PE</option>
                    <option value="PER">PER</option>
                    <option value="PR">PR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° Permis</label>
                  <input
                    type="text"
                    value={numeroPermis}
                    onChange={(e) => setNumeroPermis(e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="N° Permis"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: GESTION DES LP1 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                📄 Laissez-Passer (LP1)
              </h3>
              <button
                onClick={() => setShowLP1Form(!showLP1Form)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter LP1
              </button>
            </div>

            {/* Formulaire LP1 */}
            {showLP1Form && (
              <div className="bg-white p-4 rounded-lg mb-4 border-2 border-blue-200">
                <h4 className="font-semibold mb-3">Nouveau LP1</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">N° LP1 *</label>
                    <input
                      type="text"
                      value={newLP1.numeroLP1}
                      onChange={(e) => setNewLP1({...newLP1, numeroLP1: e.target.value})}
                      className="w-full p-2 border rounded"
                      placeholder="LP1-2025-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Substance *</label>
                    <input
                      type="text"
                      value={newLP1.substance}
                      onChange={(e) => setNewLP1({...newLP1, substance: e.target.value})}
                      className="w-full p-2 border rounded"
                      placeholder="Agate"
                      list="substances-list"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Quantité (kg) *</label>
                    <CalculatorInput
                      value={newLP1.quantiteKg}
                      onChange={(val) => setNewLP1({...newLP1, quantiteKg: val})}
                      placeholder="27000"
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Prix Unitaire (USD/kg) *</label>
                    <CalculatorInput
                      value={newLP1.prixUnitaireUSD}
                      onChange={(val) => setNewLP1({...newLP1, prixUnitaireUSD: val})}
                      placeholder="1.5"
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Date Émission</label>
                    <DatePicker
                      selected={newLP1.dateEmission}
                      onChange={(date) => setNewLP1({...newLP1, dateEmission: date})}
                      dateFormat="dd/MM/yyyy"
                      className="w-full p-2 border rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">N° OV</label>
                    <input
                      type="text"
                      value={newLP1.numeroOV}
                      onChange={(e) => setNewLP1({...newLP1, numeroOV: e.target.value})}
                      className="w-full p-2 border rounded"
                      placeholder="OV-2025-001"
                    />
                  </div>
                </div>

                {/* Aperçu calculs */}
                {newLP1.quantiteKg > 0 && newLP1.prixUnitaireUSD > 0 && (
                  <div className="mt-3 p-3 bg-blue-100 rounded text-sm">
                    <p className="font-semibold mb-1">Calculs automatiques :</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-gray-600">Valeur totale:</span>
                        <p className="font-bold">{formatCurrency(newLP1.quantiteKg * newLP1.prixUnitaireUSD)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Ristourne (2%):</span>
                        <p className="font-bold text-orange-600">{formatCurrency(newLP1.quantiteKg * newLP1.prixUnitaireUSD * TAUX_RISTOURNE)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Redevance (3%):</span>
                        <p className="font-bold text-red-600">{formatCurrency(newLP1.quantiteKg * newLP1.prixUnitaireUSD * TAUX_REDEVANCE)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total DTSPM (5%):</span>
                        <p className="font-bold text-red-800">{formatCurrency(newLP1.quantiteKg * newLP1.prixUnitaireUSD * TAUX_TOTAL_DTSPM)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddLP1}
                    className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer LP1
                  </button>
                  <button
                    onClick={() => setShowLP1Form(false)}
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste des LP1 */}
            <div className="space-y-2">
              {lp1List.map((lp1) => (
                <div key={lp1.id} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                  <div className="flex-1 grid grid-cols-6 gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-blue-600">{lp1.numeroLP1}</span>
                      <p className="text-xs text-gray-500">{lp1.substance}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Qté:</span>
                      <p className="font-semibold">{lp1.quantiteKg} kg</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PU:</span>
                      <p className="font-semibold">${lp1.prixUnitaireUSD}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valeur:</span>
                      <p className="font-bold text-green-600">{formatCurrency(lp1.valeurTotale)}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">DTSPM:</span>
                      <p className="font-bold text-red-600">{formatCurrency(lp1.totalDTSPM)}</p>
                    </div>
                    <div>
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                        {lp1.statut}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLP1(lp1.id)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              {lp1List.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Aucun LP1 enregistré. Cliquez sur "Ajouter LP1" pour commencer.
                </p>
              )}
            </div>
          </div>

          {/* SECTION 4: CHARGES */}
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Charges
              </h3>
              <button
                onClick={addExpense}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter Charge
              </button>
            </div>

            <div className="space-y-2">
              {expenses.map((exp, idx) => (
                <div key={exp.id} className="bg-white p-3 rounded-lg border grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={exp.description}
                    onChange={(e) => {
                      const updated = [...expenses];
                      updated[idx].description = e.target.value;
                      setExpenses(updated);
                    }}
                    className="col-span-4 p-2 border rounded text-sm"
                    placeholder="Description"
                    disabled={exp.lp1Id} // Ligne auto = non éditable
                  />
                  
                  <select
                    value={exp.category}
                    onChange={(e) => {
                      const updated = [...expenses];
                      updated[idx].category = e.target.value;
                      setExpenses(updated);
                    }}
                    className="col-span-2 p-2 border rounded text-sm"
                    disabled={exp.lp1Id}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>

                  <CalculatorInput
                    value={exp.amount}
                    onChange={(val) => {
                      const updated = [...expenses];
                      updated[idx].amount = val;
                      setExpenses(updated);
                    }}
                    className="col-span-2 p-2 border rounded text-sm"
                    disabled={exp.lp1Id}
                  />

                  <DatePicker
                    selected={exp.date}
                    onChange={(date) => {
                      const updated = [...expenses];
                      updated[idx].date = date;
                      setExpenses(updated);
                    }}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm"
                  />

                  <select
                    value={exp.account}
                    onChange={(e) => {
                      const updated = [...expenses];
                      updated[idx].account = e.target.value;
                      setExpenses(updated);
                    }}
                    className="col-span-1 p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => setExpenses(expenses.filter(e => e.id !== exp.id))}
                    className="col-span-1 text-red-600 hover:bg-red-50 p-2 rounded"
                    disabled={exp.lp1Id && lp1List.some(lp => lp.id === exp.lp1Id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Charges: </span>
              <span className="font-bold text-red-600 text-lg">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>

          {/* SECTION 5: VENTES/REVENUS */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Ventes & Revenus
              </h3>
              <button
                onClick={addRevenue}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter Vente
              </button>
            </div>

            <div className="space-y-2">
              {revenues.map((rev, idx) => (
                <div key={rev.id} className="bg-white p-3 rounded-lg border grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={rev.description}
                    onChange={(e) => {
                      const updated = [...revenues];
                      updated[idx].description = e.target.value;
                      setRevenues(updated);
                    }}
                    className="col-span-4 p-2 border rounded text-sm"
                    placeholder="Description"
                    disabled={rev.lp1Id}
                  />
                  
                  <select
                    value={rev.category}
                    onChange={(e) => {
                      const updated = [...revenues];
                      updated[idx].category = e.target.value;
                      setRevenues(updated);
                    }}
                    className="col-span-2 p-2 border rounded text-sm"
                    disabled={rev.lp1Id}
                  >
                    {revenueCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>

                  <CalculatorInput
                    value={rev.amount}
                    onChange={(val) => {
                      const updated = [...revenues];
                      updated[idx].amount = val;
                      setRevenues(updated);
                    }}
                    className="col-span-2 p-2 border rounded text-sm"
                    disabled={rev.lp1Id}
                  />

                  <DatePicker
                    selected={rev.date}
                    onChange={(date) => {
                      const updated = [...revenues];
                      updated[idx].date = date;
                      setRevenues(updated);
                    }}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm"
                  />

                  <select
                    value={rev.account}
                    onChange={(e) => {
                      const updated = [...revenues];
                      updated[idx].account = e.target.value;
                      setRevenues(updated);
                    }}
                    className="col-span-1 p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => setRevenues(revenues.filter(r => r.id !== rev.id))}
                    className="col-span-1 text-red-600 hover:bg-red-50 p-2 rounded"
                    disabled={rev.lp1Id && lp1List.some(lp => lp.id === rev.lp1Id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Revenus: </span>
              <span className="font-bold text-green-600 text-lg">{formatCurrency(totalRevenues)}</span>
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-3">📊 Résumé Financier</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-blue-100 text-sm">Total Charges</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Revenus</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenues)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Bénéfice Net</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">ROI</p>
                <p className={`text-2xl font-bold ${roi >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {roi}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-gray-100 p-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            Annuler
          </button>
          
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Enregistrement...' : 'Enregistrer le Projet'}
          </button>
        </div>
      </div>
    </div>
  );
}
