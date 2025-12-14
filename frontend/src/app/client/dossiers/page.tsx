'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dossiersAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel, getPrioriteColor } from '@/lib/dossierUtils';

// Mapping des catégories pour l'affichage
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
    ]
  },
  asile: {
    label: 'Asile',
    types: [
      { value: 'demande_asile', label: 'Demande d\'asile' },
      { value: 'recours_cnda', label: 'Recours CNDA' },
    ]
  },
  regroupement_familial: {
    label: 'Regroupement familial',
    types: [
      { value: 'preparation_dossier_regroupement', label: 'Préparation du dossier de regroupement familial' },
    ]
  },
  nationalite_francaise: {
    label: 'Nationalité française',
    types: [
      { value: 'acquisition_nationalite', label: 'Acquisition de la nationalité française' },
    ]
  },
  eloignement_urgence: {
    label: 'Éloignement et urgence',
    types: [
      { value: 'contestation_oqtf', label: 'Contestation d\'une OQTF' },
    ]
  },
  autre: {
    label: 'Autre',
    types: [
      { value: 'autre', label: 'Autre demande' },
    ]
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

function Button({ children, variant = 'default', size = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  const sizeClasses = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>{children}</button>;
}

export default function DossiersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Vérifier si l'utilisateur a un token même sans session
    const token = localStorage.getItem('token');
    
    if (status === 'loading') {
      return; // Attendre que NextAuth termine le chargement
    }

    // Si pas de session et pas de token, rediriger vers la connexion
    if (status === 'unauthenticated' && !token) {
      router.push('/auth/signin');
      return;
    }

    // Si on a une session, charger les dossiers
    if (status === 'authenticated' && session) {
      // S'assurer que le token est stocké dans localStorage
      if ((session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
      }
      loadDossiers();
    } else if (token) {
      // Si on a un token mais pas de session, charger quand même les dossiers
      loadDossiers();
    }
  }, [session, status, router]);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      if (session || localStorage.getItem('token')) {
        loadDossiers();
      }
    }, 30000); // Rafraîchir toutes les 30 secondes

    return () => clearInterval(interval);
  }, [session]);

  const loadDossiers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('📁 Chargement des dossiers pour l\'utilisateur:', session?.user?.email);
      
      // Vérifier que le token est disponible
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && session && (session.user as any)?.accessToken) {
          localStorage.setItem('token', (session.user as any).accessToken);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
        if (!token) {
          console.warn('⚠️ Aucun token trouvé pour charger les dossiers');
        }
      }
      
      const response = await dossiersAPI.getMyDossiers();
      console.log('📁 Réponse API dossiers complète:', response);
      console.log('📁 Réponse API dossiers data:', response.data);
      
      if (response.data.success) {
        const dossiersList = response.data.dossiers || [];
        console.log('✅ Dossiers chargés:', dossiersList.length);
        console.log('✅ Liste des dossiers:', dossiersList);
        setDossiers(dossiersList);
      } else {
        console.error('❌ Réponse API indique un échec:', response.data);
        setError(response.data.message || 'Erreur lors du chargement des dossiers');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des dossiers:', err);
      console.error('❌ Détails de l\'erreur:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        data: err.response?.data
      });
      setError(err.response?.data?.message || 'Erreur lors du chargement des dossiers');
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

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mes Dossiers</h1>
            <p className="text-muted-foreground">Gérez tous vos dossiers en un seul endroit</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDossiers} disabled={isLoading}>
              Actualiser
            </Button>
            <Link href="/dossiers/create">
              <Button>Nouveau dossier</Button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des dossiers...</p>
          </div>
        ) : dossiers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-muted-foreground mb-4">Vous n'avez pas encore de dossier</p>
            <Link href="/dossiers/create">
              <Button>Créer mon premier dossier</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Liste des dossiers en cartes - Style identique au dashboard admin */}
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
                        {dossier.titre || 'Sans titre'}
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
                      {dossier.priorite && (
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getPrioriteColor(dossier.priorite)}`}>
                          {dossier.priorite}
                        </span>
                      )}
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
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {dossier.documents && dossier.documents.length > 0 && (
                          <span>📄 {dossier.documents.length}</span>
                        )}
                        {dossier.messages && dossier.messages.length > 0 && (
                          <span>💬 {dossier.messages.length}</span>
                        )}
                      </div>
                      <Link href={`/client/dossiers/${dossier._id || dossier.id}`}>
                        <Button variant="outline" size="sm" className="text-xs h-8">
                          Voir les détails
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {dossiers.length > 0 && (
              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{dossiers.length}</span> dossier{dossiers.length > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

