const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Veuillez entrer un email valide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false
  },
  phone: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ['client', 'admin', 'superadmin', 'avocat', 'assistant', 'comptable', 'secretaire', 'juriste', 'stagiaire', 'visiteur'],
    default: 'client'
  },
  profilComplete: {
    type: Boolean,
    default: false
  },
  dateNaissance: {
    type: Date
  },
  lieuNaissance: {
    type: String,
    trim: true
  },
  nationalite: {
    type: String,
    trim: true
  },
  sexe: {
    type: String,
    enum: ['M', 'F', 'Autre']
  },
  numeroEtranger: {
    type: String,
    trim: true
  },
  numeroTitre: {
    type: String,
    trim: true
  },
  typeTitre: {
    type: String,
    trim: true
  },
  dateDelivrance: {
    type: Date
  },
  dateExpiration: {
    type: Date
  },
  adressePostale: {
    type: String,
    trim: true
  },
  ville: {
    type: String,
    trim: true
  },
  codePostal: {
    type: String,
    trim: true
  },
  pays: {
    type: String,
    trim: true,
    default: 'France'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash le mot de passe avant de sauvegarder
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Mettre à jour updatedAt avant de sauvegarder
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);


