const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  titre: {
    type: String,
    required: [true, 'Le titre de la tâche est requis'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  statut: {
    type: String,
    enum: ['a_faire', 'en_cours', 'en_attente', 'termine', 'annule'],
    default: 'a_faire'
  },
  priorite: {
    type: String,
    enum: ['basse', 'normale', 'haute', 'urgente'],
    default: 'normale'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'La tâche doit être assignée à un membre'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Le créateur de la tâche est requis'],
  },
  dateEcheance: {
    type: Date
  },
  dateDebut: {
    type: Date
  },
  dateFin: {
    type: Date
  },
  dossier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dossier',
    required: false // Optionnel, une tâche peut être liée à un dossier
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Index pour améliorer les performances
taskSchema.index({ assignedTo: 1, statut: 1 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ dossier: 1 });
taskSchema.index({ dateEcheance: 1 });
taskSchema.index({ statut: 1, priorite: 1 });

// Mettre à jour updatedAt avant de sauvegarder
taskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Task', taskSchema);

