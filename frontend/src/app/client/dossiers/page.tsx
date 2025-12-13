'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { dossiersAPI } from '@/lib/api';
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
      <Header variant="client" />

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
          <div className="grid gap-4">
            {dossiers.map((dossier) => {
              return (
                <div key={dossier._id || dossier.id} className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-primary hover:shadow-xl transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-foreground">{dossier.titre}</h3>
                      {dossier.description && (
                        <p className="text-muted-foreground mb-3 line-clamp-2">{dossier.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatutColor(dossier.statut)}`}>
                          {getStatutLabel(dossier.statut)}
                        </span>
                        {dossier.priorite && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPrioriteColor(dossier.priorite)}`}>
                            Priorité: {dossier.priorite}
                          </span>
                        )}
                        {dossier.categorie && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            {dossier.categorie.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p>Créé le : {new Date(dossier.createdAt).toLocaleDateString('fr-FR', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</p>
                        {dossier.dateEcheance && (
                          <p className="mt-1">
                            Échéance : {new Date(dossier.dateEcheance).toLocaleDateString('fr-FR', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {dossier.documents && dossier.documents.length > 0 && (
                        <span>📄 {dossier.documents.length} document{dossier.documents.length > 1 ? 's' : ''}</span>
                      )}
                      {dossier.messages && dossier.messages.length > 0 && (
                        <span>💬 {dossier.messages.length} message{dossier.messages.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <Link href={`/client/dossiers/${dossier._id || dossier.id}`}>
                      <Button variant="outline">Voir les détails</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

