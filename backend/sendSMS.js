// sendSMS.js
const twilio = require('twilio');

// Variables d'environnement
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialiser le client Twilio de manière paresseuse (lazy initialization)
let client = null;

/**
 * Initialise le client Twilio si les credentials sont valides
 * @returns {object|null} - Client Twilio ou null si non configuré
 */
function getTwilioClient() {
  // Si le client est déjà initialisé, le retourner
  if (client !== null) {
    return client;
  }

  // Vérifier que les credentials Twilio sont configurés
  if (!accountSid || !authToken) {
    console.warn('⚠️ Twilio non configuré : TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN doivent être définis dans .env');
    return null;
  }

  // Vérifier que l'Account SID commence par "AC" (format valide)
  if (!accountSid.startsWith('AC')) {
    console.warn('⚠️ TWILIO_ACCOUNT_SID invalide : doit commencer par "AC". Vérifiez votre configuration Twilio.');
    return null;
  }

  try {
    // Initialiser le client Twilio
    client = twilio(accountSid, authToken);
    console.log('✅ Client Twilio initialisé avec succès');
    return client;
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation du client Twilio:', error.message);
    return null;
  }
}

/**
 * Formate un numéro de téléphone pour Twilio (format E.164)
 * @param {string} phone - numéro de téléphone à formater
 * @returns {string|null} - numéro formaté ou null si invalide
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Supprimer tous les espaces, tirets, points, parenthèses
  let cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  // Si le numéro commence par 0, le remplacer par +33 (code France)
  if (cleaned.startsWith('0')) {
    cleaned = '+33' + cleaned.substring(1);
  }
  // Si le numéro ne commence pas par +, ajouter +33
  else if (!cleaned.startsWith('+')) {
    // Si c'est un numéro français (10 chiffres), ajouter +33
    if (cleaned.length === 10 && /^[0-9]+$/.test(cleaned)) {
      cleaned = '+33' + cleaned.substring(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Envoie un SMS via Twilio
 * @param {string} to - numéro du destinataire, ex: '+33612345678' ou '0612345678'
 * @param {string} body - message à envoyer
 * @param {object} options - options supplémentaires (from, etc.)
 * @returns {Promise<object>} - message Twilio créé
 */
async function sendSMS(to, body, options = {}) {
  // Obtenir le client Twilio (initialisation paresseuse)
  const twilioClient = getTwilioClient();
  if (!twilioClient) {
    throw new Error('Twilio n\'est pas configuré. Vérifiez vos variables d\'environnement TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN.');
  }

  if (!twilioPhoneNumber) {
    throw new Error('TWILIO_PHONE_NUMBER n\'est pas configuré dans les variables d\'environnement.');
  }

  if (!to) {
    throw new Error('Le numéro de téléphone du destinataire est requis.');
  }

  if (!body || body.trim().length === 0) {
    throw new Error('Le message SMS ne peut pas être vide.');
  }

  try {
    // Formater le numéro de téléphone
    const formattedTo = formatPhoneNumber(to);
    if (!formattedTo) {
      throw new Error(`Numéro de téléphone invalide: ${to}`);
    }

    // Préparer les options du message
    const messageOptions = {
      body: body.trim(),
      from: options.from || twilioPhoneNumber,
      to: formattedTo,
    };

    // Envoyer le SMS
    const message = await twilioClient.messages.create(messageOptions);
    
    console.log(`✅ SMS envoyé avec succès:`);
    console.log(`   - SID: ${message.sid}`);
    console.log(`   - À: ${formattedTo}`);
    console.log(`   - Statut: ${message.status}`);
    
    return {
      success: true,
      sid: message.sid,
      status: message.status,
      to: formattedTo,
      from: messageOptions.from,
      body: body.trim()
    };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du SMS:', error);
    
    // Gérer les erreurs spécifiques de Twilio
    if (error.code === 21211) {
      throw new Error('Le numéro de téléphone fourni est invalide.');
    } else if (error.code === 21608) {
      throw new Error('Le numéro de téléphone n\'est pas vérifié. En mode test, vous ne pouvez envoyer des SMS qu\'aux numéros vérifiés.');
    } else if (error.code === 21408) {
      throw new Error('Vous n\'avez pas la permission d\'envoyer des SMS à ce numéro.');
    } else if (error.message) {
      throw new Error(`Erreur Twilio: ${error.message}`);
    } else {
      throw new Error('Erreur lors de l\'envoi du SMS. Vérifiez vos credentials Twilio.');
    }
  }
}

/**
 * Envoie un SMS de notification (ex: confirmation de rendez-vous)
 * @param {string} to - numéro du destinataire
 * @param {string} type - type de notification (appointment_confirmed, appointment_reminder, etc.)
 * @param {object} data - données pour personnaliser le message
 * @returns {Promise<object>} - résultat de l'envoi
 */
async function sendNotificationSMS(to, type, data = {}) {
  const messages = {
    appointment_confirmed: `Bonjour ${data.name || ''}, votre rendez-vous est confirmé le ${data.date || ''} à ${data.time || ''}. Cabinet Juridique.`,
    appointment_reminder: `Rappel: Vous avez un rendez-vous demain le ${data.date || ''} à ${data.time || ''}. Cabinet Juridique.`,
    appointment_cancelled: `Votre rendez-vous du ${data.date || ''} à ${data.time || ''} a été annulé. Cabinet Juridique.`,
    dossier_updated: `Votre dossier "${data.dossierTitle || ''}" a été mis à jour. Statut: ${data.statut || ''}. Cabinet Juridique.`,
    document_uploaded: `Un nouveau document a été ajouté à votre dossier "${data.dossierTitle || ''}". Cabinet Juridique.`,
    message_received: `Vous avez reçu un nouveau message de ${data.senderName || 'Cabinet Juridique'}. Cabinet Juridique.`,
  };

  const message = messages[type] || data.message || 'Vous avez reçu une notification du Cabinet Juridique.';
  
  return await sendSMS(to, message);
}

module.exports = {
  sendSMS,
  sendNotificationSMS,
  formatPhoneNumber
};
