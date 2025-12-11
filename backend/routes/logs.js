const express = require('express');
const PDFDocument = require('pdfkit');
const Log = require('../models/Log');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(protect);

// @route   GET /api/logs/dlog/pdf
// @desc    Générer et télécharger le DLOG en PDF pour une date donnée (SuperAdmin seulement)
// @access  Private/SuperAdmin
// NOTE: Cette route doit être définie AVANT la route '/' pour éviter les conflits
router.get('/dlog/pdf', authorize('superadmin'), async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'La date est requise (format: YYYY-MM-DD)'
      });
    }

    // Valider le format de date
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Format de date invalide. Utilisez le format YYYY-MM-DD'
      });
    }

    // Définir le début et la fin de la journée
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    // Récupérer tous les logs de la journée
    const logs = await Log.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .populate('user', 'firstName lastName email role')
      .populate('targetUser', 'firstName lastName email role')
      .sort({ createdAt: 1 });

    // Créer le document PDF
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    // Configurer les headers de réponse
    const filename = `DLOG_${date.replace(/-/g, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe le PDF vers la réponse
    doc.pipe(res);

    // En-tête du document
    doc.fontSize(20)
       .fillColor('#FF6600')
       .text('DLOG - Journal des Activités', { align: 'center' })
       .moveDown();

    doc.fontSize(12)
       .fillColor('#000000')
       .text(`Date: ${selectedDate.toLocaleDateString('fr-FR', { 
         weekday: 'long', 
         year: 'numeric', 
         month: 'long', 
         day: 'numeric' 
       })}`, { align: 'center' })
       .moveDown();

    doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, { align: 'center' })
       .moveDown(2);

    // Informations de synthèse
    doc.fontSize(14)
       .fillColor('#333333')
       .text('Synthèse', { underline: true })
       .moveDown();

    doc.fontSize(10)
       .fillColor('#000000')
       .text(`Nombre total d'actions: ${logs.length}`, { indent: 20 })
       .moveDown(0.5);

    // Statistiques par action
    const statsByAction = {};
    logs.forEach(log => {
      statsByAction[log.action] = (statsByAction[log.action] || 0) + 1;
    });

    if (Object.keys(statsByAction).length > 0) {
      doc.text('Répartition par type d\'action:', { indent: 20 })
         .moveDown(0.5);
      Object.entries(statsByAction)
        .sort((a, b) => b[1] - a[1])
        .forEach(([action, count]) => {
          doc.text(`  • ${action}: ${count}`, { indent: 30 });
        });
      doc.moveDown();
    }

    // Ligne de séparation
    doc.moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke()
       .moveDown();

    // Détail des logs
    doc.fontSize(14)
       .fillColor('#333333')
       .text('Détail des Actions', { underline: true })
       .moveDown();

    if (logs.length === 0) {
      doc.fontSize(10)
         .fillColor('#666666')
         .text('Aucune action enregistrée pour cette date.', { indent: 20 });
    } else {
      logs.forEach((log, index) => {
        // Vérifier si on doit ajouter une nouvelle page
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(10)
           .fillColor('#000000');

        // Numéro de l'action
        doc.fontSize(9)
           .fillColor('#666666')
           .text(`Action #${index + 1}`, { indent: 20 })
           .moveDown(0.3);

        // Heure
        const logTime = new Date(log.createdAt).toLocaleTimeString('fr-FR');
        doc.fontSize(9)
           .fillColor('#666666')
           .text(`Heure: ${logTime}`, { indent: 30 })
           .moveDown(0.3);

        // Type d'action
        doc.fontSize(10)
           .fillColor('#FF6600')
           .text(`Type: ${log.action}`, { indent: 30 })
           .moveDown(0.3);

        // Utilisateur
        const userName = log.user 
          ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.userEmail
          : log.userEmail || 'Utilisateur inconnu';
        doc.fontSize(10)
           .fillColor('#000000')
           .text(`Utilisateur: ${userName}`, { indent: 30 })
           .moveDown(0.3);

        // Utilisateur cible (si applicable)
        if (log.targetUser || log.targetUserEmail) {
          const targetUserName = log.targetUser
            ? `${log.targetUser.firstName || ''} ${log.targetUser.lastName || ''}`.trim() || log.targetUserEmail
            : log.targetUserEmail || 'Utilisateur inconnu';
          doc.text(`Utilisateur cible: ${targetUserName}`, { indent: 30 })
             .moveDown(0.3);
        }

        // Description
        doc.text(`Description: ${log.description}`, { indent: 30 })
           .moveDown(0.3);

        // Adresse IP
        if (log.ipAddress) {
          doc.fontSize(9)
             .fillColor('#666666')
             .text(`IP: ${log.ipAddress}`, { indent: 30 })
             .moveDown(0.3);
        }

        // Métadonnées (si présentes)
        if (log.metadata && Object.keys(log.metadata).length > 0) {
          doc.fontSize(9)
             .fillColor('#666666')
             .text('Métadonnées:', { indent: 30 })
             .moveDown(0.2);
          Object.entries(log.metadata).forEach(([key, value]) => {
            doc.text(`  ${key}: ${JSON.stringify(value)}`, { indent: 40 });
          });
        }

        // Ligne de séparation entre les actions
        doc.moveDown(0.5)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke()
           .moveDown();
      });
    }

    // Pied de page
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor('#666666')
         .text(
           `Page ${i + 1} sur ${totalPages} - DLOG ${date}`,
           50,
           doc.page.height - 30,
           { align: 'center', width: 500 }
         );
    }

    // Finaliser le PDF
    doc.end();
  } catch (error) {
    console.error('Erreur lors de la génération du DLOG PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la génération du PDF',
      error: error.message
    });
  }
});

// @route   GET /api/logs
// @desc    Récupérer tous les logs (SuperAdmin seulement)
// @access  Private/SuperAdmin
router.get('/', authorize('superadmin'), async (req, res) => {
  try {
    const {
      action,
      userId,
      targetUserId,
      startDate,
      endDate,
      limit = 100,
      page = 1
    } = req.query;

    // Construire le filtre
    const filter = {};

    if (action) {
      filter.action = action;
    }

    if (userId) {
      filter.user = userId;
    }

    if (targetUserId) {
      filter.targetUser = targetUserId;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculer la pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les logs avec pagination
    const logs = await Log.find(filter)
      .populate('user', 'firstName lastName email role')
      .populate('targetUser', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    // Compter le total
    const total = await Log.countDocuments(filter);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      logs
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/logs/stats
// @desc    Récupérer les statistiques des logs (SuperAdmin seulement)
// @access  Private/SuperAdmin
router.get('/stats', authorize('superadmin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    // Statistiques par action
    const statsByAction = await Log.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Statistiques par jour
    const statsByDay = await Log.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    // Nombre total de connexions
    const loginCount = await Log.countDocuments({
      ...filter,
      action: 'login'
    });

    // Nombre total d'actions
    const totalActions = await Log.countDocuments(filter);

    res.json({
      success: true,
      stats: {
        totalActions,
        loginCount,
        byAction: statsByAction,
        byDay: statsByDay
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;


