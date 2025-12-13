const User = require('../models/User');
const Log = require('../models/Log');

/**
 * Middleware pour gérer l'impersonation
 * Vérifie les headers X-Impersonate-User-Id et X-Impersonate-Admin-Id
 * et valide que l'admin a les droits d'impersonation
 */
const handleImpersonation = async (req, res, next) => {
  try {
    const impersonateUserId = req.headers['x-impersonate-user-id'];
    const impersonateAdminId = req.headers['x-impersonate-admin-id'];

    // Si pas d'impersonation, continuer normalement
    if (!impersonateUserId || !impersonateAdminId) {
      req.impersonateUserId = null;
      req.impersonateAdminId = null;
      return next();
    }

    // Vérifier que l'utilisateur connecté est bien l'admin qui demande l'impersonation
    if (req.user.id.toString() !== impersonateAdminId) {
      console.warn('⚠️ Tentative d\'impersonation non autorisée:', {
        connectedUser: req.user.id,
        requestedAdmin: impersonateAdminId
      });
      return res.status(403).json({
        success: false,
        message: 'Impersonation non autorisée'
      });
    }

    // Vérifier que l'utilisateur connecté est admin ou superadmin
    if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      console.warn('⚠️ Tentative d\'impersonation par un non-admin:', req.user.email);
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent utiliser l\'impersonation'
      });
    }

    // Vérifier que l'utilisateur à impersonner existe
    const targetUser = await User.findById(impersonateUserId);
    if (!targetUser) {
      console.warn('⚠️ Utilisateur à impersonner non trouvé:', impersonateUserId);
      return res.status(404).json({
        success: false,
        message: 'Utilisateur à impersonner non trouvé'
      });
    }

    // Logger l'action d'impersonation (de manière asynchrone, ne pas bloquer)
    Log.create({
      user: req.user.id,
      userEmail: req.user.email,
      targetUser: impersonateUserId,
      targetUserEmail: targetUser.email,
      action: 'impersonation_start',
      description: `${req.user.email} (${req.user.role}) a démarré une impersonation de ${targetUser.email}`,
      ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.get('user-agent'),
      metadata: {
        adminId: req.user.id.toString(),
        targetUserId: impersonateUserId,
        route: req.path,
        method: req.method
      }
    }).catch((logError) => {
      console.error('❌ Erreur lors de l\'enregistrement du log d\'impersonation:', logError);
      // Ne pas bloquer la requête si le log échoue
    });

    // Ajouter les informations d'impersonation à la requête
    req.impersonateUserId = impersonateUserId;
    req.impersonateAdminId = impersonateAdminId;
    req.impersonateTargetUser = targetUser;

    console.log('👤 Impersonation active:', {
      admin: req.user.email,
      targetUser: targetUser.email,
      route: req.path
    });

    next();
  } catch (error) {
    console.error('❌ Erreur dans le middleware d\'impersonation:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la gestion de l\'impersonation'
    });
  }
};

/**
 * Helper pour logger les actions en mode impersonation
 */
const logImpersonationAction = async (req, action, description, metadata = {}) => {
  if (!req.impersonateUserId) return; // Pas d'impersonation, pas de log spécial

  try {
    await Log.create({
      user: req.impersonateAdminId,
      userEmail: req.user.email,
      targetUser: req.impersonateUserId,
      targetUserEmail: req.impersonateTargetUser?.email,
      action: `impersonation_${action}`,
      description: `[IMPERSONATION] ${req.user.email} (${req.user.role}) - ${description}`,
      ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
      userAgent: req.get('user-agent'),
      metadata: {
        adminId: req.impersonateAdminId,
        targetUserId: req.impersonateUserId,
        route: req.path,
        method: req.method,
        ...metadata
      }
    });
  } catch (logError) {
    console.error('❌ Erreur lors de l\'enregistrement du log d\'action impersonation:', logError);
  }
};

module.exports = { handleImpersonation, logImpersonationAction };

