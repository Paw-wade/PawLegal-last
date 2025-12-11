const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');
const Log = require('../models/Log');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Configuration du stockage Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Générer un nom de fichier unique avec timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

// Filtre pour accepter seulement certains types de fichiers
const fileFilter = (req, file, cb) => {
  // Types de fichiers autorisés
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Types acceptés: PDF, images (JPG, PNG), Word, Excel'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB max
  },
  fileFilter: fileFilter
});

// Toutes les routes nécessitent une authentification
router.use(protect);

// @route   GET /api/user/documents
// @desc    Récupérer tous les documents de l'utilisateur connecté
// @access  Private (tous les rôles authentifiés)
router.get('/', async (req, res) => {
  try {
    console.log('📄 Récupération des documents pour l\'utilisateur:', req.user.id, 'Rôle:', req.user.role);
    
    const documents = await Document.find({ user: req.user.id })
      .sort({ createdAt: -1 });

    console.log('✅ Documents trouvés:', documents.length, 'pour l\'utilisateur:', req.user.email);

    res.json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des documents:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/user/documents/admin
// @desc    Récupérer tous les documents (Admin seulement)
// @access  Private/Admin
router.get('/admin', authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const documents = await Document.find()
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des documents (admin):', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   POST /api/user/documents
// @desc    Téléverser un document
// @access  Private
router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléversé'
      });
    }

    const { nom, description, categorie } = req.body;

    const document = await Document.create({
      user: req.user.id,
      nom: nom || req.file.originalname,
      nomFichier: req.file.filename,
      cheminFichier: req.file.path,
      typeMime: req.file.mimetype,
      taille: req.file.size,
      description: description || '',
      categorie: categorie || 'autre'
    });

    // Logger l'action
    try {
      await Log.create({
        user: req.user.id,
        userEmail: req.user.email,
        action: 'document_uploaded',
        description: `${req.user.email} a téléversé le document "${document.nom}"`,
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
        userAgent: req.get('user-agent'),
        metadata: {
          documentId: document._id.toString(),
          nom: document.nom,
          taille: document.taille
        }
      });
    } catch (logError) {
      console.error('Erreur lors de l\'enregistrement du log:', logError);
    }

    res.status(201).json({
      success: true,
      message: 'Document téléversé avec succès',
      document
    });
  } catch (error) {
    console.error('Erreur lors du téléversement du document:', error);
    
    // Supprimer le fichier si le document n'a pas pu être créé
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erreur serveur lors du téléversement',
      error: error.message
    });
  }
});

