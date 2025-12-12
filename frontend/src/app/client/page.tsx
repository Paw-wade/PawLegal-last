'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { ReservationWidget } from '@/components/ReservationWidget';
import { ReservationBadge } from '@/components/ReservationBadge';
import { NotificationBadge } from '@/components/NotificationBadge';
import { MessageNotificationModal } from '@/components/MessageNotificationModal';
import { dossiersAPI, documentsAPI, appointmentsAPI, userAPI, messagesAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel } from '@/lib/dossierUtils';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

function ClientDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [stats, setStats] = useState({
    dossiers: 0,
    documents: 0,
    rendezVous: 0,
    dossiersEnCours: 0,
  });
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [recentDossiers, setRecentDossiers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [unreadMessage, setUnreadMessage] = useState<any>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [hasCheckedMessages, setHasCheckedMessages] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  const [hasToken, setHasToken] = useState(false);

  // Vérifier si on a un token dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      setHasToken(!!token);
    }
  }, []);

  useEffect(() => {
    // Vérifier le mode impersonation
    const impersonateParam = searchParams?.get('impersonate');
    const impersonateUserId = localStorage.getItem('impersonateUserId');
    
    if (impersonateParam === 'true' && impersonateUserId) {
      setIsImpersonating(true);
      loadImpersonatedUser(impersonateUserId);
      return;
    }

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

    // Si on a une session, vérifier le profil et le rôle
    if (session) {
      // S'assurer que le token est stocké dans localStorage
      if ((session.user as any)?.accessToken && typeof window !== 'undefined') {
        const accessToken = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', accessToken);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
      }

      // Si le profil n'est pas complet, rediriger vers la complétion
      // Mais seulement si on n'a pas de token (pour éviter les boucles)
      if (!(session.user as any).profilComplete && !token) {
        router.push('/auth/complete-profile');
        return;
      }
      
      // Si admin et pas en mode impersonation, rediriger vers l'espace admin
      if (((session.user as any)?.role === 'admin' || (session.user as any)?.role === 'superadmin') && !isImpersonating) {
        // Ne pas rediriger si on est en mode impersonation
        if (!impersonateUserId) {
          router.push('/admin');
          return;
        }
      }

      // Charger les statistiques depuis l'API
      loadStats();
      loadUserProfile();
      checkUnreadMessages();
    } else if (token) {
      // Si on a un token mais pas de session, charger quand même les stats
      loadStats();
      loadUserProfile();
      checkUnreadMessages();
    }
  }, [session, status, router, searchParams, isImpersonating]);

  const loadImpersonatedUser = async (userId: string) => {
    try {
      const response = await userAPI.getUserById(userId);
      if (response.data.success) {
        setImpersonatedUser(response.data.user);
        // Charger les stats pour cet utilisateur
        loadStatsForUser(userId);
        loadUserProfileForUser(userId);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'utilisateur impersonné:', error);
    }
  };

  const loadStatsForUser = async (userId: string) => {
    setIsLoading(true);
    try {
      // Utiliser l'API admin avec l'ID de l'utilisateur impersonné
      const dossiersResponse = await dossiersAPI.getAllDossiers({ userId });
      if (dossiersResponse.data.success) {
        const dossiers = dossiersResponse.data.dossiers || [];
        setStats(prev => ({
          ...prev,
          dossiers: dossiers.length,
          dossiersEnCours: dossiers.filter((d: any) => {
            const statut = d.statut;
            return statut === 'recu' || statut === 'accepte' || statut === 'en_attente_onboarding' || 
                   statut === 'en_cours_instruction' || statut === 'pieces_manquantes' || 
                   statut === 'dossier_complet' || statut === 'depose' || statut === 'en_instruction';
          }).length,
        }));
        setRecentDossiers(dossiers.slice(0, 5));
      }

      // Charger les documents via l'API admin
      const documentsResponse = await documentsAPI.getAllDocuments({ userId });
      if (documentsResponse.data.success) {
        setStats(prev => ({
          ...prev,
          documents: documentsResponse.data.documents?.length || 0,
        }));
      }

      // Charger les rendez-vous via l'API admin
      const appointmentsResponse = await appointmentsAPI.getAllAppointments({ userId });
      if (appointmentsResponse.data.success) {
        const appointments = appointmentsResponse.data.data || appointmentsResponse.data.appointments || [];
        setStats(prev => ({
          ...prev,
          rendezVous: appointments.length,
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProfileForUser = async (userId: string) => {
    try {
      const response = await userAPI.getUserById(userId);
      if (response.data.success) {
        setUserProfile(response.data.user);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  };

  const stopImpersonating = () => {
    localStorage.removeItem('impersonateUserId');
    localStorage.removeItem('impersonateAdminId');
    setIsImpersonating(false);
    setImpersonatedUser(null);
    router.push('/admin');
  };

  // Vérifier les messages non lus à la connexion
  const checkUnreadMessages = async () => {
    if (hasCheckedMessages) return;
    
    try {
      const response = await messagesAPI.getMessages({ type: 'unread' });
      if (response.data.success && response.data.messages && response.data.messages.length > 0) {
        // Prendre le message le plus récent
        const latestMessage = response.data.messages[0];
        setUnreadMessage(latestMessage);
        setShowMessageModal(true);
        setHasCheckedMessages(true);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des messages:', error);
    }
  };

  // Rafraîchissement automatique toutes les 30 secondes pour les mises à jour en temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      if (session || localStorage.getItem('token')) {
        loadStats();
      }
    }, 30000); // Rafraîchir toutes les 30 secondes

    return () => clearInterval(interval);
  }, [session]);

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token && session && (session.user as any)?.accessToken) {
        localStorage.setItem('token', (session.user as any).accessToken);
      }

      const response = await userAPI.getProfile();
      if (response.data.success) {
        const profile = response.data.user || response.data.data;
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  };

  // Calculer les jours restants jusqu'à l'échéance du titre de séjour
  const calculateDaysRemaining = () => {
    if (!userProfile?.dateExpiration) return null;
    const expirationDate = new Date(userProfile.dateExpiration);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    const diffTime = expirationDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const loadStats = async () => {
    setIsLoading(true);
    try {
      console.log('📊 Chargement des statistiques pour l\'utilisateur:', session?.user?.email);
      
      // Vérifier que le token est disponible
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && session && (session.user as any)?.accessToken) {
          localStorage.setItem('token', (session.user as any).accessToken);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
      }

      // Charger les dossiers
      try {
        const dossiersResponse = await dossiersAPI.getMyDossiers();
        if (dossiersResponse.data.success) {
          const dossiers = dossiersResponse.data.dossiers || [];
          setStats(prev => ({
            ...prev,
            dossiers: dossiers.length,
            dossiersEnCours: dossiers.filter((d: any) => {
              const statut = d.statut;
              // Nouveaux statuts en cours
              return statut === 'recu' || 
                     statut === 'accepte' || 
                     statut === 'en_attente_onboarding' || 
                     statut === 'en_cours_instruction' || 
                     statut === 'pieces_manquantes' || 
                     statut === 'dossier_complet' || 
                     statut === 'depose' || 
                     statut === 'reception_confirmee' || 
                     statut === 'complement_demande' || 
                     statut === 'communication_motifs' || 
                     statut === 'recours_preparation' || 
                     statut === 'refere_mesures_utiles' || 
                     statut === 'refere_suspension_rep' ||
                     // Anciens statuts pour compatibilité
                     statut === 'en_cours' || 
                     statut === 'en_attente' ||
                     statut === 'en_revision';
            }).length
          }));
          // Garder les 5 dossiers les plus récents
          setRecentDossiers(dossiers.slice(0, 5));
        }
      } catch (err) {
        console.error('❌ Erreur lors du chargement des dossiers:', err);
      }

      // Charger les documents
      try {
        const documentsResponse = await documentsAPI.getMyDocuments();
        if (documentsResponse.data.success) {
          setStats(prev => ({
            ...prev,
            documents: documentsResponse.data.documents?.length || 0
          }));
        }
      } catch (err) {
        console.error('❌ Erreur lors du chargement des documents:', err);
      }

      // Charger les rendez-vous
      try {
        const appointmentsResponse = await appointmentsAPI.getMyAppointments();
        if (appointmentsResponse.data.success) {
          const appointments = appointmentsResponse.data.data || appointmentsResponse.data.appointments || [];
          setStats(prev => ({
            ...prev,
            rendezVous: appointments.length
          }));
        }
      } catch (err) {
        console.error('❌ Erreur lors du chargement des rendez-vous:', err);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des statistiques:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions pour calculer les valeurs utilisateur
  const getDisplayUser = () => {
    if (isImpersonating && impersonatedUser) return impersonatedUser;
    return session?.user || {};
  };

  const getUserName = () => {
    if (isImpersonating && impersonatedUser) {
      const name = `${impersonatedUser?.firstName || ''} ${impersonatedUser?.lastName || ''}`.trim();
      return name || 'Utilisateur';
    }
    return session?.user?.name || 'Utilisateur';
  };

  const getUserEmail = () => {
    if (isImpersonating && impersonatedUser) {
      return impersonatedUser?.email || '';
    }
    return session?.user?.email || '';
  };

  // Pré-calculer les valeurs qui seront utilisées dans le JSX (après toutes les fonctions, avant les return conditionnels)
  const daysRemainingValue = calculateDaysRemaining();
  const hasTitreInfoValue = userProfile?.numeroTitre && userProfile?.dateExpiration;
  const displayUser = getDisplayUser();
  const userName = getUserName();
  const userEmail = getUserEmail();

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

  // Si pas de session mais on a un token, afficher quand même (utilisateur vient de s'inscrire)
  if (!session && !hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header Professionnel */}
      <Header variant="client" />

      <main className="container mx-auto px-4 py-8">
        {/* Banner d'impersonation */}
        <div id="dashboard-top" className="scroll-mt-20"></div>
        {isImpersonating && impersonatedUser && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👤</span>
                <div>
                  <p className="font-semibold text-yellow-900">
                    Mode impersonation actif
                  </p>
                  <p className="text-sm text-yellow-700">
                    Vous visualisez le dashboard de <strong>{userName}</strong> ({userEmail})
                  </p>
                </div>
              </div>
              <Button 
                onClick={stopImpersonating}
                variant="outline"
                className="border-yellow-500 text-yellow-700 hover:bg-yellow-100"
              >
                Quitter l'impersonation
              </Button>
            </div>
          </div>
        )}

        {/* En-tête de bienvenue */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Bienvenue, {userName.split(' ')[0]}
              </h1>
              <p className="text-muted-foreground text-lg">Gérez vos dossiers et suivez l'avancement de vos démarches</p>
            </div>
            
            {/* Navigation rapide vers le dashboard admin si l'utilisateur est admin */}
            {((session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'superadmin') && (
              <Link href="/admin">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border-2 border-orange-200 hover:border-orange-400 hover:shadow-lg transition-all duration-200 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <span className="text-xl">⚙️</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Vue Admin</p>
                      <p className="text-xs text-orange-700">Accéder au dashboard administrateur</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}
            
            {/* Badge de renouvellement du titre de séjour */}
            {hasTitreInfoValue && daysRemainingValue !== null && (
              <div className={`rounded-xl shadow-lg p-4 border-2 min-w-[280px] max-w-[320px] ${
                daysRemainingValue < 0 
                  ? 'bg-red-50 border-red-300' 
                  : daysRemainingValue <= 30 
                  ? 'bg-orange-50 border-orange-300' 
                  : daysRemainingValue <= 90 
                  ? 'bg-yellow-50 border-yellow-300' 
                  : 'bg-green-50 border-green-300'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    daysRemainingValue < 0 
                      ? 'bg-red-100' 
                      : daysRemainingValue <= 30 
                      ? 'bg-orange-100' 
                      : daysRemainingValue <= 90 
                      ? 'bg-yellow-100' 
                      : 'bg-green-100'
                  }`}>
                    <span className="text-2xl">
                      {daysRemainingValue < 0 ? '⚠️' : daysRemainingValue <= 30 ? '⏰' : daysRemainingValue <= 90 ? '📅' : '✅'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Renouvellement du titre de séjour</p>
                    {daysRemainingValue < 0 ? (
                      <p className="text-lg font-bold text-red-600">
                        Expiré depuis {Math.abs(daysRemainingValue)} jour{Math.abs(daysRemainingValue) > 1 ? 's' : ''}
                      </p>
                    ) : daysRemainingValue === 0 ? (
                      <p className="text-lg font-bold text-orange-600">
                        Expire aujourd'hui
                      </p>
                    ) : (
                      <p className="text-lg font-bold text-foreground">
                        {daysRemainingValue} jour{daysRemainingValue > 1 ? 's' : ''} restant{daysRemainingValue > 1 ? 's' : ''}
                      </p>
                    )}
                    {userProfile?.dateExpiration && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Échéance: {new Date(userProfile.dateExpiration).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {daysRemainingValue !== null && daysRemainingValue <= 90 && (
                  <div className="mt-3 pt-3 border-t border-current/20">
                    <Link href="/dossiers/create">
                      <Button 
                        variant="outline" 
                        className={`w-full text-sm ${
                          daysRemainingValue < 0 
                            ? 'border-red-300 text-red-600 hover:bg-red-100' 
                            : daysRemainingValue <= 30 
                            ? 'border-orange-300 text-orange-600 hover:bg-orange-100' 
                            : 'border-yellow-300 text-yellow-600 hover:bg-yellow-100'
                        }`}
                      >
                        {daysRemainingValue < 0 ? '⚠️ Demander le renouvellement' : '📋 Préparer le renouvellement'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Statistiques - Design professionnel et chaleureux avec accès direct */}
        <div id="dossiers-section" className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 scroll-mt-20">
          {/* Badge Dossiers avec lien direct - Fusion des deux badges */}
          <Link href="/client/dossiers" className="group">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-primary hover:shadow-lg hover:border-primary/80 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <span className="text-2xl">📁</span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground mb-0 group-hover:text-primary transition-colors">{stats.dossiers}</p>
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Mes Dossiers</h3>
              <p className="text-xs text-muted-foreground mb-3">Total de vos dossiers</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-xs font-semibold group-hover:bg-blue-500/20 transition-colors">
                  {stats.dossiersEnCours} en cours
                </span>
                <span className="text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Accéder →</span>
              </div>
            </div>
          </Link>

          {/* Badge Documents avec lien direct */}
          <div id="documents-section" className="scroll-mt-20">
            <Link href="/client/documents" className="group">
              <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500 hover:shadow-lg hover:border-green-600 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <span className="text-2xl">📄</span>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-foreground mb-0 group-hover:text-green-600 transition-colors">{stats.documents}</p>
                  </div>
                </div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Documents</h3>
                <p className="text-xs text-muted-foreground mb-3">Documents disponibles</p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-muted-foreground">Tous vos documents</span>
                  <span className="text-green-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Accéder →</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Actions rapides - Seulement les sections sans doublons */}
        <div id="rendez-vous-section" className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 scroll-mt-20">
          <div className="group">
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-blue-200 hover:border-blue-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📅</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors mb-1">Rendez-vous</h3>
                  <p className="text-sm text-muted-foreground">Gérez vos rendez-vous</p>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-blue-200">
                <Button 
                  variant="outline" 
                  className="flex-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  onClick={() => setIsWidgetOpen(true)}
                >
                  Prendre RDV
                </Button>
                <Link href="/client/rendez-vous" className="flex-1">
                  <Button variant="outline" className="w-full text-xs border-blue-300 text-blue-600 hover:bg-blue-50">
                    Voir mes RDV →
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div id="temoignages-section" className="scroll-mt-20">
            <Link href="/client/temoignages" className="group">
              <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-purple-200 hover:border-purple-400 hover:scale-105">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <span className="text-3xl">⭐</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-purple-600 transition-colors mb-1">Témoignage</h3>
                    <p className="text-sm text-muted-foreground">Partagez votre expérience</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-purple-200">
                  <span className="text-xs font-medium text-purple-600">Accéder →</span>
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <span className="text-purple-600 text-sm">→</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          <Link href="/client/compte" className="group">
            <div className="bg-gradient-to-br from-white to-indigo-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-indigo-200 hover:border-indigo-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">👤</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 transition-colors mb-1">Mon compte</h3>
                  <p className="text-sm text-muted-foreground">Gérez vos informations</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-indigo-200">
                <span className="text-xs font-medium text-indigo-600">Accéder →</span>
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <span className="text-indigo-600 text-sm">→</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Badge de notification - UNIQUE, pas de répétition */}
          <NotificationBadge variant="dashboard" />
        </div>

        {/* Dernières activités */}
        <div className="bg-gradient-to-br from-white to-primary/5 rounded-2xl shadow-lg p-8 border border-primary/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Dernières activités</h2>
            </div>
            <Link href="/client/dossiers" className="text-sm text-primary hover:underline font-semibold">
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Chargement des activités...</p>
              </div>
            ) : recentDossiers.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">📋</span>
                </div>
                <p className="text-muted-foreground mb-4 font-medium">Aucune activité récente</p>
                <Link href="/dossiers/create">
                  <Button className="bg-gradient-to-r from-primary to-primary/70 hover:from-primary/90 hover:to-primary/80 shadow-md">
                    Créer mon premier dossier
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDossiers.map((dossier) => {
                  const formatDate = (date: string | Date) => {
                    const d = new Date(date);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - d.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) return "Aujourd'hui";
                    if (diffDays === 1) return "Hier";
                    if (diffDays < 7) return `Il y a ${diffDays} jours`;
                    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
                    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
                  };

                  return (
                    <Link key={dossier._id || dossier.id} href={`/client/dossiers/${dossier._id || dossier.id}`}>
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-white border-2 border-primary/20 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-xl">📁</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground mb-1 line-clamp-1">{dossier.titre}</p>
                          <p className="text-sm text-muted-foreground">
                            Créé {formatDate(dossier.createdAt)}
                          </p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getStatutColor(dossier.statut)}`}>
                          {getStatutLabel(dossier.statut)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Modal de réservation */}
      {isWidgetOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsWidgetOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <ReservationWidget 
              isOpen={isWidgetOpen} 
              onClose={() => setIsWidgetOpen(false)}
            />
          </div>
        </div>
      )}
      
      {/* Badge flottant pour ouvrir le widget - toujours visible quand fermé, ou au scroll */}
      <ReservationBadge 
        onOpen={() => setIsWidgetOpen(true)}
        alwaysVisible={!isWidgetOpen}
      />

      {/* Modal de notification de message */}
      <MessageNotificationModal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false);
          setUnreadMessage(null);
        }}
        message={unreadMessage}
      />
    </div>
  );
}

export default function ClientDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    }>
      <ClientDashboardContent />
    </Suspense>
  );
}
