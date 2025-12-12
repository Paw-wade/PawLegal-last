'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { dossiersAPI, userAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel, getPrioriteColor } from '@/lib/dossierUtils';
import { DateInput as DateInputComponent } from '@/components/ui/DateInput';

function Button({ children, variant = 'default', size = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
  };
  const sizeClasses = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>{children}</button>;
}

function Input({ className = '', type, value, onChange, ...props }: any) {
  // Pour les champs de date, utiliser le composant DateInput qui garantit le format jour/mois/année
  if (type === 'date') {
    return (
      <DateInputComponent
        value={value || ''}
        onChange={(newValue) => {
          if (onChange) {
            const syntheticEvent = {
              target: { value: newValue },
              currentTarget: { value: newValue }
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(syntheticEvent);
          }
        }}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
  
  return (
    <input
      type={type}
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
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

const categories = {
  sejour_titres: {
    label: 'Séjour et titres de séjour',
    types: [
      { value: 'premier_titre_etudiant', label: 'Demande de premier titre de séjour (étudiant)' },
      { value: 'premier_titre_salarie', label: 'Demande de premier titre de séjour (salarié)' },
      { value: 'premier_titre_vie_privée', label: 'Demande de premier titre de séjour (vie privée et familiale)' },
      { value: 'premier_titre_malade', label: 'Demande de premier titre de séjour (étranger malade)' },
      { value: 'premier_titre_retraite', label: 'Demande de premier titre de séjour (retraité)' },
      { value: 'premier_titre_visiteur', label: 'Demande de premier titre de séjour (visiteur)' },
      { value: 'renouvellement_titre', label: 'Renouvellement d\'un titre de séjour' },
      { value: 'changement_statut', label: 'Changement de statut' },
      { value: 'carte_talent', label: 'Carte Talent' },
      { value: 'carte_resident', label: 'Demande de carte de résident ou de carte de 10 ans' },
      { value: 'regularisation_travail', label: 'Régularisation par le travail' },
      { value: 'regularisation_humanitaire', label: 'Régularisation pour motifs humanitaires' },
    ]
  },
  contentieux_administratif: {
    label: 'Contentieux administratif',
    types: [
      { value: 'recours_gracieux', label: 'Recours gracieux contre un refus de titre' },
      { value: 'recours_hierarchique', label: 'Recours hiérarchique contre un refus de titre' },
      { value: 'recours_absence_reponse', label: 'Recours contentieux - Absence de réponse à une demande de titre' },
      { value: 'recours_refus_sejour', label: 'Recours contentieux - Refus de séjour' },
      { value: 'recours_refus_enregistrement', label: 'Recours contentieux - Refus d\'enregistrement de la demande' },
      { value: 'recours_oqtf', label: 'Recours contentieux - Obligation de quitter le territoire français (OQTF)' },
      { value: 'recours_irt', label: 'Recours contentieux - Interdiction de retour sur le territoire (IRT)' },
      { value: 'recours_assignation_residence', label: 'Recours contentieux - Assignation à résidence' },
      { value: 'recours_retention', label: 'Recours contentieux - Placement en rétention administrative' },
      { value: 'refere_mesures_utiles', label: 'Recours en référé - Référé mesures utiles' },
      { value: 'refere_suspension', label: 'Recours en référé - Référé Suspension et Recours au fond' },
    ]
  },
  asile: {
    label: 'Asile',
    types: [
      { value: 'demande_asile_ofpra', label: 'Demande d\'asile auprès de l\'OFPRA' },
      { value: 'preparation_entretien_ofpra', label: 'Préparation de l\'entretien OFPRA' },
      { value: 'recours_cnda', label: 'Recours devant la CNDA en cas de rejet' },
      { value: 'reouverture_reexamen', label: 'Dossiers de réouverture, réexamen' },
    ]
  },
  regroupement_familial: {
    label: 'Regroupement familial',
    types: [
      { value: 'preparation_dossier_regroupement', label: 'Préparation du dossier de regroupement familial' },
      { value: 'recours_refus_prefecture', label: 'Recours en cas de refus (préfecture)' },
      { value: 'recours_refus_consulat', label: 'Recours en cas de refus (consulat)' },
      { value: 'recours_refus_ofii', label: 'Recours en cas de refus (OFII)' },
    ]
  },
  nationalite_francaise: {
    label: 'Nationalité française',
    types: [
      { value: 'acquisition_nationalite', label: 'Demande d\'acquisition de la nationalité française' },
      { value: 'recours_refus_nationalite', label: 'Recours contre refus ou ajournement' },
      { value: 'contestation_opposition', label: 'Contestation d\'une décision d\'opposition' },
    ]
  },
  eloignement_urgence: {
    label: 'Éloignement et urgence',
    types: [
      { value: 'contestation_oqtf', label: 'Contestation d\'une OQTF' },
      { value: 'contestation_irt', label: 'Contestation d\'une interdiction de retour (IRT)' },
      { value: 'contestation_arrete_expulsion', label: 'Contestation d\'un arrêté d\'expulsion' },
      { value: 'assistance_retention', label: 'Assistance en rétention administrative' },
      { value: 'audience_jld', label: 'Audience devant le juge des libertés et de la détention (JLD)' },
    ]
  },
  autre: {
    label: 'Autre',
    types: [
      { value: 'autre', label: 'Autre type de dossier' },
    ]
  }
};

export default function AdminDossiersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Membres de l'équipe (admins/superadmins)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [clientType, setClientType] = useState<'existing' | 'new'>('existing');
  // Fonction pour obtenir la date du jour au format YYYY-MM-DD
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    userId: '',
    clientNom: '',
    clientPrenom: '',
    clientEmail: '',
    clientTelephone: '',
    titre: '',
    description: '',
    categorie: '',
    type: '',
    statut: 'en_attente',
    priorite: 'normale',
    dateEcheance: getTodayDate(),
    notes: '',
    assignedTo: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDossier, setEditingDossier] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRefuseModal, setShowRefuseModal] = useState<{ dossierId: string; dossierTitre: string } | null>(null);
  const [motifRefus, setMotifRefus] = useState('');
  const [showStatutModal, setShowStatutModal] = useState<{ dossierId: string; dossierTitre: string; currentStatut: string; newStatut: string } | null>(null);
  const [notificationMessage, setNotificationMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && (session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin') {
      router.push('/client');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (status === 'authenticated' && ((session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'superadmin')) {
      loadDossiers();
      loadUsers();
      loadTeamMembers();
    }
  }, [session, status]);

  const loadDossiers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dossiersAPI.getAllDossiers({ search: searchTerm || undefined });
      if (response.data.success) {
        setDossiers(response.data.dossiers || []);
      } else {
        setError('Erreur lors du chargement des dossiers');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des dossiers:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des dossiers');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      if (response.data.success) {
        setUtilisateurs(response.data.users || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      if (response.data.success) {
        // Filtrer pour ne garder que les admins et superadmins
        const members = (response.data.users || []).filter(
          (user: any) => user.role === 'admin' || user.role === 'superadmin'
        );
        setTeamMembers(members);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des membres de l\'équipe:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!formData.categorie) {
        setError('Veuillez sélectionner une catégorie de dossier');
        setIsLoading(false);
        return;
      }

      if (!formData.type) {
        setError('Veuillez sélectionner un type de dossier');
        setIsLoading(false);
        return;
      }

      const dossierData: any = {
        titre: formData.titre,
        description: formData.description,
        categorie: formData.categorie,
        type: formData.type,
        statut: formData.statut,
        priorite: formData.priorite,
        notes: formData.notes,
      };

      if (clientType === 'existing') {
        if (!formData.userId) {
          setError('Veuillez sélectionner un utilisateur');
          setIsLoading(false);
          return;
        }
        dossierData.userId = formData.userId;
      } else {
        if (!formData.clientNom || !formData.clientPrenom || !formData.clientEmail) {
          setError('Veuillez remplir tous les champs obligatoires du client');
          setIsLoading(false);
          return;
        }
        dossierData.clientNom = formData.clientNom;
        dossierData.clientPrenom = formData.clientPrenom;
        dossierData.clientEmail = formData.clientEmail;
        dossierData.clientTelephone = formData.clientTelephone;
      }

      if (formData.dateEcheance) {
        dossierData.dateEcheance = formData.dateEcheance;
      }

      if (formData.assignedTo) {
        dossierData.assignedTo = formData.assignedTo;
      }

      const response = await dossiersAPI.createDossier(dossierData);
      if (response.data.success) {
        setDossiers([response.data.dossier, ...dossiers]);
        setIsCreating(false);
        setFormData({
          userId: '',
          clientNom: '',
          clientPrenom: '',
          clientEmail: '',
          clientTelephone: '',
          titre: '',
          description: '',
          categorie: '',
          type: '',
          statut: 'recu',
          priorite: 'normale',
          dateEcheance: '',
          notes: '',
          assignedTo: '',
        });
        setClientType('existing');
      }
    } catch (err: any) {
      console.error('Erreur lors de la création du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors de la création du dossier');
    } finally {
      setIsLoading(false);
    }
  };


  const getCategorieLabel = (categorie: string) => {
    return categories[categorie as keyof typeof categories]?.label || categorie;
  };

  const getTypeLabel = (categorie: string, type: string) => {
    const categorieTypes = categories[categorie as keyof typeof categories]?.types || [];
    const typeObj = categorieTypes.find(t => t.value === type);
    return typeObj?.label || type;
  };

  const handleEditDossier = (dossier: any) => {
    setEditingDossier(dossier);
    setFormData({
      userId: dossier.user?._id || dossier.user || '',
      clientNom: dossier.clientNom || '',
      clientPrenom: dossier.clientPrenom || '',
      clientEmail: dossier.clientEmail || '',
      clientTelephone: dossier.clientTelephone || '',
      titre: dossier.titre || '',
      description: dossier.description || '',
      categorie: dossier.categorie || '',
      type: dossier.type || '',
      statut: dossier.statut || 'en_attente',
      priorite: dossier.priorite || 'normale',
      dateEcheance: dossier.dateEcheance ? new Date(dossier.dateEcheance).toISOString().split('T')[0] : '',
      notes: dossier.notes || '',
      assignedTo: dossier.assignedTo?._id || dossier.assignedTo || '',
    });
    setClientType(dossier.user ? 'existing' : 'new');
    setIsCreating(true);
  };

  const handleUpdateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDossier) return;

    setIsLoading(true);
    setError(null);

    try {
      const updateData: any = {
        titre: formData.titre,
        description: formData.description,
        categorie: formData.categorie,
        type: formData.type,
        statut: formData.statut,
        priorite: formData.priorite,
        notes: formData.notes,
      };

      if (formData.dateEcheance) {
        updateData.dateEcheance = formData.dateEcheance;
      }

      if (formData.assignedTo) {
        updateData.assignedTo = formData.assignedTo;
      } else {
        updateData.assignedTo = null;
      }

      const response = await dossiersAPI.updateDossier(editingDossier._id || editingDossier.id, updateData);
      if (response.data.success) {
        await loadDossiers();
        setEditingDossier(null);
        setIsCreating(false);
        setFormData({
          userId: '',
          clientNom: '',
          clientPrenom: '',
          clientEmail: '',
          clientTelephone: '',
          titre: '',
          description: '',
          categorie: '',
          type: '',
          statut: 'recu',
          priorite: 'normale',
          dateEcheance: '',
          notes: '',
          assignedTo: '',
        });
        setClientType('existing');
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du dossier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDossier = async (dossierId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dossiersAPI.deleteDossier(dossierId);
      if (response.data.success) {
        await loadDossiers();
        setShowDeleteConfirm(null);
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression du dossier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeStatut = async (dossierId: string, newStatut: string) => {
    // Trouver le dossier pour obtenir son titre et statut actuel
    const dossier = dossiers.find(d => (d._id || d.id) === dossierId);
    if (dossier && dossier.statut !== newStatut) {
      setShowStatutModal({
        dossierId,
        dossierTitre: dossier.titre,
        currentStatut: dossier.statut,
        newStatut
      });
      setNotificationMessage(''); // Réinitialiser le message
    }
  };

  const confirmChangeStatut = async () => {
    if (!showStatutModal) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // Construire l'objet de mise à jour en excluant les valeurs undefined
      const updateData: any = { 
        statut: showStatutModal.newStatut
      };
      
      // Ajouter notificationMessage seulement s'il n'est pas vide
      if (notificationMessage && notificationMessage.trim()) {
        updateData.notificationMessage = notificationMessage.trim();
      }
      
      console.log('📤 Envoi de la mise à jour:', JSON.stringify(updateData, null, 2));
      console.log('📤 Statut:', showStatutModal.newStatut);
      console.log('📤 Notification message:', notificationMessage);
      
      const response = await dossiersAPI.updateDossier(showStatutModal.dossierId, updateData);
      if (response.data.success) {
        await loadDossiers();
        setShowStatutModal(null);
        setNotificationMessage('');
      }
    } catch (err: any) {
      console.error('Erreur lors du changement de statut:', err);
      console.error('Détails de l\'erreur:', {
        status: err.response?.status,
        data: err.response?.data,
        errors: err.response?.data?.errors
      });
      
      // Afficher les erreurs de validation de manière plus détaillée
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errorMessages = err.response.data.errors.map((e: any) => `${e.param}: ${e.msg}`).join(', ');
        setError(`Erreurs de validation: ${errorMessages}`);
      } else {
        setError(err.response?.data?.message || 'Erreur lors du changement de statut');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignDossier = async (dossierId: string, assignedTo: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dossiersAPI.updateDossier(dossierId, { assignedTo: assignedTo || null });
      if (response.data.success) {
        await loadDossiers();
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'assignation du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'assignation du dossier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptDossier = async (dossierId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await dossiersAPI.updateDossier(dossierId, { statut: 'en_cours' });
      if (response.data.success) {
        await loadDossiers();
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'acceptation du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'acceptation du dossier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefuseDossier = async () => {
    if (!showRefuseModal) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await dossiersAPI.updateDossier(showRefuseModal.dossierId, { 
        statut: 'refuse',
        motifRefus: motifRefus.trim() || 'Dossier refusé par l\'administrateur',
        notificationMessage: motifRefus.trim() || `Votre dossier "${showRefuseModal.dossierTitre}" a été refusé par l'administrateur.`
      });
      if (response.data.success) {
        await loadDossiers();
        setShowRefuseModal(null);
        setMotifRefus('');
      }
    } catch (err: any) {
      console.error('Erreur lors du refus du dossier:', err);
      setError(err.response?.data?.message || 'Erreur lors du refus du dossier');
    } finally {
      setIsLoading(false);
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

  if (!session || ((session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header variant="admin" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Gestion des Dossiers</h1>
            <p className="text-muted-foreground text-sm">
              Gérez tous les dossiers des clients
              {dossiers.filter((d: any) => d.statut === 'recu' || d.statut === 'en_attente_onboarding').length > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  ({dossiers.filter((d: any) => d.statut === 'recu' || d.statut === 'en_attente_onboarding').length} en attente)
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)} className="shadow-md hover:shadow-lg transition-shadow">
            + Créer un dossier
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Formulaire de création - Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingDossier ? 'Modifier le dossier' : 'Créer un nouveau dossier'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingDossier(null);
                    setFormData({
                      userId: '',
                      clientNom: '',
                      clientPrenom: '',
                      clientEmail: '',
                      clientTelephone: '',
                      titre: '',
                      description: '',
                      categorie: '',
                      type: '',
                      statut: 'recu',
                      priorite: 'normale',
                      dateEcheance: '',
                      notes: '',
                      assignedTo: '',
                    });
                    setClientType('existing');
                  }}
                  className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={editingDossier ? handleUpdateDossier : handleSubmit} className="p-6 space-y-5">
              {/* Type de client */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <Label className="mb-3 block text-sm font-semibold">Type de client</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md border-2 transition-colors hover:bg-gray-100" style={{ borderColor: clientType === 'existing' ? '#FF6600' : '#e5e7eb' }}>
                    <input
                      type="radio"
                      name="clientType"
                      value="existing"
                      checked={clientType === 'existing'}
                      onChange={(e) => setClientType(e.target.value as 'existing' | 'new')}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm font-medium">Utilisateur inscrit</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md border-2 transition-colors hover:bg-gray-100" style={{ borderColor: clientType === 'new' ? '#FF6600' : '#e5e7eb' }}>
                    <input
                      type="radio"
                      name="clientType"
                      value="new"
                      checked={clientType === 'new'}
                      onChange={(e) => setClientType(e.target.value as 'existing' | 'new')}
                      className="h-4 w-4 text-primary"
                    />
                    <span className="text-sm font-medium">Utilisateur non inscrit</span>
                  </label>
                </div>
              </div>

              {/* Sélection utilisateur existant */}
              {clientType === 'existing' && (
                <div>
                  <Label htmlFor="userId">Sélectionner un utilisateur *</Label>
                  <select
                    id="userId"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    required
                  >
                    <option value="">-- Sélectionner un utilisateur --</option>
                    {utilisateurs.map((user) => (
                      <option key={user._id || user.id} value={user._id || user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Formulaire utilisateur non inscrit */}
              {clientType === 'new' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientNom">Nom *</Label>
                    <Input
                      id="clientNom"
                      value={formData.clientNom}
                      onChange={(e) => setFormData({ ...formData, clientNom: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientPrenom">Prénom *</Label>
                    <Input
                      id="clientPrenom"
                      value={formData.clientPrenom}
                      onChange={(e) => setFormData({ ...formData, clientPrenom: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientEmail">Email *</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientTelephone">Téléphone</Label>
                    <Input
                      id="clientTelephone"
                      type="tel"
                      value={formData.clientTelephone}
                      onChange={(e) => setFormData({ ...formData, clientTelephone: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Informations du dossier */}
              <div className="border-t pt-5">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Informations du dossier</h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="titre">Titre du dossier *</Label>
                    <Input
                      id="titre"
                      value={formData.titre}
                      onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                      required
                      className="mt-1"
                      placeholder="Ex: Demande de titre de séjour"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1"
                      rows={3}
                      placeholder="Description détaillée du dossier..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="categorie">Catégorie de dossier *</Label>
                      <select
                        id="categorie"
                        value={formData.categorie}
                        onChange={(e) => setFormData({ ...formData, categorie: e.target.value, type: '' })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                        required
                      >
                        <option value="">-- Sélectionner une catégorie --</option>
                        {Object.entries(categories).map(([key, cat]) => (
                          <option key={key} value={key}>{cat.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="type">Type de dossier *</Label>
                      <select
                        id="type"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                        required
                        disabled={!formData.categorie}
                      >
                        <option value="">-- Sélectionner un type --</option>
                        {formData.categorie && categories[formData.categorie as keyof typeof categories]?.types.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">

                    <div>
                      <Label htmlFor="statut">Statut</Label>
                      <select
                        id="statut"
                        value={formData.statut}
                        onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                      >
                        <option value="recu">Reçu</option>
                        <option value="accepte">Accepté</option>
                        <option value="refuse">Refusé</option>
                        <option value="en_attente_onboarding">En attente d'onboarding (RDV)</option>
                        <option value="en_cours_instruction">En cours d'instruction (constitution dossier)</option>
                        <option value="pieces_manquantes">Pièces manquantes (relance client)</option>
                        <option value="dossier_complet">Dossier Complet</option>
                        <option value="depose">Déposé</option>
                        <option value="reception_confirmee">Réception confirmée</option>
                        <option value="complement_demande">Complément demandé (avec date limite)</option>
                        <option value="decision_defavorable">Décision défavorable</option>
                        <option value="communication_motifs">Communication des Motifs</option>
                        <option value="recours_preparation">Recours en préparation</option>
                        <option value="refere_mesures_utiles">Référé Mesures Utiles</option>
                        <option value="refere_suspension_rep">Référé suspension et REP</option>
                        <option value="gain_cause">Gain de cause</option>
                        <option value="rejet">Rejet</option>
                        <option value="decision_favorable">Décision favorable</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="priorite">Priorité</Label>
                      <select
                        id="priorite"
                        value={formData.priorite}
                        onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                      >
                        <option value="basse">Basse</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Haute</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dateEcheance">Date d'échéance</Label>
                    <Input
                      id="dateEcheance"
                      type="date"
                      value={formData.dateEcheance}
                      onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes internes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="mt-1"
                      rows={2}
                      placeholder="Notes internes pour l'équipe..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="assignedTo">Assigner à un membre de l'équipe</Label>
                    <select
                      id="assignedTo"
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      <option value="">-- Non assigné --</option>
                      {teamMembers.map((member) => (
                        <option key={member._id || member.id} value={member._id || member.id}>
                          {member.firstName} {member.lastName} ({member.email}) - {member.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Optionnel : assignez ce dossier à un membre de l'équipe pour le suivi
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 justify-end mt-6">
                <Button type="button" variant="outline" onClick={() => {
                  setIsCreating(false);
                  setEditingDossier(null);
                  setFormData({
                    userId: '',
                    clientNom: '',
                    clientPrenom: '',
                    clientEmail: '',
                    clientTelephone: '',
                    titre: '',
                    description: '',
                    categorie: '',
                    type: '',
                    statut: 'recu',
                    priorite: 'normale',
                    dateEcheance: '',
                    notes: '',
                    assignedTo: '',
                  });
                  setClientType('existing');
                }} disabled={isLoading}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (editingDossier ? 'Mise à jour...' : 'Création...') : (editingDossier ? 'Mettre à jour' : 'Créer le dossier')}
                </Button>
              </div>
            </form>
            </div>
          </div>
        )}

        {/* Liste des dossiers */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          {/* Barre de recherche et filtres */}
          <div className="mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:max-w-md">
              <input
                type="text"
                placeholder="🔍 Rechercher un dossier..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setTimeout(() => loadDossiers(), 500);
                }}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-background px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <Button onClick={loadDossiers} variant="outline" size="sm" className="whitespace-nowrap">
              🔄 Actualiser
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des dossiers...</p>
            </div>
          ) : dossiers.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📁</span>
              </div>
              <p className="text-muted-foreground text-lg font-medium mb-2">
                {searchTerm ? 'Aucun dossier ne correspond à votre recherche' : 'Aucun dossier trouvé'}
              </p>
              {!searchTerm && (
                <p className="text-sm text-muted-foreground">Commencez par créer votre premier dossier</p>
              )}
            </div>
          ) : (
            <>
              {/* Statistiques rapides */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-yellow-700 font-semibold mb-1 uppercase tracking-wide">En attente</p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {dossiers.filter((d: any) => d.statut === 'recu' || d.statut === 'en_attente_onboarding').length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-blue-700 font-semibold mb-1 uppercase tracking-wide">En cours</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {dossiers.filter((d: any) => d.statut === 'en_cours_instruction' || d.statut === 'dossier_complet').length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-green-700 font-semibold mb-1 uppercase tracking-wide">Favorables</p>
                  <p className="text-2xl font-bold text-green-900">
                    {dossiers.filter((d: any) => d.statut === 'decision_favorable' || d.statut === 'gain_cause').length}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs text-red-700 font-semibold mb-1 uppercase tracking-wide">Défavorables</p>
                  <p className="text-2xl font-bold text-red-900">
                    {dossiers.filter((d: any) => d.statut === 'decision_defavorable' || d.statut === 'refuse' || d.statut === 'rejet').length}
                  </p>
                </div>
              </div>

              {/* Liste des dossiers en cartes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {dossiers.map((dossier) => (
                  <div
                    key={dossier._id || dossier.id}
                    className={`border rounded-xl p-5 hover:shadow-xl transition-all duration-200 bg-white ${
                      dossier.statut === 'recu' || dossier.statut === 'en_attente_onboarding'
                        ? 'border-l-4 border-l-yellow-500 border-t border-r border-b border-gray-200'
                        : dossier.statut === 'decision_favorable' || dossier.statut === 'gain_cause'
                        ? 'border-l-4 border-l-green-500 border-t border-r border-b border-gray-200'
                        : dossier.statut === 'decision_defavorable' || dossier.statut === 'refuse' || dossier.statut === 'rejet'
                        ? 'border-l-4 border-l-red-500 border-t border-r border-b border-gray-200'
                        : 'border-l-4 border-l-blue-500 border-t border-r border-b border-gray-200'
                    }`}
                  >
                    {/* En-tête de la carte */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-bold text-base text-foreground mb-1 line-clamp-2 leading-tight">
                          {dossier.titre}
                        </h3>
                        {dossier.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {dossier.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStatutColor(dossier.statut)}`}>
                          {getStatutLabel(dossier.statut)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getPrioriteColor(dossier.priorite)}`}>
                          {dossier.priorite}
                        </span>
                      </div>
                    </div>

                    {/* Informations du client */}
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">👤</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          {dossier.user ? (
                            <>
                              <p className="font-semibold text-sm text-foreground truncate">
                                {dossier.user.firstName} {dossier.user.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{dossier.user.email}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-sm text-foreground truncate">
                                {dossier.clientPrenom} {dossier.clientNom}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{dossier.clientEmail}</p>
                              <span className="text-xs text-orange-600 font-medium">(Non inscrit)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Informations du dossier */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground mt-0.5">📋</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-xs">{getCategorieLabel(dossier.categorie || 'autre')}</p>
                          {dossier.type && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {getTypeLabel(dossier.categorie || 'autre', dossier.type)}
                            </p>
                          )}
                        </div>
                      </div>

                      {dossier.assignedTo ? (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">👨‍💼</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-xs truncate">
                              {dossier.assignedTo.firstName} {dossier.assignedTo.lastName}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              dossier.assignedTo.role === 'superadmin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {dossier.assignedTo.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>👨‍💼</span>
                          <span className="italic">Non assigné</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>📅</span>
                        <span>
                          {dossier.createdAt ? new Date(dossier.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : '-'}
                        </span>
                      </div>

                      {dossier.dateEcheance && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-orange-600">⏰</span>
                          <span className="text-orange-600 font-medium">
                            Échéance: {new Date(dossier.dateEcheance).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-gray-200 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditDossier(dossier)}
                          className="flex-1 text-xs h-8"
                        >
                          ✏️ Modifier
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(dossier._id || dossier.id)}
                          className="text-xs h-8 px-3"
                        >
                          🗑️
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={dossier.statut}
                          onChange={(e) => handleChangeStatut(dossier._id || dossier.id, e.target.value)}
                          className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          disabled={isLoading}
                        >
                          <option value="recu">Reçu</option>
                          <option value="accepte">Accepté</option>
                          <option value="refuse">Refusé</option>
                          <option value="en_attente_onboarding">En attente d'onboarding</option>
                          <option value="en_cours_instruction">En cours d'instruction</option>
                          <option value="pieces_manquantes">Pièces manquantes</option>
                          <option value="dossier_complet">Dossier Complet</option>
                          <option value="depose">Déposé</option>
                          <option value="reception_confirmee">Réception confirmée</option>
                          <option value="complement_demande">Complément demandé</option>
                          <option value="decision_defavorable">Décision défavorable</option>
                          <option value="communication_motifs">Communication des Motifs</option>
                          <option value="recours_preparation">Recours en préparation</option>
                          <option value="refere_mesures_utiles">Référé Mesures Utiles</option>
                          <option value="refere_suspension_rep">Référé suspension et REP</option>
                          <option value="gain_cause">Gain de cause</option>
                          <option value="rejet">Rejet</option>
                          <option value="decision_favorable">Décision favorable</option>
                        </select>
                        <select
                          value={dossier.assignedTo?._id || dossier.assignedTo || ''}
                          onChange={(e) => handleAssignDossier(dossier._id || dossier.id, e.target.value)}
                          className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                          disabled={isLoading}
                        >
                          <option value="">Non assigné</option>
                          {teamMembers.map((member) => (
                            <option key={member._id || member.id} value={member._id || member.id}>
                              {member.firstName} {member.lastName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!isLoading && dossiers.length > 0 && (
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{dossiers.length}</span> dossier{dossiers.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
            <p className="text-muted-foreground mb-6">
              Êtes-vous sûr de vouloir supprimer ce dossier ? Cette action est irréversible et une notification sera envoyée au client.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} disabled={isLoading}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteDossier(showDeleteConfirm)} disabled={isLoading}>
                {isLoading ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de refus de dossier */}
      {showRefuseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Refuser le dossier</h3>
            <p className="text-muted-foreground mb-4">
              Vous êtes sur le point de refuser le dossier : <strong>{showRefuseModal.dossierTitre}</strong>
            </p>
            <div className="mb-4">
              <Label htmlFor="motifRefus" className="mb-2 block">
                Motif du refus (optionnel)
              </Label>
              <Textarea
                id="motifRefus"
                value={motifRefus}
                onChange={(e) => setMotifRefus(e.target.value)}
                placeholder="Expliquez la raison du refus..."
                rows={4}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Une notification sera envoyée au client avec ce motif (ou un message par défaut si vide).
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => {
                setShowRefuseModal(null);
                setMotifRefus('');
              }} disabled={isLoading}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleRefuseDossier} disabled={isLoading}>
                {isLoading ? 'Refus en cours...' : 'Refuser le dossier'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de changement de statut avec message */}
      {showStatutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Changer le statut du dossier</h3>
            <p className="text-muted-foreground mb-4">
              Dossier : <strong>{showStatutModal.dossierTitre}</strong>
            </p>
            <div className="mb-4">
              <p className="text-sm mb-2">
                <span className="font-medium">Statut actuel :</span> {getStatutLabel(showStatutModal.currentStatut)}
              </p>
              <p className="text-sm mb-4">
                <span className="font-medium">Nouveau statut :</span> <span className="text-primary font-semibold">{getStatutLabel(showStatutModal.newStatut)}</span>
              </p>
            </div>
            <div className="mb-4">
              <Label htmlFor="notificationMessage" className="mb-2 block">
                Message de notification pour l'utilisateur *
              </Label>
              <Textarea
                id="notificationMessage"
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                placeholder={`Ex: Votre dossier "${showStatutModal.dossierTitre}" a été mis à jour. Le statut est maintenant "${getStatutLabel(showStatutModal.newStatut)}".`}
                rows={5}
                className="w-full"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Ce message sera envoyé à l'utilisateur dans sa notification sur le dashboard.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => {
                setShowStatutModal(null);
                setNotificationMessage('');
              }} disabled={isLoading}>
                Annuler
              </Button>
              <Button onClick={confirmChangeStatut} disabled={isLoading || !notificationMessage.trim()}>
                {isLoading ? 'Mise à jour...' : 'Confirmer le changement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
