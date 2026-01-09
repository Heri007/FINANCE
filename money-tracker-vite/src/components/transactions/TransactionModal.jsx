import React, { useState, useEffect, useRef } from 'react';
import { X, Calculator } from 'lucide-react';

export function TransactionModal({ onClose, onSave, accounts, projects = [] }) {
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    accountid: accounts?.[0]?.id?.toString() || '', // ✅ Uniformisé: accountid
    projectId: null,
    is_posted: true,
  });


  const [showCalculator, setShowCalculator] = useState(false);
  const calculatorRef = useRef(null);

  const expenseCategories = [
    'Transport', 'Quotidienne', 'Afterwork', 'VINA', 'Hébergement',
    'Accessoires', 'Crédits Phone', 'Habillements', 'Soins personnels',
    'HOME MJG', 'Aide', 'Frais', 'Goûters', 'Automobile', 'Dons',
    'DOIT', 'Alimentation', 'Logement', 'Loisirs', 'Santé',
    'Éducation', 'Stan/Ethan', 'Moto', 'Autres',
  ];
  
  const incomeCategories = [
    'Recettes', 'Extra Solde', 'Transfer (Inward)', '@TAHIANA',
    'Transfert', 'Salaire', 'Vente', 'Investissement', 'Autres',
  ];
  
  const categories = formData.type === 'expense' ? expenseCategories : incomeCategories;

  const safeCalculate = (expression) => {
    try {
      if (!expression) return '';
      const cleanExpr = expression
        .toString()
        .replace(/,/g, '.')
        .replace(/x/g, '*')
        .replace(/[^-()\d/*+.]/g, '');
      if (!cleanExpr) return '';

      const result = new Function('return ' + cleanExpr)();
      if (!isFinite(result) || isNaN(result)) return expression;
      return parseFloat(result.toFixed(2)).toString();
    } catch (e) {
      return expression;
    }
  };

  const handleAmountBlur = () => {
    const calculated = safeCalculate(formData.amount);
    setFormData((prev) => ({ ...prev, amount: calculated }));
  };

  const handleAmountKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAmountBlur();
      setShowCalculator(false);
    }
  };

  const appendToCalc = (val) => {
    setFormData((prev) => ({ ...prev, amount: prev.amount + val }));
  };

  const clearCalc = () => {
    setFormData((prev) => ({ ...prev, amount: '' }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calculatorRef.current && !calculatorRef.current.contains(event.target)) {
        setShowCalculator(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

 const handleSubmit = async (e) => {
  e.preventDefault();

  const finalAmount = parseFloat(formData.amount);

  // ✅ VALIDATION
  if (isNaN(finalAmount) || finalAmount <= 0) {
    alert('❌ Montant invalide');
    return;
  }
  
  if (!formData.category) {
    alert('❌ Veuillez sélectionner une catégorie');
    return;
  }
  
  if (!formData.accountid) {
    alert('❌ Veuillez sélectionner un compte');
    return;
  }
  
  if (!formData.description?.trim()) {
    alert('❌ Veuillez ajouter une description');
    return;
  }

  // ✅ PAYLOAD CORRIGÉ pour PostgreSQL (format snake_case AVEC underscores)
  const payload = {
    account_id: parseInt(formData.accountid),           // ✅ CORRIGÉ
    type: formData.type,
    amount: finalAmount,
    category: formData.category,
    description: formData.description,
    transaction_date: formData.date,                    // ✅ CORRIGÉ (nom de clé)
    is_posted: formData.is_posted || true,              // ✅ CORRIGÉ
    is_planned: false,                                  // ✅ CORRIGÉ
    project_id: formData.projectId ? parseInt(formData.projectId) : null,  // ✅ CORRIGÉ
  };

  console.log('📤 Payload TransactionModal:', payload);

  try {
    await onSave(payload);
    onClose();
  } catch (error) {
    console.error('❌ Erreur lors de la création:', error);
    alert('Erreur: ' + (error.message || 'Erreur inconnue'));
  }
};


  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all relative overflow-visible">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Nouvelle Transaction</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense', category: '' })}
                className={`py-3 rounded-xl font-semibold transition-all ${
                  formData.type === 'expense'
                    ? 'bg-rose-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Dépense
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income', category: '' })}
                className={`py-3 rounded-xl font-semibold transition-all ${
                  formData.type === 'income'
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Revenu
              </button>
            </div>
          </div>

          {/* Montant avec Calculatrice */}
          <div className="relative" ref={calculatorRef}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Montant (Ar)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^[0-9+\-*/.,\s]*$/.test(val)) {
                    setFormData({ ...formData, amount: val });
                  }
                }}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all font-mono text-lg"
                placeholder="Ex: 3000 + 3000"
                required
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowCalculator(!showCalculator)}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl border-2 border-gray-200 text-gray-600 transition-colors"
              >
                <Calculator className="w-6 h-6" />
              </button>
            </div>

            {showCalculator && (
              <div className="absolute top-full right-0 mt-2 z-50 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-3 w-64">
                <div className="grid grid-cols-4 gap-2">
                  {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','C','+'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => (btn === 'C' ? clearCalc() : appendToCalc(btn))}
                      className={`p-3 rounded-lg font-bold text-lg ${
                        btn === 'C' ? 'bg-rose-100 text-rose-600' :
                        ['/', '*', '-', '+'].includes(btn) ? 'bg-indigo-50 text-indigo-600' :
                        'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      handleAmountBlur();
                      setShowCalculator(false);
                    }}
                    className="col-span-4 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 mt-1"
                  >
                    = VALIDER
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Catégorie
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200"
              required
            >
              <option value="">Sélectionner...</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Projet */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Projet <span className="text-gray-400 text-xs">(optionnel)</span>
            </label>
            <select
              value={formData.projectId || ''}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value || null })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200"
            >
              <option value="">Aucun projet</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200"
              placeholder="Ex: Courses du mardi"
              required
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200"
              required
            />
          </div>

          {/* ✅ Compte - CORRECTION CRITIQUE */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Compte
            </label>
            <select
              value={formData.accountid} 
              onChange={(e) => {
                console.log('🔄 Compte sélectionné:', e.target.value);
                setFormData({ ...formData, accountid: e.target.value }); {/* ✅ CORRIGÉ */}
              }}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200"
              required
            >
              <option value="">-- Sélectionner un compte --</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            Enregistrer
          </button>
        </form>
      </div>
    </div>
  );
}
