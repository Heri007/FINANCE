// src/components/ReceivablesScreen.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { receivablesService } from '../services/receivablesService';
import { Users, TrendingUp, CheckCircle, Clock, Plus } from 'lucide-react';

const ReceivablesScreen = ({ onAfterChange, onTotalsChange, accounts = [] }) => {
  const [items, setItems] = useState([]);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const data = await receivablesService.getAll();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erreur chargement receivables:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceivables();
  }, []);

  const totalOpen = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [items]
  );

  const coffreAccount = accounts.find((a) => a.name === 'Coffre');
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);
  const currentTotalBalance = accounts.reduce(
    (sum, a) => sum + Number(a.balance || 0),
    0
  );

  const coffreForecast = currentCoffreBalance + totalOpen;
  const totalForecast = currentTotalBalance + totalOpen;

  const receivablesTousRecoltes = currentCoffreBalance >= totalOpen;

  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange({ totalOpenReceivables: totalOpen });
    }
  }, [totalOpen, onTotalsChange]);

  const sourceAccounts = accounts.filter((a) =>
    ['Argent Liquide', 'Coffre'].includes(a.name)
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!person || !amount || !sourceAccountId) return;

    try {
      const created = await receivablesService.create({
        person,
        amount: parseFloat(amount),
        description,
        source_account_id: Number(sourceAccountId),
      });

      setItems((prev) => [created, ...prev]);
      setPerson('');
      setAmount('');
      setDescription('');
      setSourceAccountId('');

      if (onAfterChange) {
        await onAfterChange();
      }
    } catch (e) {
      console.error('Erreur création receivable:', e);
      alert('Erreur lors de la création du receivable');
    }
  };

  const handleClose = async (id) => {
    if (!confirm('Marquer ce receivable comme payé ?')) return;

    try {
      await receivablesService.pay(id);
      setItems((prev) => prev.filter((i) => i.id !== id));

      if (onAfterChange) {
        await onAfterChange();
      }
    } catch (e) {
      console.error('Erreur paiement receivable:', e);
      alert('Erreur lors du marquage comme payé');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec dégradé premium */}
      <div className="bg-gradient-to-r from-[#807D9E] to-[#6f6c8d] rounded-2xl p-6 shadow-lg border-2 border-[#807D9E]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
              <Users className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Receivables</h2>
              <p className="text-sm text-white/80 mt-1 font-semibold">
                Avances d&apos;argent remboursées plus tard dans le Coffre
              </p>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              Compte Créances
            </p>
          </div>
        </div>
      </div>

      {/* Layout 3 colonnes avec hauteurs alignées */}
      <div className="grid gap-4 lg:grid-cols-[240px,1fr,380px]">
        {/* COLONNE 1 : Cards Total & Nombre superposées avec flex-1 */}
        <div className="flex flex-col gap-2">
          {/* Card 1 : Total receivables (flex-1 pour occuper la moitié) */}
          <div className="flex-1 bg-gradient-to-br from-[#807D9E] to-[#6f6c8d] rounded-lg shadow-md border-2 border-[#807D9E] p-3 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1 rounded">
                <TrendingUp className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-[15px] font-bold text-white uppercase tracking-wider leading-tight">
                Total Receivables
              </p>
            </div>
            <p className="text-xl font-black text-white leading-none">
              {totalOpen.toLocaleString('fr-FR')} Ar
            </p>
          </div>

          {/* Card 2 : Nombre de lignes (flex-1 pour occuper la moitié) */}
          <div className="flex-1 bg-gradient-to-br from-[#9A8D8A] to-[#8a7d7a] rounded-lg shadow-md border-2 border-[#9A8D8A] p-3 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1 rounded">
                <Users className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              </div>
              <p className="text-[15px] font-bold text-white uppercase tracking-wider leading-tight">
                Nombre de Lignes
              </p>
            </div>
            <p className="text-xl font-black text-white leading-none">{items.length}</p>
          </div>
        </div>

        {/* COLONNE 2 : Card "En Cours" */}
        <div
          className={`rounded-lg shadow-md border-2 p-3 flex flex-col ${
            receivablesTousRecoltes
              ? 'bg-gradient-to-br from-[#6D9C6D] to-[#5a8a5a] border-[#6D9C6D]'
              : 'bg-gradient-to-br from-[#b85b03] to-[#fcb169] border-[#C09858]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-white/20 p-1 rounded">
              {receivablesTousRecoltes ? (
                <CheckCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              ) : (
                <Clock className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
              )}
            </div>
            <p className="text-lg font-bold text-white uppercase tracking-wider">
              {receivablesTousRecoltes ? '✅ Tout Récolté' : '📊 En Cours'}
            </p>
          </div>

          {/* Contenu avec flex-1 pour remplir */}
          <div className="flex-1 flex flex-col justify-between space-y-2">
            {/* Coffre prévu */}
            <div className="flex justify-between items-baseline">
              <span className="text-lg text-white font-bold uppercase">Coffre</span>
              <span className="text-xs text-white font-bold justify-self-center uppercase">
                (+ Receivables)
              </span>
              <span className="text-lg font-black text-white leading-none">
                {coffreForecast.toLocaleString('fr-FR')} Ar
              </span>
            </div>

            {/* Total prévu */}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/20">
              <span className="text-lg text-white font-bold uppercase">TOTAL</span>
              <span className="text-xs text-white justify-self-center font-bold uppercase">
                (+ TOUS LES COMPTES)
              </span>
              <span className="text-lg font-black text-white leading-none">
                {totalForecast.toLocaleString('fr-FR')} Ar
              </span>
            </div>

            {/* Badge */}
            <div className="pt-2 border-t border-white/20">
              <span className="inline-block text-lg px-2 py-1 rounded bg-yellow-200 text-black font-bold">
                +{totalOpen.toLocaleString('fr-FR')} Ar attendus
              </span>
            </div>

            {/* Message */}
            <p className="text-xs text-white italic font-semibold leading-tight pt-1">
              {receivablesTousRecoltes
                ? 'Le Coffre couvre tous les receivables'
                : 'Débourse depuis Argent Liquide ou Coffre'}
            </p>
          </div>
        </div>

        {/* COLONNE 3 : Formulaire d'ajout */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md border-2 border-slate-200 p-3 flex flex-col">
          <form
            onSubmit={handleAdd}
            className="flex-1 flex flex-col justify-between space-y-2"
          >
            <input
              type="text"
              placeholder="Personne / source"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="h-9 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-[#807D9E] focus:ring-2 focus:ring-[#807D9E]/20 transition-all"
            />
            <input
              type="number"
              placeholder="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              className="h-9 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-[#807D9E] focus:ring-2 focus:ring-[#807D9E]/20 transition-all"
            />
            <input
              type="text"
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 rounded-lg border-2 border-slate-200 text-sm px-3 focus:border-[#807D9E] focus:ring-2 focus:ring-[#807D9E]/20 transition-all"
            />
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              className="h-9 rounded-lg border-2 border-slate-200 text-sm px-3 bg-white focus:border-[#807D9E] focus:ring-2 focus:ring-[#807D9E]/20 transition-all"
            >
              <option value="">Déboursé depuis...</option>
              {sourceAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({Number(acc.balance).toLocaleString('fr-FR')} Ar)
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 h-9 rounded-lg bg-gradient-to-r from-[#484342] to-[#625c5b] text-white font-bold text-sm hover:from-[#6f6c8d] hover:to-[#5e5b7c] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!person || !amount || !sourceAccountId}
            >
              <Plus size={16} strokeWidth={3} />
              Ajouter
            </button>
          </form>
        </div>
      </div>

      {/* Liste des receivables */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-slate-200">
            <p className="text-slate-600 font-semibold">Chargement des receivables...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
            <p className="text-slate-600 font-semibold">Aucun receivable ouvert.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-white/90 backdrop-blur-sm rounded-xl shadow-md border-2 border-slate-200 px-5 py-4 hover:border-[#807D9E] hover:shadow-lg transition-all group"
            >
              <div className="flex-1">
                <p className="font-bold text-slate-900 text-base">{item.person}</p>
                {item.description && (
                  <p className="text-sm text-slate-600 mt-1 font-semibold">
                    {item.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 font-semibold">
                  Créé le {new Date(item.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-bold text-[#202023]">
                  {Number(item.amount).toLocaleString('fr-FR')} Ar
                </p>
                <button
                  onClick={() => handleClose(item.id)}
                  className="flex items-center gap-2 h-10 px-4 rounded-lg bg-gradient-to-r from-[#b85b03] to-[#f4c953] text-white font-bold text-sm hover:from-[#5a8a5a] hover:to-[#4a7a4a] transition-all shadow-md"
                >
                  <CheckCircle size={16} strokeWidth={2.5} />
                  Marquer payé
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReceivablesScreen;
