const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pour protéger les routes
const protect = async (req, res, next) => {
  try {
    let token;

    // Vérifier si le token est dans les headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('🔑 Token reçu pour:', req.method, req.path); // Debug log
    } else {
      console.warn('⚠️ Aucun token dans les headers pour:', req.method, req.path); // Debug log
    }

    // ⚠️ Cas particulier pour les prévisualisations de documents (iframe, nouvel onglet, etc.)
    // On accepte aussi un token passé en query string (?token=...)
    if (!token && req.query && req.query.token) {
      token = req.query.token;
      console.log('🔑 Token récupéré depuis query parameter pour:', req.method, req.path);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé, token manquant'
      });
    }

    try {
      // Vérifier le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
      console.log('✅ Token valide pour l\'utilisateur ID:', decoded.id); // Debug log
      
      // Récupérer l'utilisateur (sans le mot de passe)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        console.error('❌ Utilisateur non trouvé pour ID:', decoded.id); // Debug log
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      if (!req.user.isActive) {
        console.warn('⚠️ Compte désactivé pour:', req.user.email); // Debug log
        return res.status(401).json({
          success: false,
          message: 'Compte désactivé'
        });
      }

      console.log('✅ Utilisateur authentifié:', req.user.email, 'Rôle:', req.user.role); // Debug log
      next();
    } catch (error) {
      console.error('❌ Erreur de vérification du token:', error.message); // Debug log
      return res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'authentification'
    });
  }
};

// Middleware pour vérifier le rôle
const authorize = (...roles) => {
  return (req, res, next) => {
    console.log('🔍 Middleware authorize - Route:', req.method, req.path); // Debug log
    console.log('🔍 User:', req.user ? `${req.user.email} (${req.user.role})` : 'non défini'); // Debug log
    console.log('🔍 Rôles autorisés:', roles); // Debug log
    
    if (!req.user) {
      console.error('❌ Authorize: Utilisateur non défini'); // Debug log
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    if (!roles.includes(req.user.role)) {
      console.error('❌ Authorize: Rôle non autorisé', req.user.role, 'pour', roles); // Debug log
      return res.status(403).json({
        success: false,
        message: `Le rôle ${req.user.role} n'a pas accès à cette ressource`
      });
    }

    console.log('✅ Authorize: Accès autorisé'); // Debug log
    next();
  };
};

module.exports = { protect, authorize };


