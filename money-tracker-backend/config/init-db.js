// db/init.js (par exemple)
// -----------------------------------------------------------------------------
// Initialise le schéma PostgreSQL pour Money Tracker.
// - Crée les tables principales (app_settings, sessions, accounts, transactions)
// - Crée la table projects (modèle de projets, budgets, ROI, etc.)
// - Ajoute les colonnes de liaison projet aux transactions (is_planned, project_id)
// - Crée les index nécessaires pour les performances
// -----------------------------------------------------------------------------
const pool = require('./database');

// -----------------------------------------------------------------------------
// Fonction principale d’initialisation
// -----------------------------------------------------------------------------
// Exécutée au démarrage du serveur (ou manuellement en CLI).
// Utilise une transaction pour garantir que tout passe ou rien n’est appliqué.
// -----------------------------------------------------------------------------
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------------
    // Table app_settings
    // -------------------------------------------------------------------------
    // Stocke la config globale et le PIN (hashé) de l’app :
    // - pin_hash           : hash du PIN utilisateur
    // - is_masked          : masque ou non les montants dans l’UI
    // - auto_lock_minutes  : délai d’auto-verrouillage
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        pin_hash VARCHAR(255),
        is_masked BOOLEAN DEFAULT FALSE,
        auto_lock_minutes INTEGER DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -------------------------------------------------------------------------
    // Table sessions
    // -------------------------------------------------------------------------
    // Gère les sessions d’accès :
    // - token      : token de session (PIN validé)
    // - expires_at : expiration de la session
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        token VARCHAR(500) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -------------------------------------------------------------------------
    // Table accounts
    // -------------------------------------------------------------------------
    // Représente les comptes financiers :
    // - name    : nom du compte (ex: Compte courant, Revolut…)
    // - balance : solde courant (peut être recalculé à partir des transactions)
    // - type    : type de compte (cash, bank, credit, etc.)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0,
        type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -------------------------------------------------------------------------
    // Table transactions
    // -------------------------------------------------------------------------
    // Stocke tous les mouvements :
    // - account_id       : FK vers accounts
    // - type             : income | expense
    // - amount           : montant
    // - category         : catégorie fonctionnelle (logement, salaire, etc.)
    // - description      : notes libres
    // - transaction_date : date effective de la transaction
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        amount DECIMAL(15, 2) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        transaction_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // -------------------------------------------------------------------------
    // Table projects
    // -------------------------------------------------------------------------
    // Modélise un projet / scénario (mission client, lancement produit, etc.) :
    // - name, description, type, status
    // - fréquence & occurrences pour le côté récurrent
    // - unit_volume / price_per_unit / cost_per_unit : logique volumétrique
    // - total_cost, total_revenues, net_profit, roi, margin_percent, etc.
    // - JSONB (expenses, revenues, allocation...) pour stocker les détails
    // - accounts_snapshot : état des comptes au moment de l’activation
    // -------------------------------------------------------------------------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'ponctuel',
        status VARCHAR(50) DEFAULT 'draft',
        frequency VARCHAR(50),
        occurrences_count INTEGER DEFAULT 1,
        unit_volume DECIMAL(10, 2),
        unit_label VARCHAR(20),
        price_per_unit DECIMAL(15, 2),
        cost_per_unit DECIMAL(15, 2),
        start_date DATE,
        end_date DATE,
        total_cost DECIMAL(15, 2) DEFAULT 0,
        total_revenues DECIMAL(15, 2) DEFAULT 0,
        net_profit DECIMAL(15, 2) DEFAULT 0,
        roi DECIMAL(10, 2) DEFAULT 0,
        profit_per_occurrence DECIMAL(15, 2),
        margin_percent DECIMAL(10, 2),
        break_even_units INTEGER,
        feasible BOOLEAN DEFAULT true,
        remaining_budget DECIMAL(15, 2),
        total_available DECIMAL(15, 2),
        expenses JSONB DEFAULT '[]',
        revenues JSONB DEFAULT '[]',
        allocation JSONB DEFAULT '{}',
        revenue_allocation JSONB DEFAULT '{}',
        accounts_snapshot JSONB DEFAULT '{}',
        activated_at TIMESTAMP,
        activated_transactions INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // -------------------------------------------------------------------------
    // Index pour les performances
    // -------------------------------------------------------------------------
    // Accélèrent les requêtes sur les transactions par compte, date ou type.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    `);

    await client.query('COMMIT');
    console.log('✅ Base de données initialisée avec succès !');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de l\'initialisation:', error);
    throw error;
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------------------------
// Migration incrémentale : ajout des colonnes liées aux projets
// -----------------------------------------------------------------------------
// - is_planned : distingue les transactions planifiées des transactions réelles
// - project_id : lie une transaction à un projet (FK vers projects)
// Crée aussi les index associés.
// -----------------------------------------------------------------------------
const updateTransactionsTable = async () => {
  try {
    await pool.query(`
      DO $$ 
      BEGIN
        -- Ajouter is_planned si manquant
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'is_planned'
        ) THEN
          ALTER TABLE transactions ADD COLUMN is_planned BOOLEAN DEFAULT FALSE;
        END IF;

        -- Ajouter project_id si manquant
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'transactions' AND column_name = 'project_id'
        ) THEN
          ALTER TABLE transactions ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
      END $$;

      -- Index pour les champs projet
      CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_is_planned ON transactions(is_planned);
    `);

    console.log('✅ Table transactions mise à jour (is_planned, project_id)');
  } catch (error) {
    console.error('❌ Erreur mise à jour transactions:', error);
  }
};

// Appel automatique au démarrage du serveur (migration douce)
updateTransactionsTable();

// -----------------------------------------------------------------------------
// Execution CLI
// -----------------------------------------------------------------------------
// Si le fichier est exécuté directement :
//   node db/init.js
// On initialise alors la base puis on termine le process.
// -----------------------------------------------------------------------------
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
