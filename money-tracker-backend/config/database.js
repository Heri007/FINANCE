// config/database.js
// -----------------------------------------------------------------------------
// Initialise un pool de connexions PostgreSQL partagé par tout le backend.
// - Lit la configuration dans les variables d’environnement (.env)
// - Crée un Pool pg réutilisable (meilleures perfs que client unique)
// - Log les connexions réussies et les erreurs globales
// -----------------------------------------------------------------------------
const { Pool } = require('pg');
require('dotenv').config();

// -----------------------------------------------------------------------------
// Configuration du pool PostgreSQL
// -----------------------------------------------------------------------------
// Les valeurs sont chargées depuis le fichier .env :
// - DB_HOST : hôte PostgreSQL (ex: localhost)
// - DB_PORT : port PostgreSQL (ex: 5432)
// - DB_NAME : nom de la base (ex: money_tracker)
// - DB_USER : utilisateur PostgreSQL
// - DB_PASSWORD : mot de passe
// -----------------------------------------------------------------------------
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  client_encoding: 'UTF8',
  ssl: false
});

// -----------------------------------------------------------------------------
// Événements du pool
// -----------------------------------------------------------------------------
// connect : appelé à chaque fois qu’une nouvelle connexion est ouverte.
// error   : erreurs globales sur le pool (pertes de connexion, etc.).
// -----------------------------------------------------------------------------
pool.on('connect', () => {
  console.log('✅ Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL:', err);
});

// -----------------------------------------------------------------------------
// Export du pool
// -----------------------------------------------------------------------------
// Permet d’exécuter des requêtes partout dans l’app avec :
//   const pool = require('./config/database');
//   const result = await pool.query('SELECT 1');
// -----------------------------------------------------------------------------
module.exports = pool;
