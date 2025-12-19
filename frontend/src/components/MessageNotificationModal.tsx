'use client';

import { useState, useEffect } from 'react';
import { messagesAPI, dossiersAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface MessageNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: any;
}

export function MessageNotificationModal({ isOpen, onClose, message }: MessageNotificationModalProps) {
  const { data: session } = useSession();
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);
  const [dossier, setDossier] = useState<any>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Charger le dossier si le message a un dossierId
    if (isOpen && message?.dossierId) {
      setIsLoadingDossier(true);
      dossiersAPI.getDossierById(message.dossierId)
        .then((response) => {
          if (response.data.success) {
            setDossier(response.data.dossier);
          }
        })
        .catch((error) => {
          console.error('Erreur lors du chargement du dossier:', error);
        })
        .finally(() => {
          setIsLoadingDossier(false);
        });
    } else {
      setDossier(null);
    }
  }, [isOpen, message?.dossierId]);

  useEffect(() => {
    if (!isOpen || !message) return;
    const isContactMessage = message.isContactMessage || !message.sujet;
    const baseSubject = isContactMessage 
      ? (message?.subject || 'Message').toString()
      : (message?.sujet || 'Message').toString();
    setReplySubject(baseSubject.startsWith('Re:') ? baseSubject : `Re: ${baseSubject}`);
    setReplyContent('');
    setReplyError(null);
    setShowReplyForm(false);
  }, [isOpen, message?._id, message?.id]);

  const handleMarkAsRead = async () => {
    if (!message || isMarkingAsRead) return;
    
    try {
      setIsMarkingAsRead(true);
      const isContactMessage = message.isContactMessage || !message.sujet;
      if (isContactMessage) {
        const { contactAPI } = await import('@/lib/api');
        const response = await contactAPI.markAsRead(message._id || message.id, true);
        if (response.data.success) {
          console.log('✅ Message de contact marqué comme lu');
        } else {
          console.error('❌ Erreur lors du marquage:', response.data.message);
        }
      } else {
        await messagesAPI.markAsRead(message._id || message.id);
      }
      onClose();
    } catch (error: any) {
      console.error('Erreur lors du marquage du message:', error);
      console.error('Détails:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  const handleOpenMessage = () => {
    const messageId = message._id || message.id;
    const basePath = typeof window !== 'undefined' && window.location.pathname.includes('/admin') 
      ? '/admin' 
      : '/client';
    router.push(`${basePath}/messages/${messageId}`);
    onClose();
  };

  const handleOpenDossier = () => {
    if (!message?.dossierId) return;
    const basePath = typeof window !== 'undefined' && window.location.pathname.includes('/admin') 
      ? '/admin' 
      : '/client';
    router.push(`${basePath}/dossiers/${message.dossierId}`);
    onClose();
  };

  const handleSendInlineReply = async () => {
    if (!message || isSendingReply) return;
    setReplyError(null);

    const contenu = replyContent?.trim?.() || '';
    if (!contenu) {
      setReplyError('Veuillez saisir un message.');
      return;
    }

    try {
      setIsSendingReply(true);

      const formDataToSend = new FormData();
      formDataToSend.append('sujet', (replySubject?.trim?.() || `Re: ${(message?.sujet || 'Message').toString()}`));
      formDataToSend.append('contenu', contenu);

      // Lier au fil existant
      const messageParentId =
        message?.messageParent?._id ||
        message?.messageParent ||
        message?._id ||
        message?.id;
      if (messageParentId) {
        formDataToSend.append('messageParent', messageParentId.toString());
      }

      // Conserver le dossier si disponible
      if (message?.dossierId) {
        formDataToSend.append('dossierId', message.dossierId.toString());
      }

      // Admin -> répondre à l'expéditeur (destinataire requis côté admin UI)
      const isAdminContext =
        typeof window !== 'undefined' && window.location.pathname.includes('/admin');
      if (isAdminContext) {
        const expediteurId = message?.expediteur?._id || message?.expediteur?.id;
        if (expediteurId) {
          formDataToSend.append('destinataire', expediteurId.toString());
        }
      }

      const response = await messagesAPI.sendMessage(formDataToSend);
      if (response?.data?.success) {
        // Marquer le message original comme lu (best-effort)
        try {
          await messagesAPI.markAsRead(message._id || message.id);
        } catch (e) {
          // ignore
        }
        onClose();
      } else {
        setReplyError(response?.data?.message || 'Erreur lors de l’envoi de la réponse.');
      }
    } catch (error: any) {
      console.error('Erreur lors de l’envoi de la réponse:', error);
      setReplyError(error?.response?.data?.message || error?.message || 'Erreur lors de l’envoi de la réponse.');
    } finally {
      setIsSendingReply(false);
    }
  };

  if (!isOpen || !message) return null;

  const isContactMessage = message.isContactMessage || !message.sujet;
  const expediteur = isContactMessage 
    ? { firstName: message.name?.split(' ')[0] || '', lastName: message.name?.split(' ').slice(1).join(' ') || '', email: message.email }
    : message.expediteur;
  const expediteurName = isContactMessage
    ? message.name || message.email || 'Expéditeur inconnu'
    : expediteur 
      ? `${expediteur.firstName || ''} ${expediteur.lastName || ''}`.trim() || expediteur.email
      : 'Expéditeur inconnu';

  const currentUserId =
    (session?.user as any)?.id ||
    (typeof window !== 'undefined' ? localStorage.getItem('userId') || sessionStorage.getItem('userId') : null);
  
  // Gérer les deux formats : ancien (booléen) et nouveau (tableau)
  const isRead = isContactMessage
    ? Array.isArray(message.lu) && message.lu.some((l: any) => {
        const luUserId = l?.user?._id?.toString() || l?.user?.toString();
        return luUserId && currentUserId && luUserId.toString() === currentUserId.toString();
      })
    : Array.isArray(message.lu) && message.lu.some((l: any) => {
        const luUserId = l?.user?._id?.toString?.() || l?.user?.toString?.();
        return luUserId && currentUserId && luUserId.toString() === currentUserId.toString();
      });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col mx-4 p-6 animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-full flex items-center justify-center">
              <span className="text-3xl">✉️</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Nouveau message</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isContactMessage 
                  ? 'Vous avez reçu un nouveau message via le formulaire de contact'
                  : message.dossierId
                    ? isLoadingDossier
                      ? `Chargement des informations du dossier...`
                      : dossier
                        ? `Nouveau message de ${expediteurName} concernant le dossier n°${dossier.numero || dossier.numeroDossier || dossier._id?.toString().slice(-6) || 'N/A'}`
                        : `Nouveau message de ${expediteurName} concernant un dossier`
                    : `Nouveau message de ${expediteurName}`
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6 flex-1 overflow-y-auto pr-2 min-h-0">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Expéditeur</p>
            <p className="text-base font-semibold text-gray-900">{expediteurName}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sujet</p>
            <p className="text-base font-semibold text-gray-900">
              {isContactMessage ? message.subject : message.sujet}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {isContactMessage ? message.message : message.contenu}
            </p>
          </div>

          {isContactMessage && message.phone && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Téléphone</p>
              <p className="text-sm text-gray-700">{message.phone}</p>
            </div>
          )}

          {(() => {
            const attachments = isContactMessage ? message.documents : message.piecesJointes;
            return attachments && Array.isArray(attachments) && attachments.length > 0;
          })() && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pièces jointes</p>
              <p className="text-sm text-gray-700">
                📎 {(isContactMessage ? message.documents : message.piecesJointes)?.length || 0} fichier(s) attaché(s)
              </p>
            </div>
          )}

          {message.dossierId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Dossier associé</p>
              {isLoadingDossier ? (
                <p className="text-sm text-orange-600">Chargement du dossier...</p>
              ) : dossier ? (
                <div>
                  <p className="text-base font-semibold text-orange-900 mb-1">
                    {dossier.titre || 'Dossier sans titre'}
                  </p>
                  {dossier.categorie && (
                    <p className="text-xs text-orange-600">{dossier.categorie}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-orange-600">Dossier ID: {message.dossierId}</p>
              )}
            </div>
          )}

          {/* Réponse inline */}
          {showReplyForm && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Répondre</p>
                <button
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors"
                  aria-label="Fermer la réponse"
                >
                  ×
                </button>
              </div>

              {replyError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{replyError}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sujet</p>
                  <input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-colors"
                    placeholder="Sujet"
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Votre réponse</p>
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    className="w-full min-h-[110px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-colors"
                    placeholder="Écrivez votre message…"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSendInlineReply}
                    disabled={isSendingReply}
                    className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {isSendingReply ? (
                      <>
                        <span className="text-sm animate-spin">⏳</span>
                        <span className="truncate">Envoi...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">📨</span>
                        <span className="truncate">Envoyer la réponse</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyError(null);
                    }}
                    className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
          
          {message.dossierId && (
            <button
              onClick={handleOpenDossier}
              className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="text-sm">📁</span>
              <span className="truncate">Ouvrir le dossier</span>
            </button>
          )}

          <button
            onClick={() => setShowReplyForm(true)}
            className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="text-sm">↩️</span>
            <span className="truncate">Répondre ici</span>
          </button>

          <button
            onClick={handleOpenMessage}
            className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="text-sm">💬</span>
            <span className="truncate">Ouvrir le message</span>
          </button>

          {!isRead && (
            <button
              onClick={handleMarkAsRead}
              disabled={isMarkingAsRead}
              className="flex-1 min-w-[120px] px-4 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {isMarkingAsRead ? (
                <>
                  <span className="text-sm animate-spin">⏳</span>
                  <span className="truncate">Marquage...</span>
                </>
              ) : (
                <>
                  <span className="text-sm">✓</span>
                  <span className="truncate">Marquer comme lu</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

