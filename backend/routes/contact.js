const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();

// Configuration du stockage Multer pour les documents de contact
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/contact');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

// Filtre pour accepter seulement certains types de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Formats acceptés : PDF, DOC, DOCX, JPG, PNG'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max par fichier
  },
  fileFilter: fileFilter
});

// @route   POST /api/contact
// @desc    Envoyer un message de contact
// @access  Public
router.post(
  '/',
  upload.array('documents', 5), // Maximum 5 fichiers
  [
    body('name').trim().notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
    body('subject').trim().notEmpty().withMessage('Le sujet est requis'),
    body('message').trim().notEmpty().withMessage('Le message est requis'),
    body('phone').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Supprimer les fichiers uploadés en cas d'erreur de validation
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array()
        });
      }

      const { name, email, phone, subject, message } = req.body;

      // Préparer les informations des documents
      const documents = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          documents.push({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype
          });
        });
      }

      // Sauvegarder le message dans la base de données
      const newMessage = await Message.create({
        name,
        email,
        phone: phone || '',
        subject,
        message,
        documents
      });

      console.log('✅ Nouveau message de contact enregistré:', newMessage._id);

      // Notifier tous les admins
      try {
        const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
        
        for (const admin of admins) {
          await Notification.create({
            user: admin._id,
            type: 'message_received',
            titre: 'Nouveau message de contact',
            message: `Nouveau message de ${name} (${email}) : "${subject}"`,
            lien: `/admin/messages/${newMessage._id}`,
            metadata: {
              messageId: newMessage._id.toString(),
              email: email,
              subject: subject
            }
          });
        }
        console.log(`✅ Notifications envoyées à ${admins.length} admin(s)`);
      } catch (notifError) {
        console.error('⚠️ Erreur lors de l\'envoi des notifications:', notifError);
        // Ne pas bloquer l'envoi du message si les notifications échouent
      }

      res.json({
        success: true,
        message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
        data: {
          id: newMessage._id
        }
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

// @route   GET /api/contact
// @desc    Récupérer tous les messages (admin seulement)
// @access  Private/Admin
router.get(
  '/',
  require('../middleware/auth').protect,
  require('../middleware/auth').authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { lu, repondu, limit = 50, page = 1 } = req.query;
      
      const query = {};
      if (lu !== undefined) query.lu = lu === 'true';
      if (repondu !== undefined) query.repondu = repondu === 'true';

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Message.countDocuments(query);

      res.json({
        success: true,
        count: messages.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        messages
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   GET /api/contact/:id
// @desc    Récupérer un message spécifique (admin seulement)
// @access  Private/Admin
router.get(
  '/:id',
  require('../middleware/auth').protect,
  require('../middleware/auth').authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const message = await Message.findById(req.params.id);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }

      // Marquer comme lu
      if (!message.lu) {
        message.lu = true;
        await message.save();
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
  }
);

// @route   PATCH /api/contact/:id
// @desc    Marquer un message comme lu ou répondre (admin seulement)
// @access  Private/Admin
router.patch(
  '/:id',
  require('../middleware/auth').protect,
  require('../middleware/auth').authorize('admin', 'superadmin'),
  [
    body('lu').optional().isBoolean(),
    body('repondu').optional().isBoolean(),
    body('reponse').optional().trim()
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

      const message = await Message.findById(req.params.id);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }

      if (req.body.lu !== undefined) message.lu = req.body.lu;
      if (req.body.repondu !== undefined) message.repondu = req.body.repondu;
      if (req.body.reponse !== undefined) message.reponse = req.body.reponse;

      await message.save();

      res.json({
        success: true,
        message: 'Message mis à jour avec succès',
        data: message
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du message:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   GET /api/contact/:id/document/:docId
// @desc    Télécharger un document joint à un message (admin seulement)
// @access  Private/Admin
router.get(
  '/:id/document/:docId',
  require('../middleware/auth').protect,
  require('../middleware/auth').authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const message = await Message.findById(req.params.id);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message non trouvé'
        });
      }

      const document = message.documents.id(req.params.docId);

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document non trouvé'
        });
      }

      if (!fs.existsSync(document.path)) {
        return res.status(404).json({
          success: false,
          message: 'Fichier non trouvé sur le serveur'
        });
      }

      res.download(document.path, document.originalName);
    } catch (error) {
      console.error('Erreur lors du téléchargement du document:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

module.exports = router;


