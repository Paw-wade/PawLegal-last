'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { documentsAPI } from '@/lib/api';
import { DocumentPreview } from '@/components/DocumentPreview';

function Button({ children, variant = 'default', className = '', disabled, ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
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

export default function DocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadData, setUploadData] = useState({
    nom: '',
    description: '',
    categorie: 'autre'
  });
  const [previewDocument, setPreviewDocument] = useState<any | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // S'assurer que le token est stocké dans localStorage
      if (session && (session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
      }
      loadDocuments();
    }
  }, [session, status, router]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('📄 Chargement des documents pour l\'utilisateur:', session?.user?.email);
      
      // Vérifier que le token est disponible
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && session && (session.user as any)?.accessToken) {
          localStorage.setItem('token', (session.user as any).accessToken);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
        if (!token) {
          console.warn('⚠️ Aucun token trouvé pour charger les documents');
        }
      }
      
      const response = await documentsAPI.getMyDocuments();
      console.log('📄 Réponse API documents:', response.data);
      
      if (response.data.success) {
        setDocuments(response.data.documents || []);
        console.log('✅ Documents chargés:', response.data.documents?.length || 0);
      } else {
        setError('Erreur lors du chargement des documents');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des documents:', err);
      console.error('❌ Détails de l\'erreur:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        data: err.response?.data
      });
      setError(err.response?.data?.message || 'Erreur lors du chargement des documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-remplir le nom si vide
      if (!uploadData.nom) {
        setUploadData({ ...uploadData, nom: file.name });
      }
      // Effacer les erreurs précédentes
      setError(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier d'abord le fichier dans l'état, puis dans la référence
    const file = selectedFile || fileInputRef.current?.files?.[0];
    
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    if (!uploadData.nom || uploadData.nom.trim() === '') {
      setError('Veuillez saisir un nom pour le document');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('nom', uploadData.nom.trim());
      formData.append('description', uploadData.description.trim());
      formData.append('categorie', uploadData.categorie);

      const response = await documentsAPI.uploadDocument(formData);
      if (response.data.success) {
        setSuccess('Document téléversé avec succès !');
        setUploadData({ nom: '', description: '', categorie: 'autre' });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setShowUploadForm(false);
        loadDocuments();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Erreur lors du téléversement:', err);
      setError(err.response?.data?.message || 'Erreur lors du téléversement du document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId: string, nom: string) => {
    try {
      const response = await documentsAPI.downloadDocument(documentId);
      // Créer un blob et télécharger
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nom);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erreur lors du téléchargement:', err);
      setError('Erreur lors du téléchargement du document');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      return;
    }

    try {
      const response = await documentsAPI.deleteDocument(documentId);
      if (response.data.success) {
        setSuccess('Document supprimé avec succès');
        loadDocuments();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression du document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (typeMime: string) => {
    if (typeMime.includes('pdf')) return '📄';
    if (typeMime.includes('image')) return '🖼️';
    if (typeMime.includes('word') || typeMime.includes('document')) return '📝';
    if (typeMime.includes('excel') || typeMime.includes('spreadsheet')) return '📊';
    return '📎';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <Header variant="client" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mes Documents</h1>
            <p className="text-muted-foreground">Tous vos documents en un seul endroit</p>
          </div>
          <Button onClick={() => {
            if (showUploadForm) {
              // Réinitialiser le formulaire si on ferme
              setSelectedFile(null);
              setUploadData({ nom: '', description: '', categorie: 'autre' });
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              setError(null);
            }
            setShowUploadForm(!showUploadForm);
          }}>
            {showUploadForm ? 'Annuler' : '+ Téléverser un document'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {showUploadForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Téléverser un document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
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
                <p className="text-xs text-muted-foreground mt-1">
                  Types acceptés: PDF, images (JPG, PNG), Word, Excel. Taille max: 10 MB
                </p>
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
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  placeholder="Description du document..."
                />
              </div>
              <div>
                <Label htmlFor="categorie">Catégorie</Label>
                <select
                  id="categorie"
                  value={uploadData.categorie}
                  onChange={(e) => setUploadData({ ...uploadData, categorie: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                >
                  <option value="identite">Identité</option>
                  <option value="titre_sejour">Titre de séjour</option>
                  <option value="contrat">Contrat</option>
                  <option value="facture">Facture</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => {
                  setShowUploadForm(false);
                  setSelectedFile(null);
                  setUploadData({ nom: '', description: '', categorie: 'autre' });
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  setError(null);
                }} disabled={uploading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Téléversement...' : 'Téléverser'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-muted-foreground mb-4">Vous n'avez pas encore de document</p>
            <Button onClick={() => setShowUploadForm(true)}>Téléverser mon premier document</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div key={doc._id || doc.id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getFileIcon(doc.typeMime)}</span>
                    <div>
                      <h3 className="font-semibold text-lg">{doc.nom}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.taille)} • {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </div>
                {doc.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{doc.description}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPreviewDocument(doc)}
                    title="Prévisualiser"
                  >
                    👁️ Prévisualiser
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(doc._id || doc.id, doc.nom)}
                    title="Télécharger"
                  >
                    📥 Télécharger
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(doc._id || doc.id)}
                    title="Supprimer"
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal de prévisualisation */}
      {previewDocument && (
        <DocumentPreview
          document={previewDocument}
          isOpen={!!previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}

