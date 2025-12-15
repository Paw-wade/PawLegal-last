'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DossierDetailView } from '@/components/DossierDetailView';
import { dossiersAPI, notificationsAPI, messagesAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel, getPrioriteColor } from '@/lib/dossierUtils';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

export default function DossierDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const dossierId = params?.id as string;
  
  const [dossier, setDossier] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated' && !token) {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated' && session) {
      if ((session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
        }
      }
      loadDossier();
      loadNotifications();
      loadMessagesForDossier();
    } else if (token) {
      loadDossier();
      loadNotifications();
    }
  }, [session, status, router, dossierId]);

  // Rafraîchissement automatique toutes les 30 secondes pour le suivi en temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      if (session || localStorage.getItem('token')) {
        loadDossier();
        loadNotifications();
        loadMessagesForDossier();
      }
    }, 30000); // Rafraîchir toutes les 30 secondes

    return () => clearInterval(interval);
  }, [session, dossierId]);

  const loadDossier = async () => {
    if (!dossierId) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token && session && (session.user as any)?.accessToken) {
        localStorage.setItem('token', (session.user as any).accessToken);
      }
      
      const response = await dossiersAPI.getDossierById(dossierId);
      
      if (response.data.success) {
        setDossier(response.data.dossier);
      } else {
        setError('Erreur lors du chargement du dossier');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement du dossier');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotifications = async () => {
    if (!dossierId) return;
    
    try {
      const response = await notificationsAPI.getNotifications({
        limit: 50
      });
      
      if (response.data.success) {
        // Filtrer les notifications liées à ce dossier
        const dossierNotifications = (response.data.notifications || []).filter((notif: any) => 
          notif.metadata?.dossierId === dossierId
        );
        setNotifications(dossierNotifications);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des notifications:', err);
    }
  };

  const loadMessagesForDossier = async () => {
    if (!dossierId) return;

    setIsLoadingMessages(true);
    setMessagesError(null);
    try {
      const response = await messagesAPI.getMessages({ type: 'all', dossierId });
      if (response.data.success) {
        setMessages(response.data.messages || []);
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des messages du dossier:', err);
      setMessagesError(err.response?.data?.message || 'Erreur lors du chargement des messages du dossier');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleCancelDossier = async () => {
    if (!dossier) return;
    
    const confirmed = window.confirm(
      `Êtes-vous sûr de vouloir annuler le dossier "${dossier.titre}" ?\n\nCette action est irréversible et les administrateurs seront notifiés.`
    );
    
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const response = await dossiersAPI.cancelDossier(dossierId);
      if (response.data.success) {
        alert('Dossier annulé avec succès. Les administrateurs ont été notifiés.');
        // Recharger le dossier pour afficher le nouveau statut
        await loadDossier();
        // Rediriger vers la liste des dossiers après 2 secondes
        setTimeout(() => {
          router.push('/client/dossiers');
        }, 2000);
      } else {
        alert(response.data.message || 'Erreur lors de l\'annulation du dossier');
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'annulation du dossier:', error);
      alert(error.response?.data?.message || 'Erreur lors de l\'annulation du dossier');
    } finally {
      setIsCancelling(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-16">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement du dossier...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-16">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-4">Dossier non trouvé</h2>
            <p className="text-muted-foreground mb-6">{error || 'Le dossier demandé n\'existe pas ou vous n\'avez pas l\'autorisation d\'y accéder.'}</p>
            <Link href="/client/dossiers">
              <Button>Retour aux dossiers</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/client/dossiers" className="text-sm text-primary hover:underline mb-2 inline-block">
              ← Retour aux dossiers
            </Link>
            <h1 className="text-4xl font-bold mb-2">{dossier.titre}</h1>
            <p className="text-muted-foreground">Suivi en temps réel de votre dossier</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              loadDossier();
              loadNotifications();
            }}>
              Actualiser
            </Button>
            {/* Bouton d'annulation - seulement si le dossier n'est pas déjà annulé ou dans un statut final */}
            {dossier && !['annule', 'decision_favorable', 'decision_defavorable', 'rejet', 'gain_cause'].includes(dossier.statut) && (
              <Button 
                variant="outline" 
                className="border-red-500 text-red-600 hover:bg-red-50"
                onClick={handleCancelDossier}
              >
                Annuler le dossier
              </Button>
            )}
          </div>
        </div>

        {/* Vue détaillée avec téléchargement et impression */}
        <DossierDetailView dossier={dossier} variant="client" />

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {/* Informations principales */}
          <div className="md:col-span-2 space-y-6">
            {/* Statut actuel */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Statut actuel</h2>
              <div className="flex items-center gap-4">
                <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatutColor(dossier.statut)}`}>
                  {getStatutLabel(dossier.statut)}
                </span>
                {dossier.priorite && (
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getPrioriteColor(dossier.priorite)}`}>
                    Priorité: {dossier.priorite}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Dernière mise à jour : {new Date(dossier.updatedAt || dossier.createdAt).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            {/* Description */}
            {dossier.description && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Description</h2>
                <p className="text-muted-foreground whitespace-pre-wrap">{dossier.description}</p>
              </div>
            )}

            {/* Informations du dossier */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Informations</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Catégorie</p>
                  <p className="font-medium">{dossier.categorie?.replace('_', ' ') || 'Non spécifiée'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{dossier.type || 'Non spécifié'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date de création</p>
                  <p className="font-medium">
                    {new Date(dossier.createdAt).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                {dossier.dateEcheance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'échéance</p>
                    <p className="font-medium">
                      {new Date(dossier.dateEcheance).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Historique des notifications */}
            {notifications.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Historique des mises à jour</h2>
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div key={notif._id || notif.id} className="border-l-4 border-primary pl-4 py-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{notif.titre}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground ml-4">
                          {new Date(notif.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions rapides */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Actions</h2>
              <div className="space-y-2">
                <Link href="/client/documents" className="block">
                  <Button variant="outline" className="w-full">Voir les documents</Button>
                </Link>
                <Link href="/client/notifications" className="block">
                  <Button variant="outline" className="w-full">Voir les notifications</Button>
                </Link>
              </div>
            </div>

            {/* Assigné à */}
            {dossier.assignedTo && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-bold mb-4">Assigné à</h2>
                <p className="text-muted-foreground">
                  {dossier.assignedTo.firstName} {dossier.assignedTo.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{dossier.assignedTo.email}</p>
              </div>
            )}

            {/* Statistiques */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Statistiques</h2>
              <div className="space-y-2">
                {dossier.documents && dossier.documents.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documents</span>
                    <span className="font-medium">{dossier.documents.length}</span>
                  </div>
                )}
                {dossier.messages && dossier.messages.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="font-medium">{dossier.messages.length}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Notifications</span>
                  <span className="font-medium">{notifications.length}</span>
                </div>
              </div>
            </div>

            {/* Messagerie liée au dossier */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Messagerie du dossier</h2>
              {isLoadingMessages ? (
                <p className="text-sm text-muted-foreground">Chargement des messages...</p>
              ) : messagesError ? (
                <p className="text-sm text-red-600">{messagesError}</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun message pour ce dossier pour le moment. Vous pouvez écrire à l&apos;équipe juridique depuis la page Messagerie.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.slice(0, 5).map((msg: any) => (
                    <div
                      key={msg._id || msg.id}
                      className="border border-gray-100 rounded-lg px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-semibold truncate">{msg.sujet}</p>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">
                          {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {msg.contenu}
                      </p>
                    </div>
                  ))}
                  <Link href="/client/messages" className="block mt-2">
                    <Button variant="outline" className="w-full text-xs">
                      Voir tous les messages
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

