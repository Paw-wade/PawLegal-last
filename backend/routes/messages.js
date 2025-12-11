const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const MessageInterne = require('../models/MessageInterne');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');

// Configuration de multer pour les pièces jointes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/messages');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max par fichier
  },
  fileFilter: (req, file, cb) => {
    // Accepter tous les types de fichiers
    cb(null, true);
  }
});

// Middleware d'authentification pour toutes les routes
router.use(protect);

// @route   GET /api/messages
// @desc    Récupérer les messages de l'utilisateur connecté
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'all' } = req.query; // 'all', 'received', 'sent', 'unread'

    let query = {};
    
    if (type === 'received') {
      query = { destinataires: userId };
    } else if (type === 'sent') {
      query = { expediteur: userId };
    } else if (type === 'unread') {
      query = { 
        destinataires: userId,
        'lu.user': { $ne: userId }
      };
    } else {
      // 'all' - messages reçus ou envoyés
      query = {
        $or: [
          { destinataires: userId },
          { expediteur: userId }
        ]
      };
    }

    // Exclure les messages archivés par l'utilisateur
    query['archive.user'] = { $ne: userId };

    const messages = await MessageInterne.find(query)
      .populate('expediteur', 'firstName lastName email role')
      .populate('destinataires', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Récupérer le nombre de messages non lus
// @access  Private
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await MessageInterne.countDocuments({
      destinataires: userId,
      'lu.user': { $ne: userId },
      'archive.user': { $ne: userId }
    });

    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Erreur lors du comptage des messages non lus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/messages/users
// @desc    Récupérer la liste des utilisateurs pour la sélection du destinataire
// @access  Private
router.get('/users', async (req, res) => {
  try {
    const userRole = req.user.role;
    
    let query = {};
    
    // Seuls les admins peuvent voir tous les utilisateurs
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent voir tous les utilisateurs.'
      });
    }

    // Pour les admins, retourner tous les utilisateurs actifs
    const users = await User.find({ isActive: { $ne: false } })
      .select('firstName lastName email role')
      .sort({ lastName: 1, firstName: 1 });

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   POST /api/messages
// @desc    Envoyer un message
// @access  Private
router.post(
  '/',
  upload.array('piecesJointes', 5), // Maximum 5 fichiers
  [
    body('sujet').trim().notEmpty().withMessage('Le sujet est requis'),
    body('contenu').trim().notEmpty().withMessage('Le contenu est requis'),
    body('destinataires').optional().isArray().withMessage('Les destinataires doivent être un tableau')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const { sujet, contenu, destinataires } = req.body;

      let destinatairesIds = [];

      // Si l'utilisateur est un client, envoyer automatiquement à tous les admins
      if (userRole === 'client') {
        const admins = await User.find({ 
          role: { $in: ['admin', 'superadmin'] },
          isActive: { $ne: false }
        }).select('_id');
        destinatairesIds = admins.map(admin => admin._id);
      } else if (userRole === 'admin' || userRole === 'superadmin') {
        // Les admins peuvent sélectionner des destinataires
        if (!destinataires || !Array.isArray(destinataires) || destinataires.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Veuillez sélectionner au moins un destinataire'
          });
        }
        destinatairesIds = destinataires;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à envoyer des messages'
        });
      }

      // Vérifier que tous les destinataires existent
      const destinatairesValides = await User.find({
        _id: { $in: destinatairesIds },
        isActive: { $ne: false }
      });

      if (destinatairesValides.length !== destinatairesIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Un ou plusieurs destinataires sont invalides'
        });
      }

      // Traiter les pièces jointes
      const piecesJointes = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          piecesJointes.push({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype
          });
        });
      }

      // Créer le message
      const nouveauMessage = await MessageInterne.create({
        expediteur: userId,
        destinataires: destinatairesIds,
        sujet: sujet.trim(),
        contenu: contenu.trim(),
        piecesJointes: piecesJointes
      });

      // Populate pour la réponse
      await nouveauMessage.populate('expediteur', 'firstName lastName email role');
      await nouveauMessage.populate('destinataires', 'firstName lastName email role');

      // Créer des notifications pour tous les destinataires
      for (const destinataireId of destinatairesIds) {
        try {
          await Notification.create({
            user: destinataireId,
            type: 'message_received',
            titre: 'Nouveau message',
            message: `${req.user.firstName} ${req.user.lastName} vous a envoyé un message : "${sujet}"`,
            lien: `/client/messages/${nouveauMessage._id}`,
            metadata: {
              messageId: nouveauMessage._id.toString(),
              expediteurId: userId.toString()
            }
          });
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification:', notifError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Message envoyé avec succès',
        data: nouveauMessage
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      
      // Supprimer les fichiers uploadés en cas d'erreur
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.error('Erreur lors de la suppression du fichier:', unlinkError);
            }
          }
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'envoi du message',
        error: error.message
      });
    }
  }
);

// @route   GET /api/messages/:id
// @desc    Récupérer un message spécifique
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    const message = await MessageInterne.findOne({
      _id: messageId,
      $or: [
        { expediteur: userId },
        { destinataires: userId }
      ],
      'archive.user': { $ne: userId }
    })
      .populate('expediteur', 'firstName lastName email role')
      .populate('destinataires', 'firstName lastName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Marquer comme lu si l'utilisateur est destinataire
    if (message.destinataires.some(d => d._id.toString() === userId.toString())) {
      const dejaLu = message.lu.some(l => l.user.toString() === userId.toString());
      if (!dejaLu) {
        message.lu.push({
          user: userId,
          luAt: new Date()
        });
        await message.save();
      }
    }

    res.json({
      success: true,
      message: message
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Marquer un message comme lu
// @access  Private
router.put('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    const message = await MessageInterne.findOne({
      _id: messageId,
      destinataires: userId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    const dejaLu = message.lu.some(l => l.user.toString() === userId.toString());
    if (!dejaLu) {
      message.lu.push({
        user: userId,
        luAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });
  } catch (error) {
    console.error('Erreur lors du marquage du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   PUT /api/messages/:id/archive
// @desc    Archiver un message
// @access  Private
router.put('/:id/archive', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    const message = await MessageInterne.findOne({
      _id: messageId,
      $or: [
        { expediteur: userId },
        { destinataires: userId }
      ]
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    const dejaArchive = message.archive.some(a => a.user.toString() === userId.toString());
    if (!dejaArchive) {
      message.archive.push({
        user: userId,
        archiveAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      message: 'Message archivé'
    });
  } catch (error) {
    console.error('Erreur lors de l\'archivage du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/messages/:id/download/:fileIndex
// @desc    Télécharger une pièce jointe
// @access  Private
router.get('/:id/download/:fileIndex', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;
    const fileIndex = parseInt(req.params.fileIndex);

    const message = await MessageInterne.findOne({
      _id: messageId,
      $or: [
        { expediteur: userId },
        { destinataires: userId }
      ]
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    if (!message.piecesJointes || message.piecesJointes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune pièce jointe trouvée'
      });
    }

    if (fileIndex < 0 || fileIndex >= message.piecesJointes.length) {
      return res.status(400).json({
        success: false,
        message: 'Index de fichier invalide'
      });
    }

    const pieceJointe = message.piecesJointes[fileIndex];
    const filePath = pieceJointe.path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    res.download(filePath, pieceJointe.originalName, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
        res.status(500).json({
          success: false,
          message: 'Erreur lors du téléchargement'
        });
      }
    });
  } catch (error) {
    console.error('Erreur lors du téléchargement de la pièce jointe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