// @route   GET /api/user/documents/:id/preview
// @desc    Prévisualiser un document (retourne le fichier avec headers pour affichage)
// @access  Private (peut accepter token en query param pour iframe)
router.get('/:id/preview', async (req, res) => {
  try {
    console.log('📄 Prévisualisation demandée pour le document:', req.params.id);
    console.log('📄 Headers Authorization:', req.headers.authorization ? 'Présent' : 'Absent');
    console.log('📄 Query token:', req.query.token ? 'Présent' : 'Absent');
    
    // Vérifier l'authentification manuellement pour permettre le token en query param
    const jwt = require('jsonwebtoken');
    let token;
    
    // Priorité 1: Token dans les headers Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('✅ Token récupéré depuis les headers');
    } 
    // Priorité 2: Token en query parameter
    else if (req.query.token) {
      token = req.query.token;
      console.log('✅ Token récupéré depuis query parameter');
    }
    
    if (!token) {
      console.log('❌ Aucun token fourni pour la prévisualisation');
      return res.status(401).json({
        success: false,
        message: 'Non autorisé, token manquant'
      });
    }
    
    // Vérifier le token
    let decoded;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-here';
      console.log('🔑 Vérification du token avec JWT_SECRET:', jwtSecret ? 'Défini' : 'Non défini (utilisation de la valeur par défaut)');
      decoded = jwt.verify(token, jwtSecret);
      console.log('✅ Token valide, utilisateur ID:', decoded.id);
    } catch (jwtError) {
      console.error('❌ Erreur de vérification JWT:', jwtError.name, jwtError.message);
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expiré, veuillez vous reconnecter'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Token invalide'
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Erreur d\'authentification'
      });
    }
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      console.error('❌ Utilisateur non trouvé pour le token:', decoded.id);
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    if (!user.isActive) {
      console.error('❌ Utilisateur inactif:', user.email);
      return res.status(401).json({
        success: false,
        message: 'Compte utilisateur désactivé'
      });
    }
    
    console.log('✅ Utilisateur authentifié:', user.email, 'Rôle:', user.role);
    
    const document = await Document.findById(req.params.id).populate('user', 'firstName lastName email');

    if (!document) {
      console.error('❌ Document non trouvé:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    console.log('📄 Document trouvé:', document.nom, 'Propriétaire:', document.user?.email || 'N/A');

    // Vérifier les permissions
    const documentUserId = document.user?._id?.toString() || document.user?.toString() || document.user?.toString();
    const currentUserId = user._id.toString();
    
    const isOwner = documentUserId === currentUserId;
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    
    console.log('🔐 Vérification des permissions:', {
      isOwner,
      isAdmin,
      documentUserId,
      currentUserId,
      userRole: user.role
    });

    if (!isOwner && !isAdmin) {
      console.error('❌ Accès refusé - Pas propriétaire et pas admin');
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce document'
      });
    }

    // Vérifier que le fichier existe
    const filePath = path.resolve(document.cheminFichier);
    console.log('📁 Chemin du fichier:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Fichier non trouvé sur le serveur:', filePath);
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    console.log('✅ Fichier trouvé, envoi en cours...');

    // Définir les headers pour la prévisualisation (pas le téléchargement)
    res.setHeader('Content-Type', document.typeMime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.nom)}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache pour 1 heure
    
    // Envoyer le fichier
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'envoi du fichier:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la prévisualisation du fichier',
            error: err.message
          });
        }
      } else {
        console.log('✅ Fichier envoyé avec succès');
      }
    });
  } catch (error) {
    console.error('Erreur lors de la prévisualisation du document:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
});

// @route   GET /api/user/documents/:id/download
// @desc    Télécharger un document
// @access  Private
router.get('/:id/download', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    // Vérifier les permissions
    // L'utilisateur peut télécharger ses propres documents
    // Les admins peuvent télécharger tous les documents
    if (document.user.toString() !== req.user.id.toString() && 
        req.user.role !== 'admin' && 
        req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce document'
      });
    }

    // Vérifier que le fichier existe
    if (!fs.existsSync(document.cheminFichier)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    // Envoyer le fichier
    res.download(document.cheminFichier, document.nom, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement du fichier'
          });
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors du téléchargement du document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   DELETE /api/user/documents/:id
// @desc    Supprimer un document
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document non trouvé'
      });
    }

    // Vérifier les permissions
    if (document.user.toString() !== req.user.id.toString() && 
        req.user.role !== 'admin' && 
        req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce document'
      });
    }

    // Supprimer le fichier du système de fichiers
    if (fs.existsSync(document.cheminFichier)) {
      fs.unlinkSync(document.cheminFichier);
    }

    // Supprimer le document de la base de données
    await document.deleteOne();

    // Logger l'action
    try {
      await Log.create({
        user: req.user.id,
        userEmail: req.user.email,
        action: 'document_deleted',
        description: `${req.user.email} a supprimé le document "${document.nom}"`,
        ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
        userAgent: req.get('user-agent'),
        metadata: {
          documentId: document._id.toString(),
          nom: document.nom
        }
      });
    } catch (logError) {
      console.error('Erreur lors de l\'enregistrement du log:', logError);
    }

    res.json({
      success: true,
      message: 'Document supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du document:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

