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

  // Total des avoirs ouverts
  const totalOpen = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.amount || 0), 0),
    [items]
  );

  // Calcul des soldes ACTUELS et PRÉVISIONNELS
  const coffreAccount = accounts.find(a => a.name === "Coffre");
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);
  const currentTotalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

  // PRÉVISIONS : soldes APRÈS règlement de TOUS les avoirs
  const coffreForecast = currentCoffreBalance + totalOpen;
  const totalForecast = currentTotalBalance + totalOpen;

  // Vérification si tous les avoirs sont "récoltés"
  const avoirsTousRecoltes = currentCoffreBalance >= totalOpen;

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
      console.error('Erreur création avoir:', e);
      alert('Erreur lors de la création de l\'avoir');
    }
  };

  const handleClose = async (id) => {
    if (!confirm('Marquer cet avoir comme payé ?')) return;
    
    try {
      await receivablesService.pay(id);
      setItems((prev) => prev.filter((i) => i.id !== id));

      if (onAfterChange) {
        await onAfterChange();
      }
    } catch (e) {
      console.error('Erreur paiement avoir:', e);
      alert('Erreur lors du marquage comme payé');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Avoirs</h2>
          <p className="text-sm text-gray-500">
            Avances d&apos;argent que tu fais depuis tes comptes vers d&apos;autres personnes,
            remboursées plus tard dans le Coffre.
          </p>
        </div>
        <div className="rounded-full bg-indigo-50 px-4 py-1 text-xs font-medium text-indigo-600 border border-indigo-100">
          Compte AVOIR · créances
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-indigo-100 bg-white/80 shadow-sm px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Total des avoirs ouverts
          </p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">
            {totalOpen.toLocaleString("fr-FR")} Ar
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white/70 px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase">
            Nombre de lignes
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-800">{items.length}</p>
        </div>
        <div className={`rounded-2xl border px-5 py-4 shadow-sm ${avoirsTousRecoltes ? 'border-emerald-200 bg-emerald-50/80' : 'border-indigo-100 bg-indigo-50/70'}`}>
          <p className={`text-xs font-medium uppercase ${avoirsTousRecoltes ? 'text-emerald-700' : 'text-indigo-600'}`}>
            {avoirsTousRecoltes ? "Prévisions après règlements" : "Flux de trésorerie"}
          </p>
          {avoirsTousRecoltes ? (
            <div className="mt-2 space-y-2">
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-gray-600">COFFRE (prévu)</span>
                <span className="text-lg font-bold text-emerald-700 tracking-tight">
                  {coffreForecast.toLocaleString("fr-FR")} Ar
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t border-emerald-200 pt-2">
                <span className="text-xs text-gray-600">TOTAL GÉNÉRAL (prévu)</span>
                <span className="text-xl font-black text-emerald-800">
                  {totalForecast.toLocaleString("fr-FR")} Ar
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-emerald-200">
                <p className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded inline-block">
                  +{totalOpen.toLocaleString("fr-FR")} Ar de remboursements attendus
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-indigo-700">
              Débourse depuis Argent Liquide ou Coffre, encaisse les remboursements dans Coffre.
            </p>
          )}
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

      {/* Liste des avoirs */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-gray-500">Chargement des avoirs...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">Aucun avoir ouvert.</p>
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
