const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const MessageInterne = require('../models/MessageInterne');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { sendNotificationSMS, formatPhoneNumber } = require('../sendSMS');

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

// IMPORTANT: Les routes spécifiques (comme /unread-count, /users) doivent être définies AVANT les routes paramétrées (/:id)
// pour éviter que Express ne les intercepte avec le paramètre :id

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
// @access  Private (tous les utilisateurs authentifiés)
router.get('/users', async (req, res) => {
  try {
    // Tous les utilisateurs authentifiés peuvent voir la liste des utilisateurs actifs
    const users = await User.find({ isActive: { $ne: false } })
      .select('firstName lastName email role')
      .sort({ role: 1, lastName: 1, firstName: 1 }); // Trier par rôle puis par nom

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

// @route   GET /api/messages
// @desc    Récupérer les messages de l'utilisateur connecté
// @access  Private
router.get('/', async (req, res) => {
  try {
    console.log('📨 GET /api/messages - Requête reçue:', {
      user: req.user?.email,
      userId: req.user?.id,
      type: req.query.type,
      path: req.path
    });
    
    const userId = req.user.id;
    const { type = 'all' } = req.query; // 'all', 'received', 'sent', 'unread'

    let query = {};
    
    if (type === 'received') {
      // Messages reçus (destinataire principal ou en copie)
      query = {
        $or: [
          { destinataires: userId },
          { copie: userId }
        ]
      };
    } else if (type === 'sent') {
      query = { expediteur: userId };
    } else if (type === 'unread') {
      // Messages non lus (destinataire principal ou en copie)
      query = { 
        $or: [
          { destinataires: userId },
          { copie: userId }
        ],
        'lu.user': { $ne: userId }
      };
    } else {
      // 'all' - messages reçus (destinataire ou copie) ou envoyés
      query = {
        $or: [
          { destinataires: userId },
          { copie: userId },
          { expediteur: userId }
        ]
      };
    }

    // Exclure les messages archivés par l'utilisateur
    query['archive.user'] = { $ne: userId };

    const messages = await MessageInterne.find(query)
      .populate('expediteur', 'firstName lastName email role')
      .populate('destinataires', 'firstName lastName email role')
      .populate('copie', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(100);

    console.log('✅ Messages trouvés:', messages.length);

    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des messages:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      console.log('📨 POST /api/messages - Requête reçue:', {
        user: req.user?.email,
        userId: req.user?.id,
        body: req.body,
        files: req.files ? req.files.length : 0
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Erreurs de validation:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation',
          errors: errors.array()
        });
      }

      const mongoose = require('mongoose');
      const userId = req.user.id;
      const userRole = req.user.role;
      const { sujet, contenu, destinataire, copie } = req.body; // destinataire (singulier) et copie (tableau)

      // Convertir userId en ObjectId si nécessaire
      const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

      console.log('📨 Données reçues:', { 
        sujet, 
        contenu, 
        destinataire, 
        copie, 
        userRole,
        userId: userIdObj.toString() 
      });

      let destinatairesIds = [];
      let copieIds = [];
      let typeMessage = 'user_to_admins';

      // CAS 1: Utilisateur (client) → Tous les administrateurs
      if (userRole === 'client') {
        console.log('👤 Message d\'un utilisateur → Tous les administrateurs');
        
        // Récupérer tous les administrateurs actifs
        const admins = await User.find({
          role: { $in: ['admin', 'superadmin'] },
          isActive: { $ne: false }
        });

        if (admins.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Aucun administrateur disponible'
          });
        }

        destinatairesIds = admins.map(admin => admin._id);
        typeMessage = 'user_to_admins';
        console.log(`✅ Message adressé à ${destinatairesIds.length} administrateur(s)`);
      }
      // CAS 2: Administrateur → Un destinataire (utilisateur ou admin) + copie optionnelle
      else if (userRole === 'admin' || userRole === 'superadmin') {
        console.log('👨‍💼 Message d\'un administrateur');
        
        // Vérifier qu'un destinataire est fourni
        if (!destinataire) {
          return res.status(400).json({
            success: false,
            message: 'Veuillez sélectionner un destinataire'
          });
        }

        // Convertir le destinataire en ObjectId
        let destinataireId;
        try {
          if (typeof destinataire === 'string') {
            if (!mongoose.Types.ObjectId.isValid(destinataire)) {
              throw new Error(`ID de destinataire invalide: ${destinataire}`);
            }
            destinataireId = new mongoose.Types.ObjectId(destinataire);
          } else {
            destinataireId = destinataire;
          }
        } catch (idError) {
          console.error('❌ Erreur lors de la conversion de l\'ID destinataire:', idError);
          return res.status(400).json({
            success: false,
            message: idError.message || 'Format d\'ID de destinataire invalide'
          });
        }

        // Vérifier que l'admin ne s'envoie pas un message à lui-même
        if (destinataireId.toString() === userIdObj.toString()) {
          return res.status(400).json({
            success: false,
            message: 'Vous ne pouvez pas vous envoyer un message à vous-même'
          });
        }

        // Vérifier que le destinataire existe
        const destinataireUser = await User.findOne({
          _id: destinataireId,
          isActive: { $ne: false }
        });

        if (!destinataireUser) {
          return res.status(400).json({
            success: false,
            message: 'Destinataire non trouvé ou inactif'
          });
        }

        destinatairesIds = [destinataireId];

        // Déterminer le type de message
        if (destinataireUser.role === 'client') {
          typeMessage = 'admin_to_user';
        } else if (destinataireUser.role === 'admin' || destinataireUser.role === 'superadmin') {
          typeMessage = 'admin_to_admin';
        }

        // Traiter la copie (CC) si fournie
        if (copie && Array.isArray(copie) && copie.length > 0) {
          try {
            copieIds = copie
              .filter(id => id && id.toString() !== userIdObj.toString() && id.toString() !== destinataireId.toString()) // Exclure l'expéditeur et le destinataire principal
              .map(id => {
                if (typeof id === 'string') {
                  if (!mongoose.Types.ObjectId.isValid(id)) {
                    throw new Error(`ID de copie invalide: ${id}`);
                  }
                  return new mongoose.Types.ObjectId(id);
                }
                return id;
              });

            // Vérifier que tous les destinataires en copie existent
            if (copieIds.length > 0) {
              const copieValides = await User.find({
                _id: { $in: copieIds },
                isActive: { $ne: false }
              });

              if (copieValides.length !== copieIds.length) {
                return res.status(400).json({
                  success: false,
                  message: 'Un ou plusieurs destinataires en copie sont invalides'
                });
              }
            }
          } catch (copieError) {
            console.error('❌ Erreur lors du traitement de la copie:', copieError);
            return res.status(400).json({
              success: false,
              message: copieError.message || 'Format d\'ID de copie invalide'
            });
          }
        }

        console.log(`✅ Message adressé à ${destinatairesIds.length} destinataire(s) principal(aux) et ${copieIds.length} en copie`);
      } else {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission d\'envoyer des messages'
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
            mimetype: file.mimetype,
            uploadedAt: new Date()
          });
        });
      }

      // Créer le message
      console.log('📝 Création du message...');
      const messageData = {
        expediteur: userIdObj,
        destinataires: destinatairesIds,
        sujet: sujet.trim(),
        contenu: contenu.trim(),
        typeMessage: typeMessage
      };
      
      // Ajouter la copie si elle existe
      if (copieIds.length > 0) {
        messageData.copie = copieIds;
      }
      
      // Ajouter les pièces jointes seulement si elles existent
      if (piecesJointes.length > 0) {
        messageData.piecesJointes = piecesJointes;
      }
      
      console.log('📝 Données du message:', {
        expediteur: messageData.expediteur,
        destinataires: messageData.destinataires.map(d => d.toString()),
        copie: messageData.copie ? messageData.copie.map(c => c.toString()) : [],
        typeMessage: messageData.typeMessage,
        sujet: messageData.sujet,
        contenuLength: messageData.contenu.length,
        piecesJointesCount: piecesJointes.length
      });
      
      const nouveauMessage = await MessageInterne.create(messageData);
      console.log('✅ Message créé avec succès:', nouveauMessage._id);

      // Populate pour la réponse
      await nouveauMessage.populate('expediteur', 'firstName lastName email role');
      await nouveauMessage.populate('destinataires', 'firstName lastName email role');

      // Créer des notifications selon le type de message
      console.log('📧 Création des notifications...');
      const expediteurName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

      if (typeMessage === 'user_to_admins') {
        // Notification pour tous les administrateurs
        for (const adminId of destinatairesIds) {
          try {
            await Notification.create({
              user: adminId.toString(),
              type: 'message_received',
              titre: 'Nouveau message utilisateur',
              message: `Un utilisateur vous a envoyé un message : "${sujet}"`,
              lien: `/admin/messages/${nouveauMessage._id}`,
              metadata: {
                messageId: nouveauMessage._id.toString(),
                expediteurId: userIdObj.toString(),
                typeMessage: 'user_to_admins'
              }
            });
            console.log(`✅ Notification créée pour admin: ${adminId.toString()}`);
          } catch (notifError) {
            console.error('❌ Erreur lors de la création de la notification:', notifError);
          }
        }
      } else if (typeMessage === 'admin_to_user' || typeMessage === 'admin_to_admin') {
        // Notification pour le destinataire principal
        const destinatairePrincipal = await User.findById(destinatairesIds[0]);
        
        if (destinatairePrincipal) {
          try {
            await Notification.create({
              user: destinatairesIds[0].toString(),
              type: 'message_received',
              titre: 'Nouveau message',
              message: `${expediteurName} vous a envoyé un message : "${sujet}"`,
              lien: destinatairePrincipal.role === 'client' 
                ? `/client/messages/${nouveauMessage._id}` 
                : `/admin/messages/${nouveauMessage._id}`,
              metadata: {
                messageId: nouveauMessage._id.toString(),
                expediteurId: userIdObj.toString(),
                typeMessage: typeMessage
              }
            });
            console.log(`✅ Notification créée pour destinataire principal: ${destinatairesIds[0].toString()}`);

            // Envoyer un SMS si le destinataire est un utilisateur (client)
            if (typeMessage === 'admin_to_user' && destinatairePrincipal.phone) {
              try {
                const formattedPhone = formatPhoneNumber(destinatairePrincipal.phone);
                if (formattedPhone) {
                  await sendNotificationSMS(formattedPhone, 'message_received', {
                    message: `Vous avez reçu un nouveau message de ${expediteurName}. Connectez-vous pour le consulter.`,
                    messageId: nouveauMessage._id.toString()
                  });
                  console.log(`✅ SMS envoyé à ${formattedPhone}`);
                }
              } catch (smsError) {
                console.error('⚠️ Erreur lors de l\'envoi du SMS:', smsError);
              }
            }
          } catch (notifError) {
            console.error('❌ Erreur lors de la création de la notification:', notifError);
          }
        }

        // Notifications pour les destinataires en copie
        for (const copieId of copieIds) {
          try {
            const copieUser = await User.findById(copieId);
            if (copieUser) {
              await Notification.create({
                user: copieId.toString(),
                type: 'message_received',
                titre: 'Message en copie',
                message: `${expediteurName} vous a mis en copie d'un message : "${sujet}"`,
                lien: copieUser.role === 'client' 
                  ? `/client/messages/${nouveauMessage._id}` 
                  : `/admin/messages/${nouveauMessage._id}`,
                metadata: {
                  messageId: nouveauMessage._id.toString(),
                  expediteurId: userIdObj.toString(),
                  typeMessage: typeMessage,
                  isCopie: true
                }
              });
              console.log(`✅ Notification créée pour copie: ${copieId.toString()}`);
            }
          } catch (notifError) {
            console.error('❌ Erreur lors de la création de la notification copie:', notifError);
          }
        }

        // Notification pour tous les autres administrateurs (sauf l'expéditeur)
        try {
          const autresAdmins = await User.find({
            role: { $in: ['admin', 'superadmin'] },
            _id: { $ne: userIdObj },
            isActive: { $ne: false }
          });

          const destinataireInfo = await User.findById(destinatairesIds[0]);
          const destinataireLabel = destinataireInfo 
            ? `${destinataireInfo.firstName} ${destinataireInfo.lastName}`.trim() || destinataireInfo.email
            : 'Destinataire inconnu';

          for (const admin of autresAdmins) {
            // Ne pas notifier si l'admin est déjà destinataire ou en copie
            if (destinatairesIds.some(id => id.toString() === admin._id.toString()) ||
                copieIds.some(id => id.toString() === admin._id.toString())) {
              continue;
            }

            await Notification.create({
              user: admin._id.toString(),
              type: 'message_sent',
              titre: 'Message envoyé par un administrateur',
              message: `${expediteurName} a envoyé un message à ${destinataireLabel} : "${sujet}"`,
              lien: `/admin/messages/${nouveauMessage._id}`,
              metadata: {
                messageId: nouveauMessage._id.toString(),
                expediteurId: userIdObj.toString(),
                destinataireId: destinatairesIds[0].toString(),
                typeMessage: typeMessage
              }
            });
            console.log(`✅ Notification créée pour admin observateur: ${admin._id.toString()}`);
          }
        } catch (notifError) {
          console.error('❌ Erreur lors de la création des notifications pour les autres admins:', notifError);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Message envoyé avec succès',
        data: nouveauMessage
      });
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      console.error('❌ Stack trace:', error.stack);
      console.error('❌ Détails de l\'erreur:', {
        name: error.name,
        message: error.message,
        code: error.code,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue
      });
      
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
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        details: process.env.NODE_ENV === 'development' ? {
          name: error.name,
          code: error.code,
          keyPattern: error.keyPattern,
          keyValue: error.keyValue
        } : undefined
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
    const mongoose = require('mongoose');
    const userId = req.user.id;
    const userRole = req.user.role;
    const messageId = req.params.id;

    const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

    // Récupérer le message (peut être destinataire principal ou en copie)
    const message = await MessageInterne.findOne({
      _id: messageId,
      $or: [
        { destinataires: userIdObj },
        { copie: userIdObj }
      ]
    })
      .populate('expediteur', 'firstName lastName email role')
      .populate('destinataires', 'firstName lastName email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    const dejaLu = message.lu.some(l => l.user && l.user.toString() === userIdObj.toString());
    
    if (!dejaLu) {
      message.lu.push({
        user: userIdObj,
        luAt: new Date()
      });
      await message.save();

      // Si c'est un message d'utilisateur vers admins et qu'un admin le lit
      // Notifier tous les autres admins
      if (message.typeMessage === 'user_to_admins' && (userRole === 'admin' || userRole === 'superadmin')) {
        try {
          const adminQuiALu = req.user;
          const adminName = `${adminQuiALu.firstName || ''} ${adminQuiALu.lastName || ''}`.trim() || adminQuiALu.email;
          
          const expediteurUser = message.expediteur;
          const expediteurName = expediteurUser 
            ? `${expediteurUser.firstName || ''} ${expediteurUser.lastName || ''}`.trim() || expediteurUser.email
            : 'Utilisateur inconnu';

          // Récupérer tous les autres administrateurs
          const autresAdmins = await User.find({
            role: { $in: ['admin', 'superadmin'] },
            _id: { $ne: userIdObj },
            isActive: { $ne: false }
          });

          // Notifier tous les autres admins
          for (const admin of autresAdmins) {
            // Vérifier que l'admin n'a pas déjà lu le message
            const adminALu = message.lu.some(l => l.user && l.user.toString() === admin._id.toString());
            if (!adminALu) {
              await Notification.create({
                user: admin._id.toString(),
                type: 'message_read',
                titre: 'Message lu par un administrateur',
                message: `Le message de ${expediteurName} a été lu par ${adminName}`,
                lien: `/admin/messages/${messageId}`,
                metadata: {
                  messageId: messageId,
                  expediteurId: message.expediteur._id ? message.expediteur._id.toString() : message.expediteur.toString(),
                  luParId: userIdObj.toString(),
                  luParName: adminName
                }
              });
              console.log(`✅ Notification de lecture envoyée à admin: ${admin._id.toString()}`);
            }
          }
        } catch (notifError) {
          console.error('❌ Erreur lors de la création des notifications de lecture:', notifError);
          // Ne pas bloquer le marquage comme lu si la notification échoue
        }
      }
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

// @route   DELETE /api/messages/:id
// @desc    Supprimer un message (seul l'expéditeur peut supprimer)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;

    const message = await MessageInterne.findOne({
      _id: messageId,
      expediteur: userId // Seul l'expéditeur peut supprimer
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé ou vous n\'avez pas l\'autorisation de le supprimer'
      });
    }

    // Supprimer les fichiers associés
    if (message.piecesJointes && message.piecesJointes.length > 0) {
      message.piecesJointes.forEach((pieceJointe) => {
        if (fs.existsSync(pieceJointe.path)) {
          try {
            fs.unlinkSync(pieceJointe.path);
          } catch (unlinkError) {
            console.error('Erreur lors de la suppression du fichier:', unlinkError);
          }
        }
      });
    }

    await MessageInterne.findByIdAndDelete(messageId);

    res.json({
      success: true,
      message: 'Message supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du message:', error);
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

