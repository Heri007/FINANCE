const cacheService = require('../services/cacheService');

/**
 * Middleware pour mettre en cache les réponses GET
 * @param {number} duration - Durée du cache en secondes (défaut: 300 = 5 min)
 * @returns {Function} Fonction middleware Express
 */
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    // Ne cacher que les requêtes GET
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `route:${req.originalUrl}`;
    
    try {
      // Vérifier le cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`📦 Cache HIT: ${cacheKey}`);
        return res.json(cachedResponse);
      }

      // Intercepter res.json pour cacher la réponse
      const originalJson = res.json.bind(res);
      
      res.json = (body) => {
        if (res.statusCode === 200) {
          cacheService.set(cacheKey, body, duration).catch(err => {
            console.error('Cache set error:', err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Middleware pour invalider le cache après modifications
 * @param {Array<string>} patterns - Patterns de clés à invalider
 * @returns {Function} Fonction middleware Express
 */
const invalidateCacheMiddleware = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    const invalidateCache = async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        for (const pattern of patterns) {
          try {
            await cacheService.delPattern(pattern);
          } catch (error) {
            console.error(`Cache invalidation error for ${pattern}:`, error);
          }
        }
      }
    };

    res.json = async (body) => {
      await invalidateCache();
      return originalJson(body);
    };

    res.send = async (body) => {
      await invalidateCache();
      return originalSend(body);
    };

    next();
  };
};

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware
};
