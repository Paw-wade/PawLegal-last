const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const RendezVous = require('../models/RendezVous');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/appointments
// @desc    Créer un rendez-vous (public ou authentifié)
// @access  Public ou Private
router.post(
  '/',
  [
    body('nom').trim().notEmpty().withMessage('Le nom est requis'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis'),
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('telephone').trim().notEmpty().withMessage('Le téléphone est requis'),
    body('date').notEmpty().withMessage('La date est requise'),
    body('heure').trim().notEmpty().withMessage('L\'heure est requise'),
    body('motif').trim().notEmpty().withMessage('Le motif est requis'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('La description ne peut pas dépasser 500 caractères')
  ],
  async (req, res) => {
    try {
      console.log('📅 Requête de création de rendez-vous reçue:', {
        method: req.method,
        path: req.path,
        body: req.body
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Erreurs de validation:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array()
        });
      }

      const { nom, prenom, email, telephone, date, heure, motif, description } = req.body;

      // Vérifier si un utilisateur est connecté (optionnel)
      let userId = null;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
          const jwt = require('jsonwebtoken');
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
          const User = require('../models/User');
          const user = await User.findById(decoded.id);
          if (user) userId = user._id;
        } catch (error) {
          // Si le token est invalide, on continue sans utilisateur (rendez-vous public)
        }
      }

      // Vérifier si le créneau est fermé
      const Creneau = require('../models/Creneau');
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      
      const creneauFerme = await Creneau.findOne({
        date: { $gte: targetDate, $lte: endDate },
        heure: heure,
        ferme: true
      });

      if (creneauFerme) {
        return res.status(400).json({
          success: false,
          message: 'Ce créneau est fermé. Veuillez choisir un autre horaire.'
        });
      }

      // Vérifier les conflits de rendez-vous (même date et heure)
      const existingAppointment = await RendezVous.findOne({
        date: new Date(date),
        heure: heure,
        statut: { $in: ['en_attente', 'confirme'] }
      });

      if (existingAppointment) {
        return res.status(400).json({
          success: false,
          message: 'Ce créneau est déjà réservé. Veuillez choisir un autre horaire.'
        });
      }

      const rendezVous = await RendezVous.create({
        user: userId,
        nom,
        prenom,
        email,
        telephone,
        date: new Date(date),
        heure,
        motif,
        description: description || ''
      });

      console.log('✅ Rendez-vous créé avec succès:', rendezVous._id);

      res.status(201).json({
        success: true,
        message: 'Votre demande de rendez-vous a été enregistrée. Nous vous confirmerons rapidement par email.',
        data: rendezVous
      });
    } catch (error) {
      console.error('Erreur lors de la création du rendez-vous:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création du rendez-vous'
      });
    }
  }
);

// Note: La route POST / est publique, les autres routes nécessitent une authentification

// @route   GET /api/appointments
// @desc    Récupérer les rendez-vous de l'utilisateur connecté
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const rendezVous = await RendezVous.find({ user: req.user.id })
      .sort({ date: -1, heure: -1 });

    res.json({
      success: true,
      data: rendezVous
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous'
    });
  }
});

// @route   GET /api/appointments/admin
// @desc    Récupérer tous les rendez-vous (admin)
// @access  Private (Admin)
router.get('/admin', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { statut, date } = req.query;
    let query = {};

    if (statut) {
      query.statut = statut;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const rendezVous = await RendezVous.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ date: 1, heure: 1 });

    res.json({
      success: true,
      data: rendezVous
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rendez-vous:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des rendez-vous'
    });
  }
});

// @route   PATCH /api/appointments/:id/cancel
// @desc    Annuler un rendez-vous (client propriétaire)
// @access  Private
// IMPORTANT: Cette route doit être définie AVANT la route /:id pour éviter les conflits
router.patch(
  '/:id/cancel',
  protect,
  async (req, res) => {
    try {
      console.log('📅 Route d\'annulation appelée:', {
        method: req.method,
        originalUrl: req.originalUrl,
        path: req.path,
        params: req.params,
        userId: req.user?.id,
        userEmail: req.user?.email
      });

      const rendezVous = await RendezVous.findById(req.params.id);

      if (!rendezVous) {
        return res.status(404).json({
          success: false,
          message: 'Rendez-vous non trouvé'
        });
      }

      // Vérifier que l'utilisateur est le propriétaire du rendez-vous
      if (rendezVous.user && rendezVous.user.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas l\'autorisation d\'annuler ce rendez-vous'
        });
      }

      // Vérifier aussi par email si pas d'utilisateur connecté mais rendez-vous créé avec email
      if (!rendezVous.user && rendezVous.email !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas l\'autorisation d\'annuler ce rendez-vous'
        });
      }

      // Ne pas permettre l'annulation si déjà annulé ou terminé
      if (rendezVous.statut === 'annule') {
        return res.status(400).json({
          success: false,
          message: 'Ce rendez-vous est déjà annulé'
        });
      }

      if (rendezVous.statut === 'termine') {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'annuler un rendez-vous déjà terminé'
        });
      }

      const oldStatut = rendezVous.statut;
      rendezVous.statut = 'annule';
      await rendezVous.save();
      await rendezVous.populate('user', 'firstName lastName email');

      // Créer une notification pour l'utilisateur
      if (rendezVous.user) {
        try {
          const Notification = require('../models/Notification');
          await Notification.create({
            user: rendezVous.user._id || rendezVous.user,
            type: 'appointment_cancelled',
            titre: 'Rendez-vous annulé',
            message: `Vous avez annulé votre rendez-vous du ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure}.`,
            lien: '/client/rendez-vous',
            metadata: {
              appointmentId: rendezVous._id.toString(),
              date: rendezVous.date,
              heure: rendezVous.heure,
              oldStatut,
              newStatut: 'annule'
            }
          });
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification:', notifError);
        }
      }

      res.json({
        success: true,
        message: 'Rendez-vous annulé avec succès',
        data: rendezVous
      });
    } catch (error) {
      console.error('Erreur lors de l\'annulation du rendez-vous:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'annulation du rendez-vous'
      });
    }
  }
);

