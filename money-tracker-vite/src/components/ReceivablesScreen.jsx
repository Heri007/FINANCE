// src/components/ReceivablesScreen.jsx
import React, { useEffect, useState, useMemo } from "react";
import { receivablesService } from "../services/receivablesService";

const ReceivablesScreen = ({ onAfterChange, onTotalsChange, accounts = [] }) => {
  const [items, setItems] = useState([]);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
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

  // Total des receivables ouverts
  const totalOpen = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [items]
  );

  // Calcul des soldes ACTUELS et PRÉVISIONNELS
  const coffreAccount = accounts.find(a => a.name === "Coffre");
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);
  const currentTotalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  // PRÉVISIONS : soldes APRÈS règlement de TOUS les receivables
  const coffreForecast = currentCoffreBalance + totalOpen;
  const totalForecast = currentTotalBalance + totalOpen;

  // Vérification si tous les receivables sont "récoltés"
  const receivablesTousRecoltes = currentCoffreBalance >= totalOpen;

  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange({ totalOpenReceivables: totalOpen });
    }
  }, [totalOpen, onTotalsChange]);

  // Comptes possibles pour le déboursement
  const sourceAccounts = accounts.filter((a) =>
    ["Argent Liquide", "Coffre"].includes(a.name)
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
      setPerson("");
      setAmount("");
      setDescription("");
      setSourceAccountId("");

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Receivables</h2>
          <p className="text-sm text-gray-500">
            Avances d&apos;argent que tu fais depuis tes comptes vers d&apos;autres personnes,
            remboursées plus tard dans le Coffre.
          </p>
        </div>
        <div className="rounded-full bg-indigo-50 px-4 py-1 text-xs font-medium text-indigo-600 border border-indigo-100">
          Compte RECEIVABLES · créances
        </div>
      </div>

      {/* Summary cards */}
<div className="grid gap-4 md:grid-cols-3">
  {/* Card 1 : Total receivables */}
  <div className="rounded-2xl border border-indigo-100 bg-white/80 shadow-sm px-5 py-4">
    <p className="text-xs font-medium text-gray-500 uppercase">
      Total des receivables ouverts
    </p>
    <p className="mt-1 text-2xl font-bold text-indigo-600">
      {totalOpen.toLocaleString("fr-FR")} Ar
    </p>
  </div>

  {/* Card 2 : Nombre de lignes */}
  <div className="rounded-2xl border border-gray-100 bg-white/70 px-5 py-4">
    <p className="text-xs font-medium text-gray-500 uppercase">
      Nombre de lignes
    </p>
    <p className="mt-1 text-2xl font-semibold text-gray-800">{items.length}</p>
  </div>

  {/* Card 3 : Prévisions TOUJOURS AFFICHÉES */}
  <div className={`rounded-2xl border px-5 py-4 shadow-sm ${receivablesTousRecoltes ? 'border-emerald-200 bg-emerald-50/80' : 'border-indigo-100 bg-indigo-50/70'}`}>
    <p className={`text-xs font-medium uppercase ${receivablesTousRecoltes ? 'text-emerald-700' : 'text-indigo-600'}`}>
      {receivablesTousRecoltes ? "✅ Prévisions (Tout récolté)" : "📊 Prévisions (En cours)"}
    </p>
    
    <div className="mt-2 space-y-2">
      {/* Ligne 1 : COFFRE prévu */}
      <div className="flex justify-between items-baseline pt-1">
        <span className="text-xs text-gray-600">COFFRE (prévu)</span>
        <span className={`text-lg font-bold tracking-tight ${receivablesTousRecoltes ? 'text-emerald-700' : 'text-indigo-700'}`}>
          {coffreForecast.toLocaleString("fr-FR")} Ar
        </span>
      </div>
      
      {/* Ligne 2 : TOTAL GÉNÉRAL prévu */}
      <div className="flex justify-between items-baseline border-t border-gray-200 pt-2">
        <span className="text-xs text-gray-600">TOTAL GÉNÉRAL (prévu)</span>
        <span className={`text-xl font-black ${receivablesTousRecoltes ? 'text-emerald-800' : 'text-indigo-800'}`}>
          {totalForecast.toLocaleString("fr-FR")} Ar
        </span>
      </div>
      
      {/* Ligne 3 : Détails */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <p className={`text-xs px-2 py-1 rounded inline-block ${receivablesTousRecoltes ? 'text-emerald-700 bg-emerald-100' : 'text-indigo-700 bg-indigo-100'}`}>
          +{totalOpen.toLocaleString("fr-FR")} Ar de remboursements attendus
        </p>
      </div>
      
      {/* Ligne 4 : Message explicatif */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-600 italic">
          {receivablesTousRecoltes 
            ? "✅ Le Coffre couvre tous les receivables" 
            : "⏳ Débourse depuis Argent Liquide ou Coffre, encaisse dans Coffre"}
        </p>
      </div>
    </div>
  </div>
</div>


      {/* Form */}
      <div className="rounded-2xl border border-gray-100 bg-white/90 px-4 py-3 shadow-sm">
        <form
          onSubmit={handleAdd}
          className="grid gap-3 md:grid-cols-[1.2fr,0.8fr,1.3fr,1.1fr,auto] items-center"
        >
          <input
            type="text"
            placeholder="Personne / source"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 text-sm shadow-inner px-3 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
          />
          <input
            type="number"
            placeholder="Montant"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            className="h-9 rounded-lg border border-gray-200 text-sm shadow-inner px-3 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
          />
          <input
            type="text"
            placeholder="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 text-sm shadow-inner px-3 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
          />
          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 text-sm px-3 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">Déboursé depuis...</option>
            {sourceAccounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({Number(acc.balance).toLocaleString("fr-FR")} Ar)
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="ml-2 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={!person || !amount || !sourceAccountId}
          >
            Ajouter
          </button>
        </form>
      </div>

      {/* Liste des receivables */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-gray-500">Chargement des receivables...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">Aucun receivable ouvert.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-gray-900">{item.person}</p>
                {item.description && (
                  <p className="text-sm text-gray-500">{item.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Créé le{" "}
                  {new Date(item.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <p className="text-lg font-semibold text-indigo-600">
                  {Number(item.amount).toLocaleString("fr-FR")} Ar
                </p>
                <button
                  onClick={() => handleClose(item.id)}
                  className="inline-flex h-8 items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Marquer comme payé
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
