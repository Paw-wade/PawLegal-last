'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DossierDetailView } from '@/components/DossierDetailView';
import { dossiersAPI, notificationsAPI, messagesAPI, documentRequestsAPI, documentsAPI, userAPI } from '@/lib/api';
import { DocumentRequestNotificationModal } from '@/components/DocumentRequestNotificationModal';
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

export default function AdminDossierDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const dossierId = params?.id as string;
  
  const [dossier, setDossier] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [documentRequests, setDocumentRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedDocumentRequestNotification, setSelectedDocumentRequestNotification] = useState<any>(null);
  const [showDocumentRequestModal, setShowDocumentRequestModal] = useState(false);

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
      const userRole = (session.user as any)?.role;
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        router.push('/client');
        return;
      }
      
      if ((session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
        }
      }
      loadDossier();
      loadNotifications();
      loadMessagesForDossier();
      loadDocumentRequests();
      loadDocuments();
    } else if (token) {
      loadDossier();
      loadNotifications();
      loadDocumentRequests();
      loadDocuments();
    }
  }, [session, status, router, dossierId]);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (session || localStorage.getItem('token')) {
        loadDossier();
        loadNotifications();
        loadMessagesForDossier();
        loadDocumentRequests();
        loadDocuments();
      }
    }, 30000);

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
          (notif.metadata?.dossierId === dossierId) || 
          (notif.data?.dossierId === dossierId)
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

  const loadDocumentRequests = async () => {
    if (!dossierId) return;
    setIsLoadingRequests(true);
    try {
      const response = await documentRequestsAPI.getRequests({
        dossierId: dossierId
      });
      if (response.data.success) {
        setDocumentRequests(response.data.documentRequests || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des demandes de documents:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const loadDocuments = async () => {
    if (!dossierId) return;
    setIsLoadingDocuments(true);
    try {
      const response = await documentsAPI.getAllDocuments();
      if (response.data.success) {
        const allDocuments = response.data.documents || response.data.data || [];
        // Filtrer les documents liés à ce dossier
        const dossierDocuments = allDocuments.filter((doc: any) => 
          doc.dossierId && (doc.dossierId._id || doc.dossierId).toString() === dossierId.toString()
        );
        setDocuments(dossierDocuments);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des documents:', err);
    } finally {
      setIsLoadingDocuments(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement du dossier...</p>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-16">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-bold text-red-900 mb-2">Erreur</h2>
            <p className="text-red-700 mb-4">{error || 'Dossier non trouvé'}</p>
            <Link href="/admin/dossiers">
              <Button variant="outline">Retour à la liste des dossiers</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* En-tête avec navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dossiers">
              <Button variant="outline" className="text-sm">
                ← Retour
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Détails du dossier</h1>
              <p className="text-muted-foreground mt-1">
                {dossier.numero || dossier.numeroDossier || `Dossier #${dossierId.slice(-6)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatutColor(dossier.statut)}`}>
              {getStatutLabel(dossier.statut)}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPrioriteColor(dossier.priorite)}`}>
              {dossier.priorite}
            </span>
          </div>
        </div>

        {/* Vue détaillée du dossier */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 mb-6">
          <DossierDetailView dossier={dossier} variant="admin" />
        </div>

        {/* Sections supplémentaires */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Documents demandés */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4">📄 Documents demandés</h2>
            {isLoadingRequests ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : documentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande de document</p>
            ) : (
              <div className="space-y-3">
                {documentRequests.map((request: any) => (
                  <div
                    key={request._id || request.id}
                    className={`border-l-4 rounded-lg p-4 ${
                      request.isUrgent
                        ? 'bg-red-50 border-red-500'
                        : 'bg-blue-50 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{request.isUrgent ? '🔴' : '📄'}</span>
                          <h3 className="font-semibold text-base">
                            {request.documentTypeLabel}
                          </h3>
                          {request.isUrgent && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                              URGENT
                            </span>
                          )}
                        </div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Demandé le {new Date(request.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
                          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'received' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {request.status === 'pending' ? 'En attente' :
                           request.status === 'received' ? '✅ Document reçu' :
                           'Envoyé'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents du dossier */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-4">📁 Documents du dossier</h2>
            {isLoadingDocuments ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun document</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc: any) => (
                  <div
                    key={doc._id || doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.nom}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.taille / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="text-xs h-8"
                        onClick={() => {
                          window.open(`/api/user/documents/${doc._id || doc.id}/preview`, '_blank');
                        }}
                      >
                        👁️
                      </Button>
                      <Button
                        variant="outline"
                        className="text-xs h-8"
                        onClick={async () => {
                          try {
                            const response = await documentsAPI.downloadDocument(doc._id || doc.id);
                            const blob = new Blob([response.data]);
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = doc.nom;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          } catch (error) {
                            console.error('Erreur lors du téléchargement:', error);
                            alert('Erreur lors du téléchargement du document');
                          }
                        }}
                      >
                        ⬇️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages du dossier */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">💬 Messagerie du dossier</h2>
          {isLoadingMessages ? (
            <p className="text-sm text-muted-foreground">Chargement des messages...</p>
          ) : messagesError ? (
            <p className="text-sm text-red-600">{messagesError}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun message pour ce dossier pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.slice(0, 5).map((msg: any) => (
                <div
                  key={msg._id || msg.id}
                  className="border border-gray-100 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{msg.sujet}</p>
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
              <Link href={`/admin/messages?dossierId=${dossierId}`}>
                <Button variant="outline" className="w-full text-xs mt-2">
                  Voir tous les messages
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Notifications du dossier */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h2 className="text-xl font-bold mb-4">🔔 Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune notification pour ce dossier</p>
          ) : (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notif: any) => (
                <div
                  key={notif._id || notif.id}
                  className="border border-gray-100 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm">{notif.titre || notif.title}</p>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">
                      {new Date(notif.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notif.message || notif.content}
                  </p>
                </div>
              ))}
              <Link href={`/admin/notifications?dossierId=${dossierId}`}>
                <Button variant="outline" className="w-full text-xs mt-2">
                  Voir toutes les notifications
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Modal de demande de document */}
      <DocumentRequestNotificationModal
        isOpen={showDocumentRequestModal}
        onClose={() => {
          setShowDocumentRequestModal(false);
          setSelectedDocumentRequestNotification(null);
          loadDocumentRequests();
          loadNotifications();
        }}
        notification={selectedDocumentRequestNotification}
        onDocumentSent={async () => {
          await loadDocumentRequests();
          await loadNotifications();
          await loadDocuments();
        }}
      />
    </div>
  );
}

