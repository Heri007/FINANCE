// controllers/importController.js - VERSION OPTIMISÉE AVEC LOGGER
const pool = require('../config/database');
const logger = require('../config/logger'); // ✅ Import logger

/**
 * Fonction utilitaire partagée pour créer la signature d'une transaction
 * Utilisée à la fois par checkDuplicates et importTransactions
 */
const createSig = (t) => {
  const cleanDesc = (t.description || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?@#$%^&*()]/g, '')
    .substring(0, 40);

  const date = t.transaction_date
    ? t.transaction_date.split('T')[0]
    : t.date;

  const amount = Math.abs(parseFloat(t.amount)).toFixed(2);

  // Signature composite: ID_COMPTE | DATE | MONTANT | TYPE | DESCRIPTION_NETTOYÉE
  return `${t.account_id}|${date}|${amount}|${t.type}|${cleanDesc}`;
};

/**
 * Vérifier les doublons avant import (pré-validation)
 * POST /api/import/check-duplicates
 */
exports.checkDuplicates = async (req, res, next) => {
  try {
    const { transactions } = req.body;

    if (!transactions || transactions.length === 0) {
      return res.json({
        total: 0,
        duplicates: 0,
        unique: 0,
        duplicatesList: [],
        uniqueList: [],
      });
    }

    logger.debug(`🔍 Vérification doublons pour ${transactions.length} transactions`);

    // Récupérer toutes les transactions existantes postées
    const existingResult = await pool.query(`
      SELECT account_id, type, amount, description, transaction_date
      FROM transactions
      WHERE is_posted = true
    `);

    const existing = existingResult.rows;
    const existingSigs = new Set(existing.map(createSig));

    const duplicates = [];
    const unique = [];

    transactions.forEach((trx, index) => {
      const sig = createSig(trx);
      if (existingSigs.has(sig)) {
        duplicates.push({ index, transaction: trx });
      } else {
        unique.push({ index, transaction: trx });
        existingSigs.add(sig); // Éviter doublons internes au batch actuel
      }
    });

    logger.info(`✅ Résultat check: ${unique.length} uniques / ${duplicates.length} doublons`);

    res.json({
      total: transactions.length,
      duplicates: duplicates.length,
      unique: unique.length,
      duplicatesList: duplicates.slice(0, 10), // On renvoie juste un échantillon
      uniqueList: unique,
    });
  } catch (error) {
    logger.error('❌ Erreur checkDuplicates:', { error: error.message });
    next(error);
  }
};

/**
 * Import incrémental des transactions CSV
 * POST /api/transactions/import
 * Body: { transactions: [...] }
 */
exports.importTransactions = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { transactions } = req.body || {};

    if (!transactions || transactions.length === 0) {
      return res.json({ imported: 0, duplicates: 0, unique: 0 });
    }

    logger.info(`📥 Demande d'import pour ${transactions.length} transactions`);

    // 1) Récupérer toutes les transactions existantes postées pour le dédoublonnage final
    const existingResult = await client.query(`
      SELECT account_id, type, amount, description, transaction_date
      FROM transactions
      WHERE is_posted = true
    `);

    const existing = existingResult.rows;
    const existingSigs = new Set(existing.map(createSig));

    // 2) Filtrer les uniques à insérer
    const uniqueToInsert = [];
    let duplicatesCount = 0;

    transactions.forEach((trx) => {
      const sig = createSig(trx);
      if (existingSigs.has(sig)) {
        duplicatesCount += 1;
      } else {
        uniqueToInsert.push(trx);
        existingSigs.add(sig);
      }
    });

    if (uniqueToInsert.length === 0) {
      logger.info('⚠️ Aucun import nécessaire (tous doublons)');
      return res.json({
        imported: 0,
        duplicates: duplicatesCount,
        unique: 0,
      });
    }

    // 3) Insertion + mise à jour des soldes
    await client.query('BEGIN');
    logger.info(`📝 Insertion de ${uniqueToInsert.length} transactions...`);

    for (const t of uniqueToInsert) {
      const finalDate = t.transaction_date || t.date;

      // Création de la transaction
      const insertResult = await client.query(
        `INSERT INTO transactions
          (account_id, type, amount, category, description, transaction_date,
           is_planned, is_posted, project_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          t.account_id,
          t.type,
          t.amount,
          t.category,
          t.description,
          finalDate,
          t.is_planned || false,
          true,                 // Import CSV = posté directement
          t.project_id || null,
        ]
      );

      const trx = insertResult.rows[0];

      // Mise à jour immédiate du solde
      if (trx.type === 'income') {
        await client.query(
          'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
          [trx.amount, trx.account_id]
        );
      } else if (trx.type === 'expense') {
        await client.query(
          'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
          [trx.amount, trx.account_id]
        );
      }
    }

    await client.query('COMMIT');
    logger.info(`✅ Import réussi : ${uniqueToInsert.length} importées`);

    res.json({
      imported: uniqueToInsert.length,
      duplicates: duplicatesCount,
      unique: uniqueToInsert.length,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('❌ Erreur importTransactions:', { error: error.message });
    next(error);
  } finally {
    client.release();
  }
};
