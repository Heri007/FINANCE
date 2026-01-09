// controllers/accountController.js
// -----------------------------------------------------------------------------
// Contrôleur des comptes Money Tracker.
// - CRUD des comptes (liste, création, mise à jour, suppression)
// - Recalcul du solde d'un compte à partir des transactions
// - Recalcul de tous les soldes pour remettre la base en cohérence
// -----------------------------------------------------------------------------

const pool = require('../config/database');
const { getAccountIds } = require('../config/accounts');

// -----------------------------------------------------------------------------
// GET /api/accounts
// -----------------------------------------------------------------------------
// Retourne la liste de tous les comptes, triés par id croissant.
// Utilisé par le frontend pour afficher le tableau/résumé des comptes.
// -----------------------------------------------------------------------------
exports.getAllAccounts = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM accounts ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des comptes' });
  }
};

// -----------------------------------------------------------------------------
// POST /api/accounts
// -----------------------------------------------------------------------------
// Crée un nouveau compte.
// Body attendu : { name, balance?, type }
// - balance est optionnel, par défaut 0.
// -----------------------------------------------------------------------------
exports.createAccount = async (req, res) => {
  try {
    const { name, balance, type } = req.body;

    const result = await pool.query(
      'INSERT INTO accounts (name, balance, type) VALUES ($1, $2, $3) RETURNING *',
      [name, balance || 0, type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
};

// -----------------------------------------------------------------------------
// PUT /api/accounts/:id
// -----------------------------------------------------------------------------
// Met à jour un compte existant (nom, solde, type).
// Met aussi à jour updated_at pour garder une trace de la dernière modif.
// -----------------------------------------------------------------------------
exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, balance, type } = req.body;

    const result = await pool.query(
      'UPDATE accounts SET name = $1, balance = $2, type = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [name, balance, type, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du compte' });
  }
};

// -----------------------------------------------------------------------------
// DELETE /api/accounts/:id
// -----------------------------------------------------------------------------
// Supprime un compte.
// ⚠️ Les transactions associées sont supprimées en cascade (FK ON DELETE CASCADE).
// -----------------------------------------------------------------------------
exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM accounts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compte non trouvé' });
    }

    res.json({ success: true, message: 'Compte supprimé' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la suppression du compte' });
  }
};

// -----------------------------------------------------------------------------
// POST /api/accounts/:id/recalculate
// -----------------------------------------------------------------------------
// Recalcule le solde d'un compte donné à partir de ses transactions.
// Règle métier :
// - On ne prend en compte que les transactions "postées"
//   (is_posted = true) OU les transactions non planifiées (is_planned = false).
// - income  => +amount
// - expense => -amount
// Utile pour réparer les soldes après import ou bug de calcul.
// -----------------------------------------------------------------------------
exports.recalculateBalance = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Recalcul du solde pour le compte ${id}`);

    // Vérifier que le compte existe
    const accountCheck = await pool.query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Compte introuvable' });
    }

    const account = accountCheck.rows[0];
    const { RECEIVABLES_ACCOUNT_ID } = getAccountIds();

    let newBalance = 0;
    let transactionCount = 0;

    // Cas spécial : compte RECEIVABLES = somme des receivables ouverts
    if (account.id === RECEIVABLES_ACCOUNT_ID) {
      const receivablesResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM receivables
         WHERE status <> 'closed'`
      );
      newBalance = parseFloat(receivablesResult.rows[0].total || 0);
      console.log(`  ℹ️  Compte RECEIVABLES: solde calculé depuis receivables ouverts`);
    } else {
      // Cas normal : somme des transactions
      const transactionsResult = await pool.query(
        `SELECT type, amount FROM transactions 
         WHERE account_id = $1 
         AND (is_posted = true OR is_planned = false)
         ORDER BY transaction_date ASC`,
        [id]
      );

      transactionCount = transactionsResult.rows.length;

      transactionsResult.rows.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
          newBalance += amount;
        } else if (t.type === 'expense') {
          newBalance -= amount;
        }
      });
    }

    // Mise à jour du compte
    await pool.query(
      'UPDATE accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newBalance, id]
    );

    console.log(
      `✅ Solde recalculé: ${account.name} → ${newBalance} Ar (${transactionCount} transactions)`
    );

    res.json({
      success: true,
      accountId: id,
      accountName: account.name,
      oldBalance: parseFloat(account.balance),
      newBalance: newBalance,
      transactionCount: transactionCount,
    });
  } catch (error) {
    console.error('❌ Erreur recalculateBalance:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

// -----------------------------------------------------------------------------
// POST /api/accounts/recalculate-all
// -----------------------------------------------------------------------------
// ⚠️ DÉSACTIVÉ - Conserve les soldes du backup sans recalcul
// -----------------------------------------------------------------------------
exports.recalculateAllBalances = async (req, res) => {
  try {
    console.log('⚠️ Recalcul désactivé - Les soldes du backup sont conservés');
    
    // Récupérer les soldes actuels sans les modifier
    const accountsResult = await pool.query(
      'SELECT id, name, balance FROM accounts ORDER BY id ASC'
    );
    
    const results = accountsResult.rows.map(account => ({
      accountId: account.id,
      accountName: account.name,
      oldBalance: parseFloat(account.balance),
      newBalance: parseFloat(account.balance), // Inchangé
      transactionCount: 0,
    }));
    
    console.log(`✅ Soldes conservés (${results.length} comptes) - Aucun recalcul effectué`);
    
    res.json({ 
      success: true, 
      results, 
      totalAccounts: results.length,
      message: 'Recalcul désactivé - Soldes du backup conservés'
    });
  } catch (error) {
    console.error('❌ Erreur recalculateAllBalances:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};
