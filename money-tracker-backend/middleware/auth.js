// middleware/auth.js - VERSION COMPATIBLE
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Token invalide' });
      }
      
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('❌ Erreur middleware auth:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ✅ Export par défaut (pour l'ancien code)
module.exports = authenticateToken;

// ✅ Export nommé (pour le nouveau code avec destructuration)
module.exports.authenticateToken = authenticateToken;
