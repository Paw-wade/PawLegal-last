const mongoose = require('mongoose');

const messageInterneSchema = new mongoose.Schema({
  expediteur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  destinataires: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  sujet: {
    type: String,
    required: [true, 'Le sujet est requis'],
    trim: true
  },
  contenu: {
    type: String,
    required: [true, 'Le contenu est requis'],
    trim: true
  },
  piecesJointes: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lu: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    luAt: {
      type: Date,
      default: Date.now
    }
  }],
  archive: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archiveAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour améliorer les performances
messageInterneSchema.index({ expediteur: 1, createdAt: -1 });
messageInterneSchema.index({ destinataires: 1, createdAt: -1 });
messageInterneSchema.index({ 'lu.user': 1 });

// Middleware pour mettre à jour updatedAt
messageInterneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MessageInterne', messageInterneSchema);

