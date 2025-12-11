const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const Dossier = require('../models/Dossier');

// @route   GET /api/tasks
// @desc    Récupérer toutes les tâches (Admin seulement)
// @access  Private/Admin
router.get('/', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { statut, assignedTo, createdBy, dossier, priorite } = req.query;
    
    const filter = {};
    if (statut) filter.statut = statut;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (createdBy) filter.createdBy = createdBy;
    if (dossier) filter.dossier = dossier;
    if (priorite) filter.priorite = priorite;

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email role')
      .populate('dossier', 'titre numero statut')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/tasks/my
// @desc    Récupérer les tâches assignées à l'utilisateur connecté
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    const { statut, priorite } = req.query;
    
    const filter = { assignedTo: req.user.id };
    if (statut) filter.statut = statut;
    if (priorite) filter.priorite = priorite;

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email role')
      .populate('dossier', 'titre numero statut')
      .sort({ priorite: -1, dateEcheance: 1, createdAt: -1 });

    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des tâches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   GET /api/tasks/:id
// @desc    Récupérer une tâche par ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email role')
      .populate('dossier', 'titre numero statut');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    // Vérifier que l'utilisateur a accès à la tâche (créateur, assigné, ou admin)
    const isCreator = task.createdBy._id.toString() === req.user.id;
    const isAssigned = task.assignedTo._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

    if (!isCreator && !isAssigned && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'avez pas accès à cette tâche'
      });
    }

    res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// @route   POST /api/tasks
// @desc    Créer une nouvelle tâche (Admin seulement)
// @access  Private/Admin
router.post(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  [
    body('titre').trim().notEmpty().withMessage('Le titre est requis'),
    body('assignedTo').notEmpty().withMessage('L\'assignation est requise'),
    body('statut').optional().isIn(['a_faire', 'en_cours', 'en_attente', 'termine', 'annule']),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente'])
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

      const {
        titre,
        description,
        statut,
        priorite,
        assignedTo,
        dateEcheance,
        dateDebut,
        dossier,
        notes
      } = req.body;

      // Vérifier que l'utilisateur assigné existe
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur assigné non trouvé'
        });
      }

      // Vérifier que le dossier existe si fourni
      if (dossier) {
        const dossierExists = await Dossier.findById(dossier);
        if (!dossierExists) {
          return res.status(404).json({
            success: false,
            message: 'Dossier non trouvé'
          });
        }
      }

      const task = await Task.create({
        titre,
        description: description || '',
        statut: statut || 'a_faire',
        priorite: priorite || 'normale',
        assignedTo,
        createdBy: req.user.id,
        dateEcheance: dateEcheance || null,
        dateDebut: dateDebut || null,
        dossier: dossier || null,
        notes: notes || ''
      });

      const taskPopulated = await Task.findById(task._id)
        .populate('assignedTo', 'firstName lastName email role')
        .populate('createdBy', 'firstName lastName email role')
        .populate('dossier', 'titre numero statut');

      res.status(201).json({
        success: true,
        message: 'Tâche créée avec succès',
        task: taskPopulated
      });
    } catch (error) {
      console.error('Erreur lors de la création de la tâche:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   PUT /api/tasks/:id
// @desc    Mettre à jour une tâche
// @access  Private
router.put(
  '/:id',
  protect,
  [
    body('statut').optional().isIn(['a_faire', 'en_cours', 'en_attente', 'termine', 'annule']),
    body('priorite').optional().isIn(['basse', 'normale', 'haute', 'urgente'])
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

      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Tâche non trouvée'
        });
      }

      // Vérifier les permissions
      const isCreator = task.createdBy.toString() === req.user.id;
      const isAssigned = task.assignedTo.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

      if (!isCreator && !isAssigned && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission de modifier cette tâche'
        });
      }

      const {
        titre,
        description,
        statut,
        priorite,
        assignedTo,
        dateEcheance,
        dateDebut,
        dateFin,
        dossier,
        notes
      } = req.body;

      // Vérifier que l'utilisateur assigné existe si fourni
      if (assignedTo) {
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          return res.status(404).json({
            success: false,
            message: 'Utilisateur assigné non trouvé'
          });
        }
        // Seuls les admins peuvent réassigner
        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Seuls les administrateurs peuvent réassigner une tâche'
          });
        }
      }

      // Vérifier que le dossier existe si fourni
      if (dossier) {
        const dossierExists = await Dossier.findById(dossier);
        if (!dossierExists) {
          return res.status(404).json({
            success: false,
            message: 'Dossier non trouvé'
          });
        }
      }

      // Mettre à jour les champs
      if (titre !== undefined) task.titre = titre;
      if (description !== undefined) task.description = description;
      if (statut !== undefined) task.statut = statut;
      if (priorite !== undefined) task.priorite = priorite;
      if (assignedTo !== undefined && isAdmin) task.assignedTo = assignedTo;
      if (dateEcheance !== undefined) task.dateEcheance = dateEcheance || null;
      if (dateDebut !== undefined) task.dateDebut = dateDebut || null;
      if (dateFin !== undefined) task.dateFin = dateFin || null;
      if (dossier !== undefined) task.dossier = dossier || null;
      if (notes !== undefined) task.notes = notes;

      // Si le statut passe à "termine", enregistrer la date de fin
      if (statut === 'termine' && !task.dateFin) {
        task.dateFin = new Date();
      }

      await task.save();

      const taskPopulated = await Task.findById(task._id)
        .populate('assignedTo', 'firstName lastName email role')
        .populate('createdBy', 'firstName lastName email role')
        .populate('dossier', 'titre numero statut');

      res.json({
        success: true,
        message: 'Tâche mise à jour avec succès',
        task: taskPopulated
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   DELETE /api/tasks/:id
// @desc    Supprimer une tâche (Admin seulement)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tâche non trouvée'
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Tâche supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la tâche:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;

