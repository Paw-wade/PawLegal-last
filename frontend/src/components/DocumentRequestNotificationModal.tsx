'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { documentRequestsAPI, documentsAPI, dossiersAPI } from '@/lib/api';

interface DocumentRequestNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notification: any;
  onDocumentSent?: () => void; // Callback appelé après l'envoi du document
}

function Button({ children, variant = 'default', className = '', disabled, ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    default: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
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

export function DocumentRequestNotificationModal({ isOpen, onClose, notification, onDocumentSent }: DocumentRequestNotificationModalProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [documentRequest, setDocumentRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadData, setUploadData] = useState({
    nom: '',
    description: '',
    categorie: 'autre'
  });
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && notification?.data?.documentRequestId) {
      loadDocumentRequest();
      loadExistingDocuments();
    }
  }, [isOpen, notification]);

  const loadDocumentRequest = async () => {
    if (!notification?.data?.documentRequestId) return;
    setIsLoading(true);
    try {
      const response = await documentRequestsAPI.getRequest(notification.data.documentRequestId);
      if (response.data.success) {
        setDocumentRequest(response.data.documentRequest);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement de la demande:', err);
      setError('Erreur lors du chargement de la demande');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingDocuments = async () => {
    setIsLoadingDocuments(true);
    try {
      const response = await documentsAPI.getMyDocuments();
      if (response.data.success) {
        setExistingDocuments(response.data.documents || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des documents:', err);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadData.nom) {
        setUploadData({ ...uploadData, nom: file.name });
      }
      setError(null);
    }
  };

  const handleUploadNewDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = selectedFile || fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }
    if (!uploadData.nom || uploadData.nom.trim() === '') {
      setError('Veuillez saisir un nom pour le document');
      return;
    }
    if (!documentRequest) {
      setError('Demande de document non trouvée');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Téléverser le document
      const formData = new FormData();
      formData.append('document', file);
      formData.append('nom', uploadData.nom.trim());
      formData.append('description', uploadData.description.trim());
      formData.append('categorie', documentRequest.documentType || uploadData.categorie);
      formData.append('dossierId', documentRequest.dossier._id || documentRequest.dossier);

      const uploadResponse = await documentsAPI.uploadDocument(formData);
      if (uploadResponse.data.success) {
        const newDocumentId = uploadResponse.data.document._id || uploadResponse.data.document.id;
        
        // Associer le document à la demande
        await documentRequestsAPI.uploadDocument(documentRequest._id || documentRequest.id, newDocumentId);
        
        setSuccess('Document envoyé avec succès !');
        setSelectedFile(null);
        setUploadData({ nom: '', description: '', categorie: 'autre' });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setShowUploadForm(false);
        
        // Recharger la demande pour voir le nouveau statut
        await loadDocumentRequest();
        await loadExistingDocuments();
        
        // Appeler le callback pour recharger les données parentes (notifications, demandes, etc.)
        if (onDocumentSent) {
          onDocumentSent();
        }
        
        setTimeout(() => {
          setSuccess(null);
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Erreur lors du téléversement:', err);
      setError(err.response?.data?.message || 'Erreur lors du téléversement du document');
    } finally {
      setUploading(false);
    }
  };

  const handleUseExistingDocument = async (documentId: string) => {
    if (!documentRequest) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await documentRequestsAPI.uploadDocument(documentRequest._id || documentRequest.id, documentId);
      setSuccess('Document envoyé avec succès !');
      await loadDocumentRequest();
      
      // Appeler le callback pour recharger les données parentes (notifications, demandes, etc.)
      if (onDocumentSent) {
        onDocumentSent();
      }
      
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Erreur lors de l\'envoi du document:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi du document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDossier = () => {
    if (!documentRequest?.dossier?._id) return;
    router.push(`/client/dossiers/${documentRequest.dossier._id}`);
    onClose();
  };

  if (!isOpen || !notification) return null;

  const requestData = notification.data || {};
  const isUrgent = requestData.isUrgent || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
              isUrgent ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              {isUrgent ? '🔴' : '📄'}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {isUrgent ? '🔴 Demande urgente de document' : '📄 Demande de document'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Dossier {requestData.dossierNumero || notification.data?.dossierId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && !documentRequest ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Informations de la demande */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Type de document demandé</p>
                    <p className="text-lg font-bold text-blue-900">
                      {requestData.documentTypeLabel || documentRequest?.documentTypeLabel || 'Document'}
                    </p>
                  </div>
                  {documentRequest?.message && (
                    <div>
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-blue-900">{documentRequest.message}</p>
                    </div>
                  )}
                  {isUrgent && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                        🔴 URGENT
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Statut */}
              {documentRequest && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Statut</p>
                  <div className="flex items-center gap-2">
                    {documentRequest.status === 'pending' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                        ⏳ En attente
                      </span>
                    )}
                    {documentRequest.status === 'sent' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                        ✅ Document envoyé
                      </span>
                    )}
                    {documentRequest.status === 'received' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                        📥 Document reçu
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              {documentRequest?.status === 'pending' && (
                <div className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                  {success && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-600">{success}</p>
                    </div>
                  )}

                  {!showUploadForm ? (
                    <div className="space-y-3">
                      <Button
                        onClick={() => setShowUploadForm(true)}
                        className="w-full bg-primary hover:bg-primary/90 text-white"
                      >
                        📤 Téléverser un nouveau document
                      </Button>

                      {existingDocuments.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-2">Ou utiliser un document existant :</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {existingDocuments.map((doc) => (
                              <div
                                key={doc._id || doc.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary/40 transition-colors"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-2xl">📄</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{doc.nom}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleUseExistingDocument(doc._id || doc.id)}
                                  disabled={isLoading}
                                  className="text-xs"
                                >
                                  Utiliser
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleUploadNewDocument} className="space-y-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div>
                        <Label htmlFor="file">Fichier *</Label>
                        <Input
                          ref={fileInputRef}
                          id="file"
                          type="file"
                          onChange={handleFileSelect}
                          required
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          className="mt-1"
                        />
                        {selectedFile && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Fichier sélectionné: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="nom">Nom du document *</Label>
                        <Input
                          id="nom"
                          value={uploadData.nom}
                          onChange={(e) => setUploadData({ ...uploadData, nom: e.target.value })}
                          required
                          className="mt-1"
                          placeholder="Ex: Passeport, Contrat de travail..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description (optionnel)</Label>
                        <textarea
                          id="description"
                          value={uploadData.description}
                          onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                          placeholder="Description du document..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowUploadForm(false);
                            setSelectedFile(null);
                            setUploadData({ nom: '', description: '', categorie: 'autre' });
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                            setError(null);
                          }}
                          disabled={uploading}
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                        <Button type="submit" disabled={uploading} className="flex-1">
                          {uploading ? 'Envoi...' : 'Envoyer le document'}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Document déjà envoyé */}
              {documentRequest?.status === 'sent' && documentRequest?.document && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm font-semibold text-green-800 mb-2">✅ Document envoyé</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="font-medium text-sm">{documentRequest.document.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        Envoyé le {new Date(documentRequest.sentAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={handleOpenDossier}>
            📁 Voir le dossier
          </Button>
          <Button onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}



