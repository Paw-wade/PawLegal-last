// sendSMS.js
import twilio from 'twilio';

// Remplace par tes identifiants Twilio
const accountSid = 'TON_ACCOUNT_SID';
const authToken = 'TON_AUTH_TOKEN';
const client = twilio(accountSid, authToken);

/**
 * Envoie un SMS via Twilio
 * @param {string} to - numéro du destinataire, ex: '+33612345678'
 * @param {string} body - message à envoyer
 */
export async function sendSMS(to, body) {
  try {
    const message = await client.messages.create({
      body: body,
      from: '+TON_NUMERO_TWILIO',
      to: to,
    });
    console.log('Message envoyé avec SID:', message.sid);
    return message;
  } catch (error) {
    console.error('Erreur lors de l\'envoi du SMS:', error);
    throw error;
  }
}
