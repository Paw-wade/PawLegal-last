const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');
const Log = require('../models/Log');
const { protect, authorize } = require('../middleware/auth');
const { handleImpersonation, logImpersonationAction, getEffectiveUserId, getEffectiveUser } = require('../middleware/impersonation');

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
// Ajouter le middleware d'impersonation après protect
router.use(handleImpersonation);

// @route   GET /api/user/documents
// @desc    Récupérer tous les documents de l'utilisateur connecté
// @access  Private (tous les rôles authentifiés)
router.get('/', async (req, res) => {
  try {
    // En mode impersonation, utiliser l'ID de l'utilisateur impersonné
    const targetUserId = req.impersonateUserId || req.user.id;
    const targetUserEmail = req.impersonateTargetUser?.email || req.user.email;
    
    console.log('📄 Récupération des documents pour l\'utilisateur:', targetUserId, 'Rôle:', req.user.role, req.impersonateUserId ? '[IMPERSONATION]' : '');
    
    const documents = await Document.find({ user: targetUserId })
      .populate('dossierId', 'titre numero categorie statut')
      .sort({ createdAt: -1 });

    console.log('✅ Documents trouvés:', documents.length, 'pour l\'utilisateur:', targetUserEmail);

    // Logger l'action si en impersonation
    if (req.impersonateUserId) {
      await logImpersonationAction(req, 'view_documents', `Consultation de ${documents.length} document(s)`, { count: documents.length });
    }

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
    console.log('📄 Requête GET /api/user/documents/admin reçue:', {
      user: req.user?.email,
      role: req.user?.role,
      userId: req.query?.userId
    });
    
    let query = {};
    
    // Si un userId est fourni, filtrer par utilisateur
    if (req.query.userId) {
      query.user = req.query.userId;
      console.log('🔍 Filtrage par userId:', req.query.userId);
    }
    
    const documents = await Document.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 });

    console.log('✅ Documents trouvés:', documents.length);

    res.json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des documents (admin):', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/user/documents
// @desc    Téléverser un document
// @access  Private
router.post('/', upload.single('document'), async (req, res) => {
  try {
    console.log('📤 Upload de document - Début');
    console.log('📤 Fichier reçu:', req.file ? {
      originalname: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'AUCUN FICHIER');
    console.log('📤 Body:', req.body);

    if (!req.file) {
      console.error('❌ Aucun fichier téléversé');
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier téléversé'
      });
    }

    const { nom, description, categorie, dossierId } = req.body;
    const effectiveUserId = getEffectiveUserId(req);

    console.log('📤 Données du document:', {
      userId: effectiveUserId,
      nom: nom || req.file.originalname,
      dossierId: dossierId
    });

    const documentData = {
      user: effectiveUserId, // Utilise l'ID impersonné si en impersonation
      nom: nom || req.file.originalname,
      nomFichier: req.file.filename,
      cheminFichier: req.file.path,
      typeMime: req.file.mimetype,
      taille: req.file.size,
      description: description || '',
      categorie: categorie || 'autre'
    };

    // Ajouter dossierId seulement s'il est fourni et valide
    if (dossierId && dossierId.trim() !== '') {
      // Vérifier que le dossierId est un ObjectId valide
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(dossierId)) {
        documentData.dossierId = dossierId;
        console.log('📁 Dossier ID ajouté:', dossierId);
      } else {
        console.warn('⚠️ Dossier ID invalide, ignoré:', dossierId);
      }
    }

    console.log('📤 Création du document...');
    const document = await Document.create(documentData);
    console.log('✅ Document créé avec succès:', document._id);

    // Logger l'action
    try {
      await Log.create({
        user: getEffectiveUserId(req), // Utilise l'ID impersonné si en impersonation
        userEmail: getEffectiveUser(req)?.email || req.user.email,
        action: 'document_uploaded',
        description: `${getEffectiveUser(req)?.email || req.user.email} a téléversé le document "${document.nom}"`,
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

    console.log('✅ Document téléversé avec succès:', document._id);
    res.status(201).json({
      success: true,
      message: 'Document téléversé avec succès',
      document
    });
  } catch (error) {
    console.error('❌ Erreur lors du téléversement du document:', error);
    console.error('❌ Stack trace:', error.stack);
    console.error('❌ Request body:', req.body);
    console.error('❌ Request file:', req.file);
    
    // Supprimer le fichier si le document n'a pas pu être créé
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Fichier temporaire supprimé:', req.file.path);
        }
      } catch (unlinkError) {
        console.error('⚠️ Erreur lors de la suppression du fichier temporaire:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du téléversement du document',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

    // Déterminer le Content-Type correct
    let contentType = document.typeMime || 'application/octet-stream';
    if (contentType === 'application/octet-stream' && document.nom.toLowerCase().endsWith('.pdf')) {
      contentType = 'application/pdf';
    }

    // Définir les headers pour la prévisualisation (pas le téléchargement)
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.nom)}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache pour 1 heure
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Empêcher le sniffing de type
    
    // Pour les PDF, ajouter des headers supplémentaires pour une meilleure compatibilité
    if (contentType === 'application/pdf') {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    
    // Envoyer le fichier
    res.sendFile(filePath, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.nom)}"`,
      }
    }, (err) => {
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
    const effectiveUserId = getEffectiveUserId(req);
    if (document.user.toString() !== effectiveUserId.toString() && 
        req.user.role !== 'admin' && 
        req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé à ce document'
      });
    }

    // Vérifier que le fichier existe
    const filePath = path.resolve(document.cheminFichier);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé sur le serveur'
      });
    }

    // Déterminer le Content-Type correct
    let contentType = document.typeMime || 'application/octet-stream';
    if (contentType === 'application/octet-stream' && document.nom.toLowerCase().endsWith('.pdf')) {
      contentType = 'application/pdf';
    }

    // Définir les headers pour le téléchargement
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.nom)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Envoyer le fichier tel quel (binaire intact)
    res.sendFile(filePath, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.nom)}"`,
      }
    }, (err) => {
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
    const effectiveUserId = getEffectiveUserId(req);
    if (document.user.toString() !== effectiveUserId.toString() && 
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
      const effectiveUserId = getEffectiveUserId(req);
      const effectiveUser = getEffectiveUser(req);
      await Log.create({
        user: effectiveUserId, // Utilise l'ID impersonné si en impersonation
        userEmail: effectiveUser?.email || req.user.email,
        action: 'document_deleted',
        description: `${effectiveUser?.email || req.user.email} a supprimé le document "${document.nom}"`,
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

