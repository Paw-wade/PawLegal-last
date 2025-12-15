'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { messagesAPI, dossiersAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

function Input({ className = '', ...props }: any) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ htmlFor, children, className = '' }: any) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
      {children}
    </label>
  );
}

function Textarea({ className = '', ...props }: any) {
  return (
    <textarea
      className={`flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent' | 'unread'>('all');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    sujet: '',
    contenu: '',
    destinataires: [] as string[],
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyData, setReplyData] = useState({
    sujet: '',
    contenu: '',
  });
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [selectedDossierId, setSelectedDossierId] = useState<string>('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      loadDossiers();
      loadMessages();
      loadUsers(); // Charger les utilisateurs pour tous les utilisateurs authentifiés
    }
  }, [session, status, router, filter, selectedDossierId]);

  const loadMessages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = { type: filter };
      if (selectedDossierId) {
        params.dossierId = selectedDossierId;
      }
      const response = await messagesAPI.getMessages(params);
      if (response.data.success) {
        setMessages(response.data.messages || []);
        // Si le backend renvoie des threads, les utiliser
        if (response.data.threads) {
          setThreads(response.data.threads);
        } else {
          // Sinon, créer des threads à partir des messages
          const threadsMap = new Map();
          const rootMessages: any[] = [];
          
          (response.data.messages || []).forEach((message: any) => {
            if (!message.messageParent) {
              rootMessages.push(message);
              threadsMap.set(message._id || message.id, [message]);
            } else {
              const parentId = message.messageParent?._id || message.messageParent || message.messageParent;
              if (!threadsMap.has(parentId)) {
                threadsMap.set(parentId, []);
              }
              threadsMap.get(parentId).push(message);
            }
          });
          
          const threadsList = rootMessages.map(root => {
            const threadMessages = threadsMap.get(root._id || root.id) || [root];
            threadMessages.sort((a: any, b: any) => new Date(a.createdAt) - new Date(b.createdAt));
            return {
              root: root,
              messages: threadMessages,
              lastMessage: threadMessages[threadMessages.length - 1]
            };
          });
          
          threadsList.sort((a: any, b: any) => 
            new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
          );
          
          setThreads(threadsList);
        }
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des messages:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des messages');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await messagesAPI.getUsers();
      if (response.data.success) {
        setUsers(response.data.users || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
    }
  };

  const loadDossiers = async () => {
    try {
      const response = await dossiersAPI.getMyDossiers();
      if (response.data.success) {
        const list = response.data.dossiers || [];
        setDossiers(list);
        if (!selectedDossierId && list.length === 1) {
          setOnlyThreadId(list[0]._id || list[0].id);
        }
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des dossiers pour la messagerie:', err);
    }
  };

  // Organiser les utilisateurs par catégories
  const getUsersByCategory = () => {
    const admins = users.filter(user => user.role === 'admin' || user.role === 'superadmin');
    const clients = users.filter(user => user.role === 'client');
    return { admins, clients };
  };

  const toggleUserSelection = (userId: string) => {
    setFormData(prev => {
      const isSelected = prev.destinataires.includes(userId);
      if (isSelected) {
        return { ...prev, destinataires: prev.destinataires.filter(id => id !== userId) };
      } else {
        return { ...prev, destinataires: [...prev.destinataires, userId] };
      }
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Pour les clients, le message doit être rattaché à un dossier
      if (!selectedDossierId) {
        setError('Vous devez sélectionner un dossier pour envoyer un message.');
        setIsSubmitting(false);
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('sujet', formData.sujet);
      formDataToSend.append('contenu', formData.contenu);
      formDataToSend.append('dossierId', selectedDossierId);

      // Ajouter les pièces jointes
      attachments.forEach((file) => {
        formDataToSend.append('piecesJointes', file);
      });

      const response = await messagesAPI.sendMessage(formDataToSend);
      if (response.data.success) {
        alert('Message envoyé avec succès à tous les administrateurs !');
        setShowComposeModal(false);
        setFormData({ sujet: '', contenu: '', destinataires: [] });
        setAttachments([]);
        loadMessages();
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'envoi du message:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi du message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAttachment = async (messageId: string, fileIndex: number, originalName: string) => {
    try {
      const response = await messagesAPI.downloadAttachment(messageId, fileIndex);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erreur lors du téléchargement:', err);
      alert('Erreur lors du téléchargement de la pièce jointe');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage) return;
    
    setIsReplying(true);
    setError(null);

    try {
      if (!selectedMessage) {
        setError('Aucun message sélectionné.');
        setIsReplying(false);
        return;
      }

      const dossierId = selectedMessage.dossierId || selectedDossierId;
      if (!dossierId) {
        setError('Ce message n\'est rattaché à aucun dossier. La réponse ne peut pas être envoyée.');
        setIsReplying(false);
        return;
      }

      // Pour les clients, la réponse va automatiquement à tous les admins mais doit être rattachée au même dossier
      const formDataToSend = new FormData();
      formDataToSend.append('sujet', replyData.sujet);
      formDataToSend.append('contenu', replyData.contenu);
      const messageParentId = selectedMessage.messageParent?._id || selectedMessage.messageParent || selectedMessage._id || selectedMessage.id;
      formDataToSend.append('messageParent', messageParentId);
      formDataToSend.append('dossierId', dossierId);

      // Ajouter les pièces jointes
      replyAttachments.forEach((file) => {
        formDataToSend.append('piecesJointes', file);
      });

      const response = await messagesAPI.sendMessage(formDataToSend);
      if (response.data.success) {
        alert('Réponse envoyée avec succès à tous les administrateurs !');
        setShowReplyModal(false);
        setReplyData({ sujet: '', contenu: '' });
        setReplyAttachments([]);
        loadMessages();
        setSelectedMessage(null);
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'envoi de la réponse:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi de la réponse');
    } finally {
      setIsReplying(false);
    }
  };

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isMessageRead = (message: any) => {
    const userId = (session?.user as any)?.id;
    return message.lu?.some((l: any) => l.user?.toString() === userId?.toString());
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

  if (!session) return null;

  const userRole = (session.user as any)?.role;
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Messagerie</h1>
            <p className="text-muted-foreground">Communiquez avec {isAdmin ? 'les utilisateurs' : 'l\'équipe administrative'}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Dossier :</span>
              <select
                value={selectedDossierId}
                onChange={(e) => setSelectedDossierId(e.target.value)}
                className="px-3 py-2 border border-input rounded-md text-sm bg-background"
              >
                <option value="">Sélectionnez un dossier</option>
                {dossiers.map((dossier) => (
                  <option key={dossier._id || dossier.id} value={dossier._id || dossier.id}>
                    {dossier.titre || dossier.numero || 'Dossier'} – {dossier.numero}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowComposeModal(true)} disabled={!selectedDossierId}>
                + Nouveau message
              </Button>
            </div>
            {!selectedDossierId && (
              <p className="text-xs text-red-600 max-w-xs text-right">
                Vous devez sélectionner un dossier pour rédiger ou répondre à un message.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Filtres */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Tous
          </Button>
          <Button
            variant={filter === 'received' ? 'default' : 'outline'}
            onClick={() => setFilter('received')}
          >
            Reçus
          </Button>
          <Button
            variant={filter === 'sent' ? 'default' : 'outline'}
            onClick={() => setFilter('sent')}
          >
            Envoyés
          </Button>
          <Button
            variant={filter === 'unread' ? 'default' : 'outline'}
            onClick={() => setFilter('unread')}
          >
            Non lus
          </Button>
        </div>

        {/* Liste des messages */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">✉️</div>
            <p className="text-muted-foreground mb-4">Aucun message {filter !== 'all' ? `(${filter})` : ''}</p>
            <Button onClick={() => setShowComposeModal(true)}>Envoyer un message</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const expediteur = message.expediteur;
              const isReceived = message.destinataires?.some((d: any) => 
                d._id?.toString() === (session?.user as any)?.id?.toString() || 
                d.toString() === (session?.user as any)?.id?.toString()
              );
              const isRead = isMessageRead(message);
              
              return (
                <div
                  key={message._id || message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={`bg-white rounded-xl shadow-md p-6 border-l-4 cursor-pointer hover:shadow-lg transition-all ${
                    isRead ? 'border-gray-300' : 'border-primary'
                  } ${!isRead ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">{message.sujet}</h3>
                        {!isRead && (
                          <span className="px-2 py-1 rounded-full bg-primary text-white text-xs font-semibold">
                            Nouveau
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {message.contenu}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {isReceived ? 'De' : 'À'}: {isReceived 
                            ? `${expediteur?.firstName || ''} ${expediteur?.lastName || ''}`.trim() || expediteur?.email
                            : message.typeMessage === 'user_to_admins'
                            ? 'Tous les administrateurs'
                            : message.destinataires?.map((d: any) => 
                                `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email
                              ).join(', ') || 'Équipe admin'
                          }
                        </span>
                        <span>•</span>
                        <span>{formatDate(message.createdAt)}</span>
                        {message.piecesJointes && message.piecesJointes.length > 0 && (
                          <>
                            <span>•</span>
                            <span>📎 {message.piecesJointes.length} pièce(s) jointe(s)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de composition */}
        {showComposeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Nouveau message</h2>
                <button onClick={() => setShowComposeModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>
              <form onSubmit={handleSendMessage} className="p-6 space-y-4">
                {/* Pour les clients : message automatiquement envoyé à tous les admins */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Message automatique aux administrateurs</p>
                      <p className="text-xs text-blue-700">
                        Votre message sera automatiquement envoyé à tous les administrateurs de l'équipe. Vous n'avez pas besoin de sélectionner de destinataire.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sujet">Sujet *</Label>
                  <Input
                    id="sujet"
                    value={formData.sujet}
                    onChange={(e) => setFormData({ ...formData, sujet: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="Sujet du message"
                  />
                </div>
                <div>
                  <Label htmlFor="contenu">Message *</Label>
                  <Textarea
                    id="contenu"
                    value={formData.contenu}
                    onChange={(e) => setFormData({ ...formData, contenu: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="Votre message..."
                  />
                </div>
                <div>
                  <Label htmlFor="attachments">Pièces jointes (max 5 fichiers, 10MB chacun)</Label>
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length > 5) {
                        alert('Maximum 5 fichiers autorisés');
                        return;
                      }
                      setAttachments(files);
                    }}
                    className="mt-1"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, index) => (
                        <div key={index} className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <button
                            type="button"
                            onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowComposeModal(false)} disabled={isSubmitting}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Envoi...' : 'Envoyer'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de détail du message */}
        {selectedMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">{selectedMessage.sujet}</h2>
                <button onClick={() => setSelectedMessage(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">De</p>
                    <p className="font-semibold">
                      {selectedMessage.expediteur?.firstName} {selectedMessage.expediteur?.lastName} ({selectedMessage.expediteur?.email})
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Date</p>
                    <p className="font-semibold">{formatDate(selectedMessage.createdAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-1">À</p>
                    <p className="font-semibold">
                      {selectedMessage.destinataires?.map((d: any) => 
                        `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.email
                      ).join(', ') || 'Équipe admin'}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-muted-foreground mb-2">Message</p>
                  <p className="whitespace-pre-wrap">{selectedMessage.contenu}</p>
                </div>
                {selectedMessage.piecesJointes && selectedMessage.piecesJointes.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-muted-foreground mb-2">Pièces jointes</p>
                    <div className="space-y-2">
                      {selectedMessage.piecesJointes.map((pj: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center gap-2">
                            <span>📎</span>
                            <span className="text-sm">{pj.originalName}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(pj.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadAttachment(selectedMessage._id || selectedMessage.id, index, pj.originalName)}
                          >
                            Télécharger
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Bouton Répondre - uniquement pour les messages reçus */}
                {selectedMessage.destinataires?.some((d: any) => 
                  d._id?.toString() === (session?.user as any)?.id?.toString() || 
                  d.toString() === (session?.user as any)?.id?.toString()
                ) && (
                  <div className="pt-4 border-t flex justify-end">
                    <Button 
                      onClick={() => {
                        setReplyData({
                          sujet: `Re: ${selectedMessage.sujet}`,
                          contenu: '',
                        });
                        setShowReplyModal(true);
                      }}
                    >
                      Répondre
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de réponse */}
        {showReplyModal && selectedMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Répondre</h2>
                <button 
                  onClick={() => {
                    setShowReplyModal(false);
                    setReplyData({ sujet: '', contenu: '' });
                    setReplyAttachments([]);
                  }} 
                  className="text-muted-foreground hover:text-foreground text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleReply} className="p-6 space-y-4">
                {/* Pour les clients : réponse automatiquement envoyée à tous les admins */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                      <p className="text-sm font-semibold text-blue-900 mb-1">Réponse automatique aux administrateurs</p>
                      <p className="text-xs text-blue-700">
                        Votre réponse sera automatiquement envoyée à tous les administrateurs de l'équipe.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="reply-sujet">Sujet *</Label>
                  <Input
                    id="reply-sujet"
                    value={replyData.sujet}
                    onChange={(e) => setReplyData({ ...replyData, sujet: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="Sujet de la réponse"
                  />
                </div>
                <div>
                  <Label htmlFor="reply-contenu">Message *</Label>
                  <Textarea
                    id="reply-contenu"
                    value={replyData.contenu}
                    onChange={(e) => setReplyData({ ...replyData, contenu: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="Votre réponse..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="reply-attachments">Pièces jointes (max 5 fichiers, 10MB chacun)</Label>
                  <Input
                    id="reply-attachments"
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length > 5) {
                        alert('Maximum 5 fichiers autorisés');
                        return;
                      }
                      setReplyAttachments(files);
                    }}
                    className="mt-1"
                  />
                  {replyAttachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {replyAttachments.map((file, index) => (
                        <div key={index} className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>📎 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          <button
                            type="button"
                            onClick={() => setReplyAttachments(replyAttachments.filter((_, i) => i !== index))}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowReplyModal(false);
                      setReplyData({ sujet: '', contenu: '' });
                      setReplyAttachments([]);
                    }} 
                    disabled={isReplying}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isReplying}>
                    {isReplying ? 'Envoi...' : 'Envoyer la réponse'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

