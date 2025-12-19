const express = require('express');
const { body, validationResult } = require('express-validator');
const Dossier = require('../models/Dossier');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { handleImpersonation, logImpersonationAction, notifyImpersonationAction, getEffectiveUserId, getEffectiveUser } = require('../middleware/impersonation');

const router = express.Router();

// Helper function pour créer une notification
const createNotification = async (userId, type, titre, message, lien = null, metadata = {}) => {
  try {
    if (!userId) {
      console.warn('⚠️ Pas de notification créée : userId manquant');
      return null; // Pas de notification si pas d'utilisateur
    }
    
    console.log('📧 Création de notification:', { userId, type, titre, message: message ? message.substring(0, 50) + '...' : 'message vide' });
    
    const notification = await Notification.create({
      user: userId,
      type,
      titre,
      message,
      lien,
      metadata
    });
    
    console.log('✅ Notification créée avec succès:', notification._id);
    return notification;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la notification:', error);
    console.error('❌ Détails:', { userId, type, titre, error: error.message, stack: error.stack });
    // Ne pas bloquer l'action principale si la notification échoue
    // Retourner null pour indiquer l'échec sans bloquer
    return null;
  }
};

// @route   POST /api/user/dossiers
// @desc    Créer un nouveau dossier (Public pour visiteurs, Private pour utilisateurs connectés)
// @access  Public/Private
router.post(
  '/',
  [
    body('titre').optional().trim(),
    body('categorie').optional().isIn(['sejour_titres', 'contentieux_administratif', 'asile', 'regroupement_familial', 'nationalite_francaise', 'eloignement_urgence', 'autre']),
    body('statut').optional().isIn(['recu', 'accepte', 'refuse', 'en_attente_onboarding', 'en_cours_instruction', 'pieces_manquantes', 'dossier_complet', 'depose', 'reception_confirmee', 'complement_demande', 'decision_defavorable', 'communication_motifs', 'recours_preparation', 'refere_mesures_utiles', 'refere_suspension_rep', 'gain_cause', 'rejet', 'decision_favorable']),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente'])
  ],
  // Middleware d'authentification optionnel
  async (req, res, next) => {
    // Si un token est fourni, vérifier l'authentification
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      return protect(req, res, next);
    }
    // Sinon, continuer sans authentification (visiteur)
    next();
  },
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array()
        });
      }

      const {
        userId,
        clientNom,
        clientPrenom,
        clientEmail,
        clientTelephone,
        titre,
        description,
        categorie,
        type,
        statut,
        priorite,
        dateEcheance,
        notes,
        assignedTo,
        rendezVousId
      } = req.body;

      // Vérifier si un utilisateur est spécifié (pour utilisateurs connectés)
      let user = null;
      let finalUserId = userId;
      
      // Si l'utilisateur est connecté mais n'a pas fourni d'ID, utiliser l'ID effectif (impersonné si en impersonation)
      if (!finalUserId && req.user && req.user.id) {
        finalUserId = getEffectiveUserId(req);
      }
      
      if (finalUserId) {
        user = await User.findById(finalUserId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
          });
        }
      }

      // Tous les champs sont optionnels - pas de validation obligatoire pour les visiteurs

      // Vérifier si un membre de l'équipe est assigné (seulement pour les admins)
      let assignedUser = null;
      if (assignedTo) {
        // Seuls les admins peuvent assigner des dossiers
        if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
          return res.status(403).json({
            success: false,
            message: 'Seuls les administrateurs peuvent assigner des dossiers'
          });
        }
        assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: 'Membre de l\'équipe assigné non trouvé'
          });
        }
        // Vérifier que l'utilisateur assigné est un admin ou superadmin
        if (assignedUser.role !== 'admin' && assignedUser.role !== 'superadmin') {
          return res.status(400).json({
            success: false,
            message: 'Le dossier ne peut être assigné qu\'à un membre de l\'équipe (admin ou superadmin)'
          });
        }
      }

      const dossier = await Dossier.create({
        user: finalUserId || null,
        clientNom: finalUserId ? null : clientNom,
        clientPrenom: finalUserId ? null : clientPrenom,
        clientEmail: finalUserId ? user.email : clientEmail,
        clientTelephone: finalUserId ? user.phone : clientTelephone,
        titre: titre || '',
        description: description || '',
        categorie: categorie || 'autre',
        type: type || '',
        statut: statut || 'recu',
        priorite: priorite || 'normale',
        dateEcheance: dateEcheance || null,
        notes: notes || '',
        createdBy: req.user ? getEffectiveUserId(req) : null, // null si créé par un visiteur, utilise l'ID impersonné si en impersonation
        assignedTo: assignedTo || null,
        rendezVous: rendezVousId ? [rendezVousId] : []
      });

      // Si le dossier est créé depuis un rendez-vous, lier le rendez-vous au dossier
      if (rendezVousId) {
        try {
          const RendezVous = require('../models/RendezVous');
          const rendezVous = await RendezVous.findById(rendezVousId);
          
          if (rendezVous) {
            rendezVous.dossierId = dossier._id;
            await rendezVous.save();
            console.log(`✅ Rendez-vous ${rendezVousId} lié au dossier ${dossier._id}`);
          }
        } catch (linkError) {
          console.error('Erreur lors de la liaison du rendez-vous au dossier:', linkError);
          // Ne pas bloquer la création du dossier si la liaison échoue
        }
      }

      // Si le dossier est créé depuis un rendez-vous, notifier les admins
      if (rendezVousId && finalUserId) {
        try {
          const RendezVous = require('../models/RendezVous');
          const rendezVous = await RendezVous.findById(rendezVousId);
          
          if (rendezVous && user) {
            // Notifier tous les admins actifs
            const admins = await User.find({ 
              role: { $in: ['admin', 'superadmin'] },
              isActive: true 
            });
            
            for (const admin of admins) {
              await createNotification(
                admin._id,
                'dossier_created',
                'Nouveau dossier créé depuis un rendez-vous',
                `Un nouveau dossier "${dossier.titre}" a été créé par ${user.firstName} ${user.lastName} suite au rendez-vous du ${new Date(rendezVous.date).toLocaleDateString('fr-FR')}.`,
                '/admin/dossiers',
                {
                  dossierId: dossier._id.toString(),
                  rendezVousId: rendezVousId.toString(),
                  userId: finalUserId.toString()
                }
              );
            }
          }
        } catch (notifError) {
          console.error('Erreur lors de la création des notifications:', notifError);
          // Ne pas bloquer la création du dossier si la notification échoue
        }
      }

      // Logger l'action (si utilisateur connecté)
      if (req.user) {
        try {
          const Log = require('../models/Log');
          await Log.create({
            action: 'dossier_created',
            user: getEffectiveUserId(req), // Utilise l'ID impersonné si en impersonation
            userEmail: req.user.email,
            targetUser: finalUserId || null,
            targetUserEmail: finalUserId ? user.email : clientEmail,
            description: `${req.user.email} a créé le dossier "${titre}" ${finalUserId ? `pour ${user.email}` : `pour ${clientNom} ${clientPrenom} (non inscrit)`}`,
            ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
            userAgent: req.get('user-agent'),
            metadata: {
              dossierId: dossier._id.toString(),
              titre,
              categorie: dossier.categorie,
              type: dossier.type,
              statut,
              rendezVousId: rendezVousId || null
            }
          });
        } catch (logError) {
          console.error('Erreur lors de l\'enregistrement du log:', logError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Dossier créé avec succès',
        dossier
      });
    } catch (error) {
      console.error('Erreur lors de la création du dossier:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// Toutes les autres routes nécessitent une authentification
router.use(protect);
// Ajouter le middleware d'impersonation après protect
router.use(handleImpersonation);

// @route   GET /api/user/dossiers
// @desc    Récupérer tous les dossiers de l'utilisateur connecté (tous les rôles)
// @access  Private (tous les rôles authentifiés)
router.get('/', async (req, res) => {
  try {
    // En mode impersonation, utiliser l'ID de l'utilisateur impersonné
    const targetUserId = req.impersonateUserId || req.user.id;
    const targetUserEmail = req.impersonateTargetUser?.email || req.user.email;
    
    console.log('📁 Récupération des dossiers pour l\'utilisateur:', targetUserId, 'Email:', targetUserEmail, 'Rôle:', req.user.role, req.impersonateUserId ? '[IMPERSONATION]' : '');
    
    // Construire le filtre pour récupérer les dossiers de l'utilisateur
    // 1. Dossiers où l'utilisateur est directement associé (user field)
    // 2. Dossiers où l'email correspond (clientEmail) - pour les dossiers créés par un admin
    // Normaliser l'email pour la comparaison (insensible à la casse)
    const userEmailLower = targetUserEmail ? targetUserEmail.toLowerCase() : '';
    
    const filter = {
      $or: [
        { user: targetUserId },
        { clientEmail: { $regex: new RegExp(`^${userEmailLower}$`, 'i') } } // Comparaison insensible à la casse
      ]
    };
    
    // Si l'utilisateur est admin ou superadmin (et pas en impersonation), il peut aussi voir les dossiers qui lui sont assignés
    if ((req.user.role === 'admin' || req.user.role === 'superadmin') && !req.impersonateUserId) {
      filter.$or.push({ assignedTo: req.user.id });
    }
    
    console.log('🔍 Filtre de recherche:', JSON.stringify(filter, null, 2));
    
    const dossiers = await Dossier.find(filter)
      .populate('user', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('documents')
      .populate('messages')
      .sort({ createdAt: -1 });
    
    console.log('✅ Dossiers trouvés:', dossiers.length, 'pour l\'utilisateur:', targetUserEmail);
    
    // Logger l'action si en impersonation
    if (req.impersonateUserId) {
      await logImpersonationAction(req, 'view_dossiers', `Consultation de ${dossiers.length} dossier(s)`, { count: dossiers.length });
    }
    
    res.json({
      success: true,
      count: dossiers.length,
      dossiers
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/user/dossiers/admin
// @desc    Récupérer tous les dossiers (Admin seulement)
// @access  Private/Admin
router.get('/admin', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { statut, type, categorie, userId, search } = req.query;
    
    const filter = {};
    
    if (statut) {
      filter.statut = statut;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (categorie) {
      filter.categorie = categorie;
    }
    
    if (userId) {
      filter.user = userId;
    }
    
    if (search) {
      filter.$or = [
        { titre: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { clientNom: { $regex: search, $options: 'i' } },
        { clientPrenom: { $regex: search, $options: 'i' } },
        { clientEmail: { $regex: search, $options: 'i' } }
      ];
    }
    
    const dossiers = await Dossier.find(filter)
      .populate('user', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email role')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: dossiers.length,
      dossiers
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des dossiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   POST /api/user/dossiers
// @desc    Créer un nouveau dossier
// @access  Private
router.post(
  '/',
  [
    body('titre').optional().trim(),
    body('categorie').optional().isIn(['sejour_titres', 'contentieux_administratif', 'asile', 'regroupement_familial', 'nationalite_francaise', 'eloignement_urgence', 'autre']),
    body('statut').optional().isIn(['recu', 'accepte', 'refuse', 'en_attente_onboarding', 'en_cours_instruction', 'pieces_manquantes', 'dossier_complet', 'depose', 'reception_confirmee', 'complement_demande', 'decision_defavorable', 'communication_motifs', 'recours_preparation', 'refere_mesures_utiles', 'refere_suspension_rep', 'gain_cause', 'rejet', 'decision_favorable']),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente'])
  ],
  async (req, res) => {
    try {
      // Log du body reçu pour déboguer
      console.log('📥 POST /user/dossiers - Body reçu:', JSON.stringify(req.body, null, 2));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Erreurs de validation:', JSON.stringify(errors.array(), null, 2));
        console.error('❌ Body reçu:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array()
        });
      }

      const {
        userId,
        clientNom,
        clientPrenom,
        clientEmail,
        clientTelephone,
        titre,
        description,
        categorie,
        type,
        statut,
        priorite,
        dateEcheance,
        notes,
        assignedTo
      } = req.body;

      // Vérifier si un utilisateur est spécifié (pour utilisateurs connectés)
      let user = null;
      if (userId) {
        user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur non trouvé'
          });
        }
      }

      // Tous les champs sont optionnels - pas de validation obligatoire pour les visiteurs

      // Si l'utilisateur est connecté mais n'a pas fourni d'ID, utiliser l'ID effectif (impersonné si en impersonation)
      if (!userId && req.user && req.user.id) {
        userId = getEffectiveUserId(req);
        user = await User.findById(userId);
      }

      // Vérifier si un membre de l'équipe est assigné
      let assignedUser = null;
      if (assignedTo) {
        assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: 'Membre de l\'équipe assigné non trouvé'
          });
        }
        // Vérifier que l'utilisateur assigné est un admin ou superadmin
        if (assignedUser.role !== 'admin' && assignedUser.role !== 'superadmin') {
          return res.status(400).json({
            success: false,
            message: 'Le dossier ne peut être assigné qu\'à un membre de l\'équipe (admin ou superadmin)'
          });
        }
      }

      const dossier = await Dossier.create({
        user: userId || null,
        clientNom: userId ? null : clientNom,
        clientPrenom: userId ? null : clientPrenom,
        clientEmail: userId ? user.email : clientEmail,
        clientTelephone: userId ? user.phone : clientTelephone,
        titre: titre || '',
        description: description || '',
        categorie: categorie || 'autre',
        type: type || '',
        statut: statut || 'recu',
        priorite: priorite || 'normale',
        dateEcheance: dateEcheance || null,
        notes: notes || '',
        createdBy: getEffectiveUserId(req), // Utilise l'ID impersonné si en impersonation
        assignedTo: assignedTo || null,
        rendezVous: rendezVousId ? [rendezVousId] : []
      });

      // Logger l'action
      try {
        const Log = require('../models/Log');
        await Log.create({
          action: 'dossier_created',
          user: req.user.id,
          userEmail: req.user.email,
          targetUser: userId || null,
          targetUserEmail: userId ? user.email : clientEmail,
          description: `${req.user.email} a créé le dossier "${titre}" ${userId ? `pour ${user.email}` : `pour ${clientNom} ${clientPrenom} (non inscrit)`}`,
          ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
          userAgent: req.get('user-agent'),
          metadata: {
            dossierId: dossier._id.toString(),
            titre,
            categorie: dossier.categorie,
            type: dossier.type,
            statut
          }
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement du log:', logError);
      }

      const dossierPopulated = await Dossier.findById(dossier._id)
        .populate('user', 'firstName lastName email phone')
        .populate('createdBy', 'firstName lastName email');

      // Si le dossier a été créé par un client (pas un admin), notifier tous les admins
      if (req.user && req.user.role === 'client') {
        try {
          // Trouver tous les admins et superadmins
          const admins = await User.find({
            role: { $in: ['admin', 'superadmin'] },
            isActive: true
          });

          // Créer une notification pour chaque admin
          for (const admin of admins) {
            await createNotification(
              admin._id.toString(),
              'dossier_created',
              'Nouveau dossier créé par un client',
              `${req.user.firstName} ${req.user.lastName} (${req.user.email}) a créé un nouveau dossier : "${titre || 'Sans titre'}"`,
              `/admin/dossiers/${dossier._id}`,
              { 
                dossierId: dossier._id.toString(), 
                titre: titre || 'Sans titre',
                clientId: req.user.id,
                clientEmail: req.user.email
              }
            );
          }
          console.log(`✅ Notifications envoyées à ${admins.length} administrateur(s) pour le nouveau dossier`);
        } catch (notifError) {
          console.error('❌ Erreur lors de la notification des admins:', notifError);
        }
      }
      // Si le dossier a été créé par un admin, notifier le client
      else if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
        let targetUserId = userId;
        
        // Si pas de userId mais on a un clientEmail, chercher l'utilisateur par email
        if (!targetUserId && clientEmail) {
          try {
            const userByEmail = await User.findOne({ email: clientEmail.toLowerCase() });
            if (userByEmail) {
              targetUserId = userByEmail._id.toString();
            }
          } catch (err) {
            console.error('Erreur lors de la recherche de l\'utilisateur par email:', err);
          }
        }
        
        // Créer la notification si on a trouvé un utilisateur
        if (targetUserId) {
          await createNotification(
            targetUserId,
            'dossier_created',
            'Nouveau dossier créé',
            `Un nouveau dossier "${titre || 'Sans titre'}" a été créé pour vous par l'administrateur.`,
            `/client/dossiers`,
            { dossierId: dossier._id.toString(), titre: titre || 'Sans titre' }
          );
        }
      }

      res.status(201).json({
        success: true,
        message: 'Dossier créé avec succès',
        dossier: dossierPopulated
      });
    } catch (error) {
      console.error('Erreur lors de la création du dossier:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   GET /api/user/dossiers/:id
// @desc    Récupérer un dossier par ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
      const dossier = await Dossier.findById(req.params.id)
      .populate('user', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('documents')
      .populate('messages')
      .populate('rendezVous');

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Vérifier que l'utilisateur a accès à ce dossier
    // L'utilisateur peut accéder si :
    // 1. Il est le propriétaire du dossier (user field)
    // 2. Son email correspond au clientEmail du dossier
    // 3. Il est admin/superadmin
    // 4. Le dossier lui est assigné (assignedTo)
    const hasAccess = 
      (dossier.user && dossier.user._id && dossier.user._id.toString() === req.user.id.toString()) ||
      (dossier.clientEmail && dossier.clientEmail.toLowerCase() === req.user.email.toLowerCase()) ||
      (req.user.role === 'admin' || req.user.role === 'superadmin') ||
      (dossier.assignedTo && dossier.assignedTo._id && dossier.assignedTo._id.toString() === req.user.id.toString());

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce dossier'
      });
    }

    res.json({
      success: true,
      dossier
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   PUT /api/user/dossiers/:id
// @desc    Mettre à jour un dossier
// @access  Private
router.put(
  '/:id',
  [
    // Validation simplifiée : tous les champs sont optionnels
    // Si un champ est fourni, il sera validé, sinon ignoré
    body('categorie').optional().isIn(['sejour_titres', 'contentieux_administratif', 'asile', 'regroupement_familial', 'nationalite_francaise', 'eloignement_urgence', 'autre']).withMessage('Catégorie invalide'),
    body('statut').optional().isIn(['recu', 'accepte', 'refuse', 'en_attente_onboarding', 'en_cours_instruction', 'pieces_manquantes', 'dossier_complet', 'depose', 'reception_confirmee', 'complement_demande', 'decision_defavorable', 'communication_motifs', 'recours_preparation', 'refere_mesures_utiles', 'refere_suspension_rep', 'gain_cause', 'rejet', 'decision_favorable']).withMessage('Statut invalide'),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente']).withMessage('Priorité invalide')
    // Pas de validation pour les autres champs optionnels
  ],
  async (req, res) => {
    try {
      // Log du body reçu pour déboguer
      console.log('📥 PUT /user/dossiers/:id - Body reçu:', JSON.stringify(req.body, null, 2));
      console.log('📥 PUT /user/dossiers/:id - Params:', req.params);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Erreurs de validation:', JSON.stringify(errors.array(), null, 2));
        console.error('❌ Body reçu:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array()
        });
      }

      const dossier = await Dossier.findById(req.params.id)
        .populate('user', 'firstName lastName email phone');

      if (!dossier) {
        return res.status(404).json({
          success: false,
          message: 'Dossier non trouvé'
        });
      }

      // Vérifier les permissions
      const dossierUserId = dossier.user ? (dossier.user._id ? dossier.user._id.toString() : dossier.user.toString()) : null;
      if (dossierUserId && dossierUserId !== req.user.id.toString()) {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
          return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à ce dossier'
          });
        }
      }

      const {
        titre,
        description,
        categorie,
        type,
        statut,
        priorite,
        dateEcheance,
        notes,
        assignedTo,
        motifRefus,
        notificationMessage
      } = req.body;

      const oldStatut = dossier.statut;
      const oldAssignedTo = dossier.assignedTo ? dossier.assignedTo.toString() : null;

      if (titre) dossier.titre = titre;
      if (description !== undefined) dossier.description = description;
      if (categorie) dossier.categorie = categorie;
      if (type !== undefined) dossier.type = type;
      if (statut) dossier.statut = statut;
      if (priorite) dossier.priorite = priorite;
      if (dateEcheance) dossier.dateEcheance = dateEcheance;
      if (notes !== undefined) dossier.notes = notes;
      if (motifRefus !== undefined) dossier.motifRefus = motifRefus;
      
      // Gérer l'assignation
      if (assignedTo !== undefined) {
        if (assignedTo === '' || assignedTo === null) {
          dossier.assignedTo = null;
        } else {
          const assignedUser = await User.findById(assignedTo);
          if (!assignedUser) {
            return res.status(404).json({
              success: false,
              message: 'Membre de l\'équipe assigné non trouvé'
            });
          }
          // Vérifier que l'utilisateur assigné est un admin ou superadmin
          if (assignedUser.role !== 'admin' && assignedUser.role !== 'superadmin') {
            return res.status(400).json({
              success: false,
              message: 'Le dossier ne peut être assigné qu\'à un membre de l\'équipe (admin ou superadmin)'
            });
          }
          dossier.assignedTo = assignedTo;
        }
      }

      await dossier.save();

      // Recharger le dossier avec les données peuplées pour les notifications
      const dossierForNotification = await Dossier.findById(dossier._id)
        .populate('user', 'firstName lastName email phone');

      // Créer des notifications pour l'utilisateur du dossier si c'est un admin qui modifie
      // Chercher l'utilisateur par user ID ou par email (clientEmail)
      if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        let userId = null;
        
        // Si le dossier a un user associé
        if (dossierForNotification.user) {
          userId = dossierForNotification.user._id ? dossierForNotification.user._id.toString() : dossierForNotification.user.toString();
        } 
        // Sinon, chercher l'utilisateur par email (clientEmail)
        else if (dossierForNotification.clientEmail) {
          try {
            const userByEmail = await User.findOne({ email: dossierForNotification.clientEmail.toLowerCase() });
            if (userByEmail) {
              userId = userByEmail._id.toString();
            }
          } catch (err) {
            console.error('Erreur lors de la recherche de l\'utilisateur par email:', err);
          }
        }
        
        // Si on a trouvé un userId, créer les notifications
        if (userId) {
          // Notification si le statut a changé
          if (statut && statut !== oldStatut) {
          const statutLabels = {
            recu: 'Reçu',
            accepte: 'Accepté',
            refuse: 'Refusé',
            en_attente_onboarding: 'En attente d\'onboarding (RDV)',
            en_cours_instruction: 'En cours d\'instruction (constitution dossier)',
            pieces_manquantes: 'Pièces manquantes (relance client)',
            dossier_complet: 'Dossier Complet',
            depose: 'Déposé',
            reception_confirmee: 'Réception confirmée',
            complement_demande: 'Complément demandé (avec date limite)',
            decision_defavorable: 'Décision défavorable',
            communication_motifs: 'Communication des Motifs',
            recours_preparation: 'Recours en préparation',
            refere_mesures_utiles: 'Référé Mesures Utiles',
            refere_suspension_rep: 'Référé suspension et REP',
            gain_cause: 'Gain de cause',
            rejet: 'Rejet',
            decision_favorable: 'Décision favorable'
          };
          
          // Utiliser le message personnalisé si fourni, sinon générer un message par défaut
          const messageNotification = notificationMessage && notificationMessage.trim() 
            ? notificationMessage.trim()
            : `Le statut de votre dossier "${dossierForNotification.titre}" a été modifié de "${statutLabels[oldStatut] || oldStatut}" à "${statutLabels[statut] || statut}".`;
          
          const titreNotification = `Statut du dossier modifié : ${statutLabels[statut] || statut}`;
          
          console.log('📧 Création de notification pour utilisateur:', userId, 'Message:', messageNotification);
          
          await createNotification(
            userId,
            'dossier_status_changed',
            titreNotification,
            messageNotification,
            `/client/dossiers`,
            { dossierId: dossierForNotification._id.toString(), oldStatut, newStatut: statut }
          );
          
            console.log('✅ Notification créée avec succès');
          }
          
          // Notification si le dossier a été assigné
          if (assignedTo !== undefined && assignedTo !== oldAssignedTo) {
            if (assignedTo && assignedTo !== oldAssignedTo) {
              const assignedUser = await User.findById(assignedTo);
              await createNotification(
                userId,
                'dossier_assigned',
                'Dossier assigné',
                `Votre dossier "${dossierForNotification.titre}" a été assigné à ${assignedUser.firstName} ${assignedUser.lastName}.`,
                `/client/dossiers`,
                { dossierId: dossierForNotification._id.toString(), assignedTo: assignedTo }
              );
            } else if (!assignedTo && oldAssignedTo) {
              await createNotification(
                userId,
                'dossier_updated',
                'Dossier modifié',
                `L'assignation de votre dossier "${dossierForNotification.titre}" a été retirée.`,
                `/client/dossiers`,
                { dossierId: dossierForNotification._id.toString() }
              );
            }
          }
          
          // Notification générale si d'autres modifications
          if (!statut || statut === oldStatut) {
            if (assignedTo === undefined || assignedTo === oldAssignedTo) {
              await createNotification(
                userId,
                'dossier_updated',
                'Dossier modifié',
                `Votre dossier "${dossierForNotification.titre}" a été modifié par l'administrateur.`,
                `/client/dossiers`,
                { dossierId: dossierForNotification._id.toString() }
              );
            }
          }
        } else {
          console.warn('⚠️ Impossible de créer une notification : aucun utilisateur trouvé pour le dossier', dossierForNotification._id);
        }
      }

      // Logger l'action
      try {
        const Log = require('../models/Log');
        await Log.create({
          action: 'dossier_updated',
          user: req.user.id,
          userEmail: req.user.email,
          description: `${req.user.email} a modifié le dossier "${dossier.titre}"`,
          ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
          userAgent: req.get('user-agent'),
          metadata: {
            dossierId: dossier._id.toString(),
            titre: dossier.titre
          }
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement du log:', logError);
      }

      // Si en mode impersonation, notifier l'utilisateur impersonné et les autres admins
      if (req.impersonateUserId) {
        const actionMessage = statut && statut !== oldStatut
          ? `a modifié le statut du dossier "${dossier.titre}" de "${oldStatut}" à "${statut}"`
          : assignedTo !== undefined && assignedTo !== oldAssignedTo
          ? `a modifié l'assignation du dossier "${dossier.titre}"`
          : `a modifié le dossier "${dossier.titre}"`;
        
        await notifyImpersonationAction(
          req,
          'dossier_updated',
          'Modification de dossier',
          actionMessage,
          `/client/dossiers/${dossier._id}`,
          {
            dossierId: dossier._id.toString(),
            titre: dossier.titre,
            oldStatut,
            newStatut: statut,
            oldAssignedTo,
            newAssignedTo: assignedTo
          }
        );
      }

      const dossierPopulated = await Dossier.findById(dossier._id)
        .populate('user', 'firstName lastName email phone')
        .populate('createdBy', 'firstName lastName email');

      res.json({
        success: true,
        message: 'Dossier mis à jour avec succès',
        dossier: dossierPopulated
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du dossier:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   PATCH /api/user/dossiers/:id/cancel
// @desc    Annuler un dossier (client seulement)
// @access  Private
router.patch('/:id/cancel', protect, async (req, res) => {
  try {
    const dossier = await Dossier.findById(req.params.id);

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Vérifier que l'utilisateur est le propriétaire du dossier
    const userId = getEffectiveUserId(req); // Utilise l'ID impersonné si en impersonation
    const dossierUserId = dossier.user ? (dossier.user._id ? dossier.user._id.toString() : dossier.user.toString()) : null;
    
    if (dossierUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas la permission d\'annuler ce dossier'
      });
    }

    // Vérifier que le dossier n'est pas déjà annulé ou dans un statut final
    const statutsFinaux = ['annule', 'decision_favorable', 'decision_defavorable', 'rejet', 'gain_cause'];
    if (statutsFinaux.includes(dossier.statut)) {
      return res.status(400).json({
        success: false,
        message: 'Ce dossier ne peut pas être annulé car il est déjà dans un statut final'
      });
    }

    // Mettre à jour le statut à "annule"
    dossier.statut = 'annule';
    dossier.notes = (dossier.notes || '') + `\n\n[Dossier annulé par le client le ${new Date().toLocaleDateString('fr-FR')}]`;
    await dossier.save();

    // Notifier les admins
    try {
      const admins = await User.find({
        role: { $in: ['admin', 'superadmin'] },
        isActive: true
      });

      for (const admin of admins) {
        await createNotification(
          admin._id.toString(),
          'dossier_cancelled',
          'Dossier annulé par le client',
          `${req.user.firstName} ${req.user.lastName} (${req.user.email}) a annulé le dossier "${dossier.titre}".`,
          `/admin/dossiers/${dossier._id}`,
          { 
            dossierId: dossier._id.toString(), 
            titre: dossier.titre,
            clientId: userId,
            clientEmail: req.user.email
          }
        );
      }
      console.log(`✅ Notifications envoyées à ${admins.length} administrateur(s) pour l'annulation du dossier`);
    } catch (notifError) {
      console.error('❌ Erreur lors de la notification des admins:', notifError);
    }

    // Logger l'action
    try {
      const Log = require('../models/Log');
      await Log.create({
        action: 'dossier_cancelled',
        user: userId,
        userEmail: req.user.email,
        description: `${req.user.email} a annulé le dossier "${dossier.titre}"`,
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
        userAgent: req.get('user-agent'),
        metadata: {
          dossierId: dossier._id.toString(),
          titre: dossier.titre
        }
      });
    } catch (logError) {
      console.error('Erreur lors de l\'enregistrement du log:', logError);
    }

    const dossierPopulated = await Dossier.findById(dossier._id)
      .populate('user', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName email');

    res.json({
      success: true,
      message: 'Dossier annulé avec succès',
      dossier: dossierPopulated
    });
  } catch (error) {
    console.error('Erreur lors de l\'annulation du dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   DELETE /api/user/dossiers/:id
// @desc    Supprimer un dossier
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const dossier = await Dossier.findById(req.params.id);

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Logger l'action
    try {
      const Log = require('../models/Log');
      await Log.create({
        action: 'dossier_deleted',
        user: req.user.id,
        userEmail: req.user.email,
        description: `${req.user.email} a supprimé le dossier "${dossier.titre}"`,
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
        userAgent: req.get('user-agent'),
        metadata: {
          dossierId: dossier._id.toString(),
          titre: dossier.titre
        }
      });
    } catch (logError) {
      console.error('Erreur lors de l\'enregistrement du log:', logError);
    }

    // Créer une notification pour l'utilisateur du dossier avant suppression
    if (dossier.user) {
      const userId = dossier.user._id ? dossier.user._id.toString() : dossier.user.toString();
      await createNotification(
        userId,
        'dossier_deleted',
        'Dossier supprimé',
        `Votre dossier "${dossier.titre}" a été supprimé par l'administrateur.`,
        `/client/dossiers`,
        { dossierId: dossier._id.toString(), titre: dossier.titre }
      );
    }

    await Dossier.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Dossier supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// ============================================
// ROUTES DE COLLABORATION
// ============================================

// @route   POST /api/user/dossiers/:id/open
// @desc    Ouvrir un dossier (devenir collaborateur actif)
// @access  Private (Admin/SuperAdmin ou membre de l'équipe)
router.post('/:id/open', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const dossierId = req.params.id;
    const userId = getEffectiveUserId(req); // Utilise l'ID impersonné si en impersonation
    const userRole = req.user.role;

    const dossier = await Dossier.findById(dossierId)
      .populate('teamMembers', 'firstName lastName email role')
      .populate('teamLeader', 'firstName lastName email role')
      .populate('activeCollaborators.user', 'firstName lastName email role');

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Vérifier si le dossier est clôturé ou annulé
    const statutsFinaux = ['annule', 'decision_favorable', 'decision_defavorable', 'rejet', 'gain_cause'];
    const isDossierClosed = statutsFinaux.includes(dossier.statut);

    // SuperAdmin peut toujours ouvrir même si clôturé
    if (isDossierClosed && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Ce dossier est clôturé ou annulé. La collaboration n\'est plus possible.',
        dossierClosed: true
      });
    }

    // Vérifier que l'utilisateur est membre de l'équipe ou superadmin
    const isTeamMember = dossier.teamMembers.some(member => 
      (member._id || member).toString() === userId.toString()
    );
    const isSuperAdmin = userRole === 'superadmin';

    if (!isTeamMember && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez être membre de l\'équipe pour collaborer sur ce dossier'
      });
    }

    // Vérifier si l'utilisateur est déjà collaborateur actif
    const existingCollaborator = dossier.activeCollaborators.find(collab => 
      (collab.user._id || collab.user).toString() === userId.toString()
    );

    if (existingCollaborator) {
      // Mettre à jour la dernière activité
      existingCollaborator.lastActivity = new Date();
      await dossier.save();
    } else {
      // Ajouter comme collaborateur actif
      dossier.activeCollaborators.push({
        user: userId,
        joinedAt: new Date(),
        lastActivity: new Date()
      });
      await dossier.save();

      // Notifier les autres collaborateurs
      const otherCollaborators = dossier.activeCollaborators
        .filter(collab => (collab.user._id || collab.user).toString() !== userId.toString())
        .map(collab => collab.user._id || collab.user);

      const currentUser = await User.findById(userId);
      const dossierTitre = dossier.titre || `Dossier ${dossier.numero || dossier._id}`;

      for (const collaboratorId of otherCollaborators) {
        await createNotification(
          collaboratorId,
          'dossier_collaborator_active',
          'Collaborateur actif sur le dossier',
          `L'administrateur ${currentUser.firstName} ${currentUser.lastName} est actuellement collaborateur actif sur le dossier "${dossierTitre}".`,
          `/admin/dossiers/${dossier._id}`,
          {
            dossierId: dossier._id.toString(),
            titre: dossierTitre,
            activeCollaboratorId: userId.toString(),
            activeCollaboratorName: `${currentUser.firstName} ${currentUser.lastName}`
          }
        );
      }

      // Notifier aussi les autres membres de l'équipe qui ne sont pas encore collaborateurs actifs
      const teamMemberIds = dossier.teamMembers
        .map(member => (member._id || member).toString())
        .filter(id => id !== userId.toString() && !otherCollaborators.some(collabId => collabId.toString() === id));

      for (const memberId of teamMemberIds) {
        await createNotification(
          memberId,
          'dossier_collaborator_active',
          'Collaborateur actif sur le dossier',
          `L'administrateur ${currentUser.firstName} ${currentUser.lastName} est actuellement collaborateur actif sur le dossier "${dossierTitre}".`,
          `/admin/dossiers/${dossier._id}`,
          {
            dossierId: dossier._id.toString(),
            titre: dossierTitre,
            activeCollaboratorId: userId.toString(),
            activeCollaboratorName: `${currentUser.firstName} ${currentUser.lastName}`
          }
        );
      }

      console.log(`✅ ${currentUser.firstName} ${currentUser.lastName} est maintenant collaborateur actif sur le dossier ${dossier._id}`);
    }

    const updatedDossier = await Dossier.findById(dossierId)
      .populate('teamMembers', 'firstName lastName email role')
      .populate('teamLeader', 'firstName lastName email role')
      .populate('activeCollaborators.user', 'firstName lastName email role');

    res.json({
      success: true,
      message: 'Dossier ouvert avec succès. Vous êtes maintenant collaborateur actif.',
      dossier: updatedDossier,
      isCollaborator: true
    });
  } catch (error) {
    console.error('Erreur lors de l\'ouverture du dossier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   POST /api/user/dossiers/:id/close-collaboration
// @desc    Fermer la collaboration (quitter le statut de collaborateur actif)
// @access  Private
router.post('/:id/close-collaboration', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const dossierId = req.params.id;
    const userId = getEffectiveUserId(req); // Utilise l'ID impersonné si en impersonation

    const dossier = await Dossier.findById(dossierId);

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Retirer l'utilisateur des collaborateurs actifs
    dossier.activeCollaborators = dossier.activeCollaborators.filter(collab => 
      (collab.user._id || collab.user).toString() !== userId.toString()
    );
    await dossier.save();

    res.json({
      success: true,
      message: 'Collaboration fermée avec succès',
      dossier
    });
  } catch (error) {
    console.error('Erreur lors de la fermeture de la collaboration:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/user/dossiers/:id/collaborators
// @desc    Obtenir la liste des collaborateurs actifs
// @access  Private
router.get('/:id/collaborators', protect, async (req, res) => {
  try {
    const dossierId = req.params.id;

    const dossier = await Dossier.findById(dossierId)
      .populate('activeCollaborators.user', 'firstName lastName email role')
      .populate('teamLeader', 'firstName lastName email role');

    if (!dossier) {
      return res.status(404).json({
        success: false,
        message: 'Dossier non trouvé'
      });
    }

    // Vérifier si le dossier est clôturé
    const statutsFinaux = ['annule', 'decision_favorable', 'decision_defavorable', 'rejet', 'gain_cause'];
    const isDossierClosed = statutsFinaux.includes(dossier.statut);

    res.json({
      success: true,
      collaborators: dossier.activeCollaborators || [],
      teamLeader: dossier.teamLeader || null,
      isDossierClosed,
      message: isDossierClosed ? 'Ce dossier est clôturé. La collaboration n\'est plus active.' : null
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des collaborateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

