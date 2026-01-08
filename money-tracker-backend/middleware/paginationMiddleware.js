/**
 * Middleware de pagination pour Express
 * Ajoute req.pagination et res.paginate() à chaque requête
 */
const paginationMiddleware = (req, res, next) => {
  // Extraire les paramètres de pagination depuis query
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 items
  const offset = (page - 1) * limit;

  // Ajouter à req pour utilisation dans les controllers
  req.pagination = {
    page,
    limit,
    offset
  };

  // Helper pour formater la réponse paginée
  res.paginate = (data, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
        nextPage: hasNext ? page + 1 : null,
        prevPage: hasPrev ? page - 1 : null
      }
    });
  };

  next();
};

/**
 * Helper pour construire les requêtes SQL paginées
 * @param {string} baseQuery - Requête SQL de base
 * @param {object} pagination - Objet pagination depuis req.pagination
 * @param {string} orderBy - Clause ORDER BY (défaut: created_at DESC)
 * @returns {object} Objet avec query, countQuery, limit, offset
 */
const buildPaginatedQuery = (baseQuery, pagination, orderBy = 'created_at DESC') => {
  return {
    query: `
      ${baseQuery}
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
    `,
    countQuery: `
      SELECT COUNT(*) as total
      FROM (${baseQuery}) as count_query
    `,
    limit: pagination.limit,
    offset: pagination.offset
  };
};

module.exports = {
  paginationMiddleware,
  buildPaginatedQuery
};
