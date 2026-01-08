// debugCoffrePrevisionnel.js

/**
 * Vérifie les flux de coffre (réel + prévisionnel) jour par jour.
 *
 * @param {Object} params
 * @param {number|string} params.balance           Solde initial coffre
 * @param {Array} params.transactions             Transactions réelles
 * @param {Array} params.plannedTransactions      Transactions prévisionnelles
 * @param {string|Date} params.startDate          Date début (YYYY-MM-DD ou Date)
 * @param {string|Date} params.endDate            Date fin (YYYY-MM-DD ou Date)
 * @returns {Array}                               Lignes journalières de debug
 */
function generateCashFlowDebug({
  balance,
  transactions,
  plannedTransactions,
  startDate,
  endDate,
}) {
  const days = [];
  let current =
    startDate instanceof Date ? new Date(startDate) : new Date(startDate);
  const end =
    endDate instanceof Date ? new Date(endDate) : new Date(endDate);

  let runningReal = Number(balance) || 0;
  let runningProjected = Number(balance) || 0;

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];

    // --- Flux RÉELS du jour (toutes transactions, pas que coffre) ---
    const realOfDay = transactions.filter(
      (tx) =>
        tx.date &&
        new Date(tx.date).toISOString().split('T')[0] === dateStr
    );

    const dayRealIn = realOfDay.reduce((acc, tx) => {
      const isIncome = String(tx.type).toLowerCase() === 'income';
      return acc + (isIncome ? Number(tx.amount) || 0 : 0);
    }, 0);

    const dayRealOut = realOfDay.reduce((acc, tx) => {
      const isIncome = String(tx.type).toLowerCase() === 'income';
      return acc + (!isIncome ? Number(tx.amount) || 0 : 0);
    }, 0);

    // --- Flux PRÉVISIONNELS du jour ---
    const plannedOfDay = plannedTransactions.filter(
      (tx) =>
        tx.date &&
        new Date(tx.date).toISOString().split('T')[0] === dateStr
    );

    const dayPlannedIn = plannedOfDay.reduce((acc, tx) => {
      const isIncome =
        String(tx.type).toLowerCase() === 'planned_income';
      return acc + (isIncome ? Number(tx.amount) || 0 : 0);
    }, 0);

    const dayPlannedOut = plannedOfDay.reduce((acc, tx) => {
      const isIncome =
        String(tx.type).toLowerCase() === 'planned_income';
      return acc + (!isIncome ? Number(tx.amount) || 0 : 0);
    }, 0);

    const netRealDay = dayRealIn - dayRealOut;
    const netPlannedDay = dayPlannedIn - dayPlannedOut;

    // --- Mise à jour des soldes ---
    runningReal += netRealDay;
    runningProjected += netRealDay + netPlannedDay;

    days.push({
      date: dateStr,
      dayRealIn,
      dayRealOut,
      netRealDay,
      dayPlannedIn,
      dayPlannedOut,
      netPlannedDay,
      realBalance: runningReal,
      projectedBalance: runningProjected,
    });

    current.setDate(current.getDate() + 1);
  }

  return days;
}

// Exemple d'utilisation en Node:
// (à adapter avec ton JSON réel de transactions)
if (require.main === module) {
  const balance = 65000000;
  const transactions = []; // charger depuis un JSON / console.log dans ton app
  const plannedTransactions = [];
  const startDate = '2025-12-01';
  const endDate = '2025-12-27';

  const debug = generateCashFlowDebug({
    balance,
    transactions,
    plannedTransactions,
    startDate,
    endDate,
  });

  console.table(debug);
}

module.exports = { generateCashFlowDebug };
