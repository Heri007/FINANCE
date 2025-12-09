// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('Erreur globale:', err);
  
  // Erreur PostgreSQL
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({
      error: 'Erreur de contrainte base de données',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token invalide' });
  }
  
  // Erreur par défaut
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