// @route   PATCH /api/appointments/:id
// @desc    Mettre à jour un rendez-vous (admin) - peut modifier statut, date, heure, motif, description, notes
// @access  Private (Admin)
router.patch(
  '/:id',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('statut').optional().isIn(['en_attente', 'confirme', 'annule', 'termine']).withMessage('Statut invalide'),
    body('date').optional().isISO8601().withMessage('Date invalide'),
    body('heure').optional().trim().notEmpty().withMessage('Heure invalide'),
    body('motif').optional().trim().isIn(['Consultation', 'Dossier administratif', 'Suivi de dossier', 'Autre']).withMessage('Motif invalide'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('La description ne peut pas dépasser 500 caractères'),
    body('notes').optional().trim()
  ],
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

      const { statut, date, heure, motif, description, notes } = req.body;
      const rendezVous = await RendezVous.findById(req.params.id);

      if (!rendezVous) {
        return res.status(404).json({
          success: false,
          message: 'Rendez-vous non trouvé'
        });
      }

      const oldStatut = rendezVous.statut;
      const oldDate = rendezVous.date;
      const oldHeure = rendezVous.heure;
      
      // Mettre à jour les champs fournis
      if (statut !== undefined) rendezVous.statut = statut;
      if (date !== undefined) rendezVous.date = new Date(date);
      if (heure !== undefined) rendezVous.heure = heure;
      if (motif !== undefined) rendezVous.motif = motif;
      if (description !== undefined) rendezVous.description = description;
      if (notes !== undefined) rendezVous.notes = notes;

      await rendezVous.save();
      await rendezVous.populate('user', 'firstName lastName email');

      // Créer une notification pour l'utilisateur si des modifications ont été apportées
      if (rendezVous.user) {
        try {
          const Notification = require('../models/Notification');
          let notificationType = 'appointment_updated';
          let notificationTitre = 'Rendez-vous modifié';
          let notificationMessage = '';
          let hasChanges = false;

          // Vérifier les changements
          if (statut && statut !== oldStatut) {
            hasChanges = true;
            if (statut === 'confirme' && oldStatut === 'en_attente') {
              notificationType = 'appointment_created';
              notificationTitre = 'Rendez-vous confirmé';
              notificationMessage = `Votre rendez-vous du ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure} a été confirmé.`;
            } else if (statut === 'annule') {
              notificationType = 'appointment_cancelled';
              notificationTitre = 'Rendez-vous annulé';
              notificationMessage = `Votre rendez-vous du ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure} a été annulé.`;
            } else {
              notificationMessage = `Le statut de votre rendez-vous a été modifié de "${oldStatut}" à "${statut}".`;
            }
          } else if (date && new Date(date).getTime() !== new Date(oldDate).getTime()) {
            hasChanges = true;
            notificationMessage = `Votre rendez-vous a été reprogrammé. Nouvelle date : ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure}.`;
          } else if (heure && heure !== oldHeure) {
            hasChanges = true;
            notificationMessage = `L'heure de votre rendez-vous a été modifiée. Nouvelle heure : ${rendezVous.heure} (date : ${new Date(rendezVous.date).toLocaleDateString('fr-FR')}).`;
          } else if (date && heure && (new Date(date).getTime() !== new Date(oldDate).getTime() || heure !== oldHeure)) {
            hasChanges = true;
            notificationMessage = `Votre rendez-vous a été reprogrammé. Nouvelle date et heure : ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure}.`;
          } else if (motif || description || notes) {
            hasChanges = true;
            notificationMessage = `Votre rendez-vous du ${new Date(rendezVous.date).toLocaleDateString('fr-FR')} à ${rendezVous.heure} a été modifié par l'administrateur.`;
          }

          if (hasChanges) {
            await Notification.create({
              user: rendezVous.user._id || rendezVous.user,
              type: notificationType,
              titre: notificationTitre,
              message: notificationMessage,
              lien: '/client/rendez-vous',
              metadata: {
                appointmentId: rendezVous._id.toString(),
                date: rendezVous.date,
                heure: rendezVous.heure,
                oldStatut,
                newStatut: statut || oldStatut,
                oldDate,
                newDate: date || oldDate,
                oldHeure,
                newHeure: heure || oldHeure
              }
            });
          }
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification:', notifError);
          // Ne pas bloquer la mise à jour si la notification échoue
        }
      }

      res.json({
        success: true,
        message: 'Rendez-vous mis à jour avec succès',
        data: rendezVous
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du rendez-vous:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la mise à jour du rendez-vous'
      });
    }
  }
);

module.exports = router;

