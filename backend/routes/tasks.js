const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const Dossier = require('../models/Dossier');
const Notification = require('../models/Notification');

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
      .populate('dossier', 'titre numero statut')
      .populate('commentaires.utilisateur', 'firstName lastName email role');

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
      let dossierExists = null;
      if (dossier) {
        dossierExists = await Dossier.findById(dossier);
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

      // Notifier l'utilisateur assigné à la nouvelle tâche
      try {
        const creator = req.user;
        const creatorName = `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email;

        await Notification.create({
          user: assignedUser._id,
          type: 'other',
          titre: 'Nouvelle tâche assignée',
          message: `${creatorName} vous a assigné une nouvelle tâche : "${task.titre}".`,
          lien: '/admin?section=tasks',
          metadata: {
            taskId: task._id.toString(),
            dossierId: dossier || null,
            createdBy: creator._id.toString()
          }
        });
      } catch (notifError) {
        console.error('Erreur lors de la notification de l\'utilisateur assigné à la tâche:', notifError);
      }

      // Si la tâche est liée à un dossier, notifier les autres membres de l'équipe du dossier
      if (dossierExists && Array.isArray(dossierExists.teamMembers) && dossierExists.teamMembers.length > 0) {
        try {
          const uniqueMembers = new Set(
            dossierExists.teamMembers
              .map((m) => m.toString())
          );

          // Ajouter le chef d'équipe si défini
          if (dossierExists.teamLeader) {
            uniqueMembers.add(dossierExists.teamLeader.toString());
          }

          // Retirer le créateur et l'utilisateur déjà notifié (assignedTo)
          uniqueMembers.delete(req.user.id.toString());
          uniqueMembers.delete(assignedTo.toString());

          const memberIds = Array.from(uniqueMembers);

          if (memberIds.length > 0) {
            const teamUsers = await User.find({ _id: { $in: memberIds } });

            for (const member of teamUsers) {
              try {
                await Notification.create({
                  user: member._id,
                  type: 'other',
                  titre: 'Nouvelle tâche sur un dossier',
                  message: `Une nouvelle tâche "${task.titre}" a été créée sur le dossier "${dossierExists.titre || dossierExists.numero}".`,
                  lien: '/admin?section=tasks',
                  metadata: {
                    taskId: task._id.toString(),
                    dossierId: dossierExists._id.toString(),
                    type: 'task_created_on_dossier'
                  }
                });
              } catch (memberNotifError) {
                console.error('Erreur lors de la notification d\'un membre de l\'équipe pour la tâche:', memberNotifError);
              }
            }
          }
        } catch (teamNotifError) {
          console.error('Erreur lors de la notification des membres de l\'équipe pour la tâche:', teamNotifError);
        }
      }

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

      console.log('📝 Mise à jour de la tâche:', req.params.id);
      console.log('📝 Données reçues:', req.body);
      
      const task = await Task.findById(req.params.id);
      if (!task) {
        console.error('❌ Tâche non trouvée:', req.params.id);
        return res.status(404).json({
          success: false,
          message: 'Tâche non trouvée'
        });
      }
      
      console.log('✅ Tâche trouvée:', task.titre);

      // Vérifier les permissions
      const isCreator = task.createdBy && task.createdBy.toString() === req.user.id;
      const isAssigned = task.assignedTo && task.assignedTo.toString() === req.user.id;
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
        notes,
        effectue,
        commentaireEffectue
      } = req.body;

      // Vérifier que l'utilisateur assigné existe si fourni
      if (assignedTo) {
        console.log('👤 Vérification de l\'utilisateur assigné:', assignedTo);
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          console.error('❌ Utilisateur assigné non trouvé:', assignedTo);
          return res.status(404).json({
            success: false,
            message: 'Utilisateur assigné non trouvé'
          });
        }
        console.log('✅ Utilisateur assigné trouvé:', assignedUser.email);
        // Seuls les admins peuvent réassigner
        if (!isAdmin) {
          console.error('❌ Tentative de réassignation par un non-admin');
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

      // Gérer le statut effectué (seul l'utilisateur assigné peut modifier)
      const wasEffectue = task.effectue;
      if (req.body.effectue !== undefined && isAssigned) {
        task.effectue = req.body.effectue;
        if (req.body.effectue) {
          task.dateEffectue = new Date();
          // Si marqué comme effectué, mettre le statut à "termine" si ce n'est pas déjà fait
          if (task.statut !== 'termine') {
            task.statut = 'termine';
            if (!task.dateFin) {
              task.dateFin = new Date();
            }
          }
        } else {
          task.dateEffectue = null;
        }
      }
      
      // Gérer le commentaire (seul l'utilisateur assigné peut modifier)
      if (req.body.commentaireEffectue !== undefined && isAssigned) {
        task.commentaireEffectue = req.body.commentaireEffectue || null;
      }

      // Si le statut passe à "termine", enregistrer la date de fin
      if (statut === 'termine' && !task.dateFin) {
        task.dateFin = new Date();
      }

      // Créer une notification pour le créateur si la tâche est marquée comme effectuée
      if (req.body.effectue === true && !wasEffectue && task.createdBy) {
        try {
          const assignedUser = await User.findById(req.user.id);
          const assignedUserName = assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'Un utilisateur';
          
          await Notification.create({
            user: task.createdBy,
            type: 'other',
            titre: 'Tâche effectuée',
            message: `${assignedUserName} a marqué la tâche "${task.titre}" comme effectuée.${req.body.commentaireEffectue ? ` Commentaire: ${req.body.commentaireEffectue}` : ''}`,
            lien: `/admin?section=tasks`,
            metadata: {
              taskId: task._id.toString(),
              assignedUserId: req.user.id,
              commentaire: req.body.commentaireEffectue || null
            }
          });
        } catch (notifError) {
          console.error('Erreur lors de la création de la notification:', notifError);
          // Ne pas bloquer la mise à jour si la notification échoue
        }
      }

      console.log('💾 Sauvegarde de la tâche...');
      await task.save();
      console.log('✅ Tâche sauvegardée avec succès');

      const taskPopulated = await Task.findById(task._id)
        .populate('assignedTo', 'firstName lastName email role')
        .populate('createdBy', 'firstName lastName email role')
        .populate('dossier', 'titre numero statut');

      console.log('✅ Tâche mise à jour avec succès');
      res.json({
        success: true,
        message: 'Tâche mise à jour avec succès',
        task: taskPopulated
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      console.error('Stack trace:', error.stack);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue lors de la mise à jour de la tâche'
      });
    }
  }
);

// @route   POST /api/tasks/:id/notes
// @desc    Ajouter une note/commentaire lié à une tâche
// @access  Private (créateur, assigné ou admin)
router.post(
  '/:id/notes',
  protect,
  [
    body('contenu').trim().notEmpty().withMessage('Le contenu de la note est requis'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array(),
        });
      }

      const task = await Task.findById(req.params.id);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Tâche non trouvée',
        });
      }

      const isCreator = task.createdBy && task.createdBy.toString() === req.user.id;
      const isAssigned = task.assignedTo && task.assignedTo.toString() === req.user.id;
      const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';

      if (!isCreator && !isAssigned && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas la permission d\'ajouter une note à cette tâche',
        });
      }

      const { contenu } = req.body;

      // Ajouter la note dans l'historique des commentaires
      task.commentaires = task.commentaires || [];
      task.commentaires.push({
        utilisateur: req.user.id,
        contenu,
        createdAt: new Date(),
      });

      await task.save();

      // Recharger la tâche avec les relations
      const taskPopulated = await Task.findById(task._id)
        .populate('assignedTo', 'firstName lastName email role')
        .populate('createdBy', 'firstName lastName email role')
        .populate('dossier', 'titre numero statut')
        .populate('commentaires.utilisateur', 'firstName lastName email role');

      const auteur = req.user;
      const auteurName = `${auteur.firstName || ''} ${auteur.lastName || ''}`.trim() || auteur.email;

      // Notification au créateur de la tâche (s'il existe)
      if (task.createdBy) {
        try {
          await Notification.create({
            user: task.createdBy,
            type: 'other',
            titre: 'Nouvelle note sur une tâche',
            message: `${auteurName} a ajouté une note sur la tâche "${task.titre}".`,
            lien: `/admin?section=tasks`,
            metadata: {
              taskId: task._id.toString(),
              auteurId: auteur._id.toString(),
              type: 'task_note',
            },
          });
        } catch (notifError) {
          console.error('Erreur lors de la notification du créateur de la tâche:', notifError);
        }
      }

      // Notification à tous les administrateurs (y compris superadmin)
      try {
        const admins = await User.find({
          role: { $in: ['admin', 'superadmin'] },
          isActive: { $ne: false },
        });

        for (const admin of admins) {
          try {
            await Notification.create({
              user: admin._id,
              type: 'other',
              titre: 'Nouvelle note sur une tâche',
              message: `${auteurName} a ajouté une note sur la tâche "${task.titre}".`,
              lien: `/admin?section=tasks`,
              metadata: {
                taskId: task._id.toString(),
                auteurId: auteur._id.toString(),
                type: 'task_note_admin',
              },
            });
          } catch (adminNotifError) {
            console.error('Erreur lors de la notification admin pour la note de tâche:', adminNotifError);
          }
        }
      } catch (adminsError) {
        console.error('Erreur lors de la récupération des administrateurs pour la note de tâche:', adminsError);
      }

      res.status(201).json({
        success: true,
        message: 'Note ajoutée avec succès',
        task: taskPopulated,
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout d\'une note à la tâche:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'ajout de la note',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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

