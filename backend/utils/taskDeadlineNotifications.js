const Task = require('../models/Task');
const User = require('../models/User');
const Notification = require('../models/Notification');

/**
 * Vérifie les tâches avec échéance et envoie des notifications
 * - 2 jours avant l'échéance
 * - 1 jour avant l'échéance
 * - Le jour même de l'échéance
 */
async function checkTaskDeadlines() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Calculer les dates pour les notifications
    const inTwoDays = new Date(now);
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    
    const inOneDay = new Date(now);
    inOneDay.setDate(inOneDay.getDate() + 1);
    
    const today = new Date(now);
    
    // Récupérer toutes les tâches avec échéance qui ne sont pas terminées ou annulées
    const tasks = await Task.find({
      dateEcheance: { $exists: true, $ne: null },
      statut: { $nin: ['termine', 'annule'] }
    })
      .populate('assignedTo', 'firstName lastName email role')
      .populate('createdBy', 'firstName lastName email role');

    // Récupérer tous les admins
    const admins = await User.find({
      role: { $in: ['admin', 'superadmin'] },
      isActive: { $ne: false }
    });

    let notificationsSent = 0;

    for (const task of tasks) {
      if (!task.dateEcheance) continue;

      const deadline = new Date(task.dateEcheance);
      deadline.setHours(0, 0, 0, 0);

      const daysUntilDeadline = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));

      // Déterminer le type de notification
      let notificationType = null;
      let message = '';
      let titre = '';

      if (daysUntilDeadline === 2) {
        notificationType = 'deadline_2_days';
        titre = 'Échéance dans 2 jours';
        message = `La tâche "${task.titre}" arrive à échéance dans 2 jours (${deadline.toLocaleDateString('fr-FR')}).`;
      } else if (daysUntilDeadline === 1) {
        notificationType = 'deadline_1_day';
        titre = 'Échéance demain';
        message = `La tâche "${task.titre}" arrive à échéance demain (${deadline.toLocaleDateString('fr-FR')}).`;
      } else if (daysUntilDeadline === 0) {
        notificationType = 'deadline_today';
        titre = 'Échéance aujourd\'hui';
        message = `La tâche "${task.titre}" arrive à échéance aujourd'hui (${deadline.toLocaleDateString('fr-FR')}).`;
      }

      if (!notificationType) continue;

      // Récupérer tous les destinataires (assignés + admins)
      const recipients = new Set();
      
      // Ajouter les personnes assignées
      const assignedToArray = Array.isArray(task.assignedTo) 
        ? task.assignedTo 
        : [task.assignedTo].filter(Boolean);
      
      assignedToArray.forEach(assigned => {
        if (assigned && assigned._id) {
          recipients.add(assigned._id.toString());
        } else if (assigned) {
          recipients.add(assigned.toString());
        }
      });

      // Ajouter tous les admins
      admins.forEach(admin => {
        recipients.add(admin._id.toString());
      });

      // Envoyer les notifications
      for (const recipientId of recipients) {
        try {
          // Vérifier si une notification de ce type a déjà été envoyée aujourd'hui
          const existingNotification = await Notification.findOne({
            user: recipientId,
            type: 'other',
            'metadata.taskId': task._id.toString(),
            'metadata.deadlineNotificationType': notificationType,
            createdAt: {
              $gte: new Date(now),
              $lt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
            }
          });

          if (existingNotification) {
            continue; // Notification déjà envoyée aujourd'hui
          }

          await Notification.create({
            user: recipientId,
            type: 'other',
            titre,
            message,
            lien: '/admin/taches',
            metadata: {
              taskId: task._id.toString(),
              deadlineNotificationType: notificationType,
              deadlineDate: task.dateEcheance,
              daysUntilDeadline
            }
          });

          notificationsSent++;
        } catch (notifError) {
          console.error(`Erreur lors de l'envoi de la notification d'échéance à ${recipientId}:`, notifError);
        }
      }
    }

    console.log(`✅ Vérification des échéances terminée. ${notificationsSent} notification(s) envoyée(s).`);
    return { success: true, notificationsSent };
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des échéances de tâches:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { checkTaskDeadlines };

