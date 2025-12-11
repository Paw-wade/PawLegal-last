'use client';

import { useEffect, useState } from 'react';
import { messagesAPI } from '@/lib/api';
import Link from 'next/link';

interface MessageNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: any;
}

export function MessageNotificationModal({ isOpen, onClose, message }: MessageNotificationModalProps) {
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);

  useEffect(() => {
    if (isOpen && message) {
      // Marquer automatiquement comme lu après 2 secondes
      const timer = setTimeout(async () => {
        try {
          setIsMarkingAsRead(true);
          await messagesAPI.markAsRead(message._id || message.id);
        } catch (error) {
          console.error('Erreur lors du marquage du message:', error);
        } finally {
          setIsMarkingAsRead(false);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, message]);

  if (!isOpen || !message) return null;

  const expediteur = message.expediteur;
  const expediteurName = expediteur 
    ? `${expediteur.firstName || ''} ${expediteur.lastName || ''}`.trim() || expediteur.email
    : 'Expéditeur inconnu';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">✉️</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Nouveau message</h3>
              <p className="text-sm text-muted-foreground">Vous avez reçu un nouveau message</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">De</p>
            <p className="text-sm font-semibold text-foreground">{expediteurName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Sujet</p>
            <p className="text-sm font-semibold text-foreground">{message.sujet}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
            <p className="text-sm text-foreground line-clamp-3">{message.contenu}</p>
          </div>
          {message.piecesJointes && message.piecesJointes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pièces jointes</p>
              <p className="text-sm text-foreground">{message.piecesJointes.length} fichier(s)</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Fermer
          </button>
          <Link
            href={typeof window !== 'undefined' && ((window as any).location?.pathname?.includes('/admin') || (window as any).location?.pathname?.includes('/client')) 
              ? `${(window as any).location.pathname.includes('/admin') ? '/admin' : '/client'}/messages/${message._id || message.id}`
              : `/client/messages/${message._id || message.id}`}
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-center"
          >
            Voir le message
          </Link>
        </div>
      </div>
    </div>
  );
}

