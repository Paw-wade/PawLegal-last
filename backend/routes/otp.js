const express = require('express');
const { body, validationResult } = require('express-validator');
const OTP = require('../models/OTP');
const User = require('../models/User');
const { sendSMS, formatPhoneNumber } = require('../sendSMS');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Générer un token JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your-secret-key-here', {
    expiresIn: '30d'
  });
};

// Générer un code OTP aléatoire (6 chiffres)
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route   POST /api/otp/send
// @desc    Envoyer un code OTP par SMS
// @access  Public
router.post(
  '/send',
  [
    body('firstName').trim().notEmpty().withMessage('Le prénom est requis'),
    body('lastName').trim().notEmpty().withMessage('Le nom est requis'),
    body('phone').trim().notEmpty().withMessage('Le numéro de téléphone est requis')
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

      const { firstName, lastName, phone } = req.body;

      // Formater le numéro de téléphone
      const formattedPhone = formatPhoneNumber(phone);
      if (!formattedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Numéro de téléphone invalide'
        });
      }

      // Vérifier si un utilisateur avec ce numéro existe déjà
      const existingUser = await User.findOne({ phone: formattedPhone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Un compte avec ce numéro de téléphone existe déjà'
        });
      }

      // Générer un code OTP
      const code = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Supprimer les anciens codes OTP pour ce numéro
      await OTP.deleteMany({ phone: formattedPhone });

      // Créer un nouveau code OTP
      const otp = await OTP.create({
        phone: formattedPhone,
        code,
        firstName,
        lastName,
        expiresAt
      });

      // Envoyer le SMS avec le code OTP
      try {
        const message = `Votre code de vérification Paw Legal est : ${code}. Valide pendant 10 minutes.`;
        
        // En mode développement, permettre de continuer sans SMS réel si Twilio n'est pas configuré
        if (process.env.NODE_ENV === 'development' && process.env.ALLOW_OTP_WITHOUT_SMS === 'true') {
          console.log(`⚠️ Mode développement: SMS simulé pour ${formattedPhone}`);
          console.log(`📱 Code OTP généré: ${code} (valide 10 minutes)`);
          
          res.json({
            success: true,
            message: 'Code OTP généré avec succès (mode développement - SMS simulé)',
            expiresAt: expiresAt.toISOString(),
            code: code // Retourner le code en mode développement pour faciliter les tests
          });
          return;
        }
        
        await sendSMS(formattedPhone, message);
        
        console.log(`✅ Code OTP envoyé à ${formattedPhone}: ${code}`);
        
        res.json({
          success: true,
          message: 'Code OTP envoyé avec succès',
          expiresAt: expiresAt.toISOString()
        });
      } catch (smsError) {
        console.error('❌ Erreur lors de l\'envoi du SMS:', smsError);
        console.error('❌ Détails de l\'erreur:', {
          message: smsError.message,
          code: smsError.code,
          stack: process.env.NODE_ENV === 'development' ? smsError.stack : undefined
        });
        
        // Supprimer le code OTP si l'envoi du SMS échoue
        await OTP.findByIdAndDelete(otp._id);
        
        // Message d'erreur plus détaillé selon le type d'erreur
        let errorMessage = 'Erreur lors de l\'envoi du SMS. Veuillez réessayer.';
        
        if (smsError.message?.includes('Twilio n\'est pas configuré')) {
          errorMessage = 'Le service SMS n\'est pas configuré. Veuillez contacter l\'administrateur.';
        } else if (smsError.message?.includes('numéro de téléphone n\'est pas vérifié')) {
          errorMessage = 'Ce numéro de téléphone n\'est pas vérifié. En mode test, seuls les numéros vérifiés peuvent recevoir des SMS.';
        } else if (smsError.message?.includes('Numéro de téléphone invalide')) {
          errorMessage = 'Le numéro de téléphone fourni est invalide. Veuillez vérifier le format.';
        } else if (smsError.message) {
          errorMessage = `Erreur SMS: ${smsError.message}`;
        }
        
        return res.status(500).json({
          success: false,
          message: errorMessage,
          error: process.env.NODE_ENV === 'development' ? smsError.message : undefined
        });
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

// @route   POST /api/otp/verify
// @desc    Vérifier le code OTP et créer le compte
// @access  Public
router.post(
  '/verify',
  [
    body('phone').trim().notEmpty().withMessage('Le numéro de téléphone est requis'),
    body('code').trim().notEmpty().withMessage('Le code OTP est requis')
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

      const { phone, code } = req.body;

      // Formater le numéro de téléphone
      const formattedPhone = formatPhoneNumber(phone);
      if (!formattedPhone) {
        return res.status(400).json({
          success: false,
          message: 'Numéro de téléphone invalide'
        });
      }

      // Trouver le code OTP
      const otp = await OTP.findOne({
        phone: formattedPhone,
        code: code.trim(),
        verified: false
      });

      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'Code OTP invalide ou expiré'
        });
      }

      // Vérifier si le code n'a pas expiré
      if (new Date() > otp.expiresAt) {
        await OTP.findByIdAndDelete(otp._id);
        return res.status(400).json({
          success: false,
          message: 'Code OTP expiré. Veuillez demander un nouveau code.'
        });
      }

      // Vérifier si un utilisateur avec ce numéro existe déjà
      let user = await User.findOne({ phone: formattedPhone });
      
      if (!user) {
        // Créer un nouvel utilisateur sans mot de passe
        user = await User.create({
          firstName: otp.firstName,
          lastName: otp.lastName,
          phone: formattedPhone,
          phoneVerified: true,
          needsPasswordSetup: true, // L'utilisateur devra définir un mot de passe
          role: 'client',
          profilComplete: false
        });
      } else {
        // Mettre à jour l'utilisateur existant
        user.phoneVerified = true;
        await user.save();
      }

      // Marquer le code OTP comme vérifié
      otp.verified = true;
      await otp.save();

      // Générer un token JWT
      const token = generateToken(user._id);

      // Logger la création de compte
      try {
        const Log = require('../models/Log');
        await Log.create({
          action: 'signup_otp',
          user: user._id,
          userEmail: user.email || `phone:${formattedPhone}`,
          description: `Création de compte via OTP pour ${formattedPhone}`,
          ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
          userAgent: req.get('user-agent'),
          metadata: {
            phone: formattedPhone,
            needsPasswordSetup: true
          }
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement du log:', logError);
      }

      res.json({
        success: true,
        message: 'Code OTP vérifié avec succès',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          phoneVerified: user.phoneVerified,
          needsPasswordSetup: user.needsPasswordSetup,
          profilComplete: user.profilComplete || false
        }
      });
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur',
        error: error.message
      });
    }
  }
);

module.exports = router;

