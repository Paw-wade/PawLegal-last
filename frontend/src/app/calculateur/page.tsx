'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Footer } from '@/components/layout/Footer';
import { userAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

function Input({ className = '', ...props }: any) {
  return (
    <input
      className={`flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ className = '', children, ...props }: any) {
  return (
    <label className={`text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block ${className}`} {...props}>
      {children}
    </label>
  );
}

function Select({ className = '', children, ...props }: any) {
  return (
    <select
      className={`flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

// Types de titres de séjour
const typesTitres = [
  { value: 'etudiant', label: 'Étudiant' },
  { value: 'salarie', label: 'Salarié' },
  { value: 'vie_privee_familiale', label: 'Vie privée et familiale' },
  { value: 'visiteur', label: 'Visiteur' },
  { value: 'talent', label: 'Passeport Talent' },
  { value: 'commercant', label: 'Commerçant / Artisan' },
  { value: 'retraite', label: 'Retraité' },
  { value: 'resident', label: 'Carte de résident (10 ans)' },
  { value: 'autre', label: 'Autre' },
];

// Types de décisions défavorables
const typesDecisions = [
  { value: 'refus_titre', label: 'Refus de titre de séjour', delai: 30 },
  { value: 'oqtf', label: 'OQTF (Obligation de quitter le territoire)', delai: 30 },
  { value: 'irt', label: 'IRT (Interdiction de retour)', delai: 30 },
  { value: 'refus_visa', label: 'Refus de visa', delai: 2 },
  { value: 'refus_cnda', label: 'Rejet CNDA (Asile)', delai: 1 },
  { value: 'retrait_titre', label: 'Retrait de titre', delai: 30 },
  { value: 'refus_renouvellement', label: 'Refus de renouvellement', delai: 30 },
  { value: 'refus_enregistrement', label: 'Refus d\'enregistrement de demande', delai: 15 },
];

// Préfectures
const prefectures = [
  'Paris', 'Seine-Saint-Denis', 'Hauts-de-Seine', 'Val-de-Marne', 'Seine-et-Marne',
  'Yvelines', 'Essonne', 'Val-d\'Oise', 'Bouches-du-Rhône', 'Rhône', 'Nord', 'Loire',
  'Gironde', 'Haute-Garonne', 'Isère', 'Bas-Rhin', 'Hérault', 'Alpes-Maritimes',
  'Autre'
];

// Informations sur les titres
const infosTitres: Record<string, any> = {
  etudiant: {
    description: 'Titre de séjour pour les étudiants étrangers inscrits dans un établissement d\'enseignement supérieur en France.',
    duree: [1, 2],
    conditions: [
      'Inscription dans un établissement d\'enseignement supérieur reconnu',
      'Justificatifs de ressources suffisantes',
      'Assurance maladie',
      'Justificatif de logement'
    ],
    documents: [
      'Passeport en cours de validité',
      'Justificatif d\'inscription',
      'Justificatifs de ressources',
      'Assurance maladie',
      'Justificatif de logement'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  },
  salarie: {
    description: 'Titre de séjour pour les salariés étrangers ayant un contrat de travail en France.',
    duree: [1, 4],
    conditions: [
      'Contrat de travail d\'au moins 12 mois',
      'Salaire au moins égal au SMIC',
      'Autorisation de travail (si nécessaire)'
    ],
    documents: [
      'Passeport en cours de validité',
      'Contrat de travail',
      'Fiches de paie',
      'Justificatif de logement'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  },
  vie_privee_familiale: {
    description: 'Titre de séjour pour les personnes ayant des liens familiaux en France (conjoint, parent d\'enfant français, etc.).',
    duree: [1, 10],
    conditions: [
      'Lien familial avec un Français ou un résident',
      'Justificatifs de vie commune',
      'Ressources suffisantes'
    ],
    documents: [
      'Passeport en cours de validité',
      'Acte de mariage / livret de famille',
      'Justificatifs de vie commune',
      'Justificatifs de ressources'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  },
  visiteur: {
    description: 'Titre de séjour pour les personnes qui souhaitent séjourner en France sans exercer d\'activité professionnelle.',
    duree: [1],
    conditions: [
      'Ressources suffisantes et stables',
      'Assurance maladie',
      'Justificatif de logement'
    ],
    documents: [
      'Passeport en cours de validité',
      'Justificatifs de ressources',
      'Assurance maladie',
      'Justificatif de logement'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  },
  talent: {
    description: 'Passeport Talent pour les personnes hautement qualifiées, investisseurs, artistes, chercheurs, etc.',
    duree: [1, 4],
    conditions: [
      'Compétences reconnues dans un domaine spécifique',
      'Projet professionnel validé',
      'Ressources suffisantes'
    ],
    documents: [
      'Passeport en cours de validité',
      'Diplômes et qualifications',
      'Contrat de travail ou projet professionnel',
      'Justificatifs de ressources'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  },
  resident: {
    description: 'Carte de résident de 10 ans, titre de séjour permanent pour les personnes ayant résidé légalement en France pendant plusieurs années.',
    duree: [10],
    conditions: [
      'Résidence légale et continue en France',
      'Intégration républicaine',
      'Ressources suffisantes'
    ],
    documents: [
      'Passeport en cours de validité',
      'Titres de séjour précédents',
      'Justificatifs de résidence',
      'Justificatifs de ressources'
    ],
    delaiRenouvellement: { min: 2, max: 4 },
    delaiPremiereDemande: 2
  }
};

export default function CalculateurPage() {
  const { data: session, status } = useSession();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  
  // Fonction pour obtenir la date du jour au format YYYY-MM-DD
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    typeTitre: '',
    typeDemande: 'premiere', // 'premiere' ou 'renouvellement'
    prefecture: '',
    dateDelivrance: getTodayDate(),
    dateExpiration: getTodayDate(),
    dateDecision: getTodayDate(),
    natureDecision: '',
    dureeTitre: '',
    situation: '' // 'demande', 'contentieux_visa', 'contentieux_titre'
  });

  const [calculs, setCalculs] = useState<any>(null);

  useEffect(() => {
    calculerDelais();
  }, [formData]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadUserProfile();
    }
  }, [session, status]);

  const loadUserProfile = async () => {
    setIsLoadingProfile(true);
    try {
      // S'assurer que le token est disponible
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && session && (session.user as any)?.accessToken) {
          localStorage.setItem('token', (session.user as any).accessToken);
        }
      }

      const response = await userAPI.getProfile();
      if (response.data.success) {
        setUserProfile(response.data.user);
        // Préremplir le formulaire avec les informations du profil
        if (response.data.user) {
          const user = response.data.user;
          setFormData(prev => ({
            ...prev,
            prefecture: user.prefecture || prev.prefecture,
            dateDelivrance: user.dateDelivrance ? new Date(user.dateDelivrance).toISOString().split('T')[0] : prev.dateDelivrance,
            dateExpiration: user.dateExpiration ? new Date(user.dateExpiration).toISOString().split('T')[0] : prev.dateExpiration,
          }));
        }
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement du profil:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const calculerDelais = () => {
    if ((formData.situation === 'contentieux_visa' || formData.situation === 'contentieux_titre') && formData.dateDecision && formData.natureDecision) {
      const decision = typesDecisions.find(d => d.value === formData.natureDecision);
      if (decision) {
        const dateDecision = new Date(formData.dateDecision);
        const dateLimite = new Date(dateDecision);
        dateLimite.setDate(dateLimite.getDate() + decision.delai);
        
        const aujourdhui = new Date();
        const joursRestants = Math.ceil((dateLimite.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
        
        setCalculs({
          type: 'contentieux',
          delai: decision.delai,
          dateDecision: dateDecision,
          dateLimite: dateLimite,
          joursRestants: joursRestants,
          typeRecours: getTypeRecours(formData.natureDecision),
          urgence: joursRestants <= 7
        });
      }
    } else if (formData.situation === 'demande' && formData.typeTitre) {
      const infoTitre = infosTitres[formData.typeTitre];
      if (infoTitre) {
        let calculsResult: any = {
          type: 'demande',
          infoTitre: infoTitre
        };

        if (formData.typeDemande === 'premiere') {
          // Pour une première demande, on indique qu'elle peut être déposée dès maintenant
          calculsResult.premiereDemande = {
            peutDeposer: true,
            message: 'Vous pouvez déposer votre première demande dès maintenant.',
            delaiRecommandé: infoTitre.delaiPremiereDemande
          };
        } else if (formData.typeDemande === 'renouvellement' && formData.dateExpiration) {
          const dateExpiration = new Date(formData.dateExpiration);
          const aujourdhui = new Date();
          
          // Date recommandée pour déposer (2 à 4 mois avant expiration)
          const dateRecommandeeMin = new Date(dateExpiration);
          dateRecommandeeMin.setMonth(dateRecommandeeMin.getMonth() - infoTitre.delaiRenouvellement.max);
          
          const dateRecommandeeMax = new Date(dateExpiration);
          dateRecommandeeMax.setMonth(dateRecommandeeMax.getMonth() - infoTitre.delaiRenouvellement.min);
          
          // Date limite (jour d'expiration)
          const dateLimite = new Date(dateExpiration);
          
          const joursAvantExpiration = Math.ceil((dateExpiration.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
          
          calculsResult.renouvellement = {
            dateExpiration: dateExpiration,
            dateRecommandeeMin: dateRecommandeeMin,
            dateRecommandeeMax: dateRecommandeeMax,
            dateLimite: dateLimite,
            joursAvantExpiration: joursAvantExpiration,
            periodeRecommandee: `${infoTitre.delaiRenouvellement.min} à ${infoTitre.delaiRenouvellement.max} mois avant expiration`,
            risqueRupture: joursAvantExpiration < 60,
            enRetard: joursAvantExpiration < 0
          };
        }

        setCalculs(calculsResult);
      }
    } else {
      setCalculs(null);
    }
  };

  const getTypeRecours = (natureDecision: string): string => {
    const recoursMap: Record<string, string> = {
      'refus_titre': 'Recours contentieux devant le tribunal administratif',
      'oqtf': 'Recours contentieux devant le tribunal administratif + Référé suspension si urgence',
      'irt': 'Recours contentieux devant le tribunal administratif',
      'refus_visa': 'Recours gracieux ou hiérarchique auprès du consulat',
      'refus_cnda': 'Recours en cassation devant le Conseil d\'État',
      'retrait_titre': 'Recours contentieux devant le tribunal administratif',
      'refus_renouvellement': 'Recours contentieux devant le tribunal administratif',
      'refus_enregistrement': 'Recours contentieux devant le tribunal administratif'
    };
    return recoursMap[natureDecision] || 'Recours contentieux devant le tribunal administratif';
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateCourte = (date: Date): string => {
    return date.toLocaleDateString('fr-FR');
  };

  const getAlertColor = (jours: number): string => {
    if (jours < 0) return 'text-red-600 bg-red-50 border-red-500';
    if (jours <= 7) return 'text-orange-600 bg-orange-50 border-orange-500';
    if (jours <= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-500';
    return 'text-green-600 bg-green-50 border-green-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/10">
      {/* Header */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary">Paw Legal</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
              <Link href="/domaines" className="hover:text-primary transition-colors">Domaines</Link>
              <Link href="/services" className="hover:text-primary transition-colors">Services</Link>
              <Link href="/calculateur" className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md">Calculateur</Link>
              <Link href="/faq" className="hover:text-primary transition-colors">FAQ</Link>
              <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/auth/signin"><Button variant="ghost">Connexion</Button></Link>
              <Link href="/auth/signup"><Button>Créer un compte</Button></Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Colonne 1 : Informations du profil utilisateur (à gauche, largeur réduite) */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary/20 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">👤</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">Mon Profil</h2>
              </div>

              {!session ? (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🔒</div>
                  <p className="text-muted-foreground mb-4 text-sm">
                    Connectez-vous pour voir vos informations préremplies
                  </p>
                  <Link href="/auth/signin">
                    <Button className="w-full">Se connecter</Button>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-3">
                    Ou{' '}
                    <Link href="/auth/signup" className="text-primary hover:underline">
                      créez un compte
                    </Link>
                  </p>
                </div>
              ) : isLoadingProfile ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground text-sm">Chargement du profil...</p>
                </div>
              ) : userProfile ? (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="text-primary text-xl font-bold">
                          {userProfile.firstName?.[0]?.toUpperCase() || 'U'}
                          {userProfile.lastName?.[0]?.toUpperCase() || ''}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">
                          {userProfile.firstName} {userProfile.lastName}
                        </h3>
                        <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs">📧</span>
                        <span className="text-xs font-semibold text-blue-800">Email</span>
                      </div>
                      <p className="text-xs text-blue-900">{userProfile.email || 'Non renseigné'}</p>
                    </div>

                    {userProfile.phone && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">📞</span>
                          <span className="text-xs font-semibold text-green-800">Téléphone</span>
                        </div>
                        <p className="text-xs text-green-900">{userProfile.phone}</p>
                      </div>
                    )}

                    {userProfile.dateDelivrance && (
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">📅</span>
                          <span className="text-xs font-semibold text-purple-800">Date de délivrance</span>
                        </div>
                        <p className="text-xs text-purple-900">
                          {new Date(userProfile.dateDelivrance).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}

                    {userProfile.dateExpiration && (
                      <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">⏰</span>
                          <span className="text-xs font-semibold text-orange-800">Date d'expiration</span>
                        </div>
                        <p className="text-xs text-orange-900">
                          {new Date(userProfile.dateExpiration).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        {(() => {
                          const expiration = new Date(userProfile.dateExpiration);
                          const aujourdhui = new Date();
                          const joursRestants = Math.ceil((expiration.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
                          if (joursRestants < 0) {
                            return <p className="text-xs text-red-600 font-medium mt-1">⚠️ Expiré depuis {Math.abs(joursRestants)} jour{Math.abs(joursRestants) > 1 ? 's' : ''}</p>;
                          } else if (joursRestants <= 60) {
                            return <p className="text-xs text-orange-600 font-medium mt-1">⚠️ {joursRestants} jour{joursRestants > 1 ? 's' : ''} restant{joursRestants > 1 ? 's' : ''}</p>;
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {userProfile.typeTitre && (
                      <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">📄</span>
                          <span className="text-xs font-semibold text-indigo-800">Type de titre</span>
                        </div>
                        <p className="text-xs text-indigo-900">{userProfile.typeTitre}</p>
                      </div>
                    )}

                    {userProfile.prefecture && (
                      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">🏛️</span>
                          <span className="text-xs font-semibold text-yellow-800">Préfecture</span>
                        </div>
                        <p className="text-xs text-yellow-900">{userProfile.prefecture}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <Link href="/client/compte">
                      <Button variant="outline" className="w-full text-xs">
                        Modifier mon profil →
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">❌</div>
                  <p className="text-muted-foreground text-sm mb-4">
                    Impossible de charger votre profil
                  </p>
                  <Button variant="outline" onClick={loadUserProfile} className="w-full text-xs">
                    Réessayer
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Colonne 2 : Informations sur le titre de séjour */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary/20 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">Nature du calcul</h2>
              </div>

              <form className="space-y-6">
                {/* Badges de choix */}
                <div className="space-y-4">
                  <Label className="text-base font-bold">Sélectionnez le type de calcul :</Label>
                  <div className="flex flex-wrap gap-3">
                    {/* Badge Dépôt de titre de séjour */}
                    <button
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        situation: 'demande',
                        natureDecision: '',
                        dateDecision: ''
                      })}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                        formData.situation === 'demande'
                          ? 'bg-blue-500 text-white shadow-lg scale-105'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-2 border-blue-300'
                      }`}
                    >
                      <span className="text-lg">📄</span>
                      <span>Dépôt de titre de séjour</span>
                    </button>

                    {/* Badge Recours contre refus de visa */}
                    <button
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        situation: 'contentieux_visa',
                        typeDemande: '',
                        typeTitre: ''
                      })}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                        formData.situation === 'contentieux_visa'
                          ? 'bg-orange-500 text-white shadow-lg scale-105'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-2 border-orange-300'
                      }`}
                    >
                      <span className="text-lg">✈️</span>
                      <span>Recours contre un refus de visa</span>
                    </button>

                    {/* Badge Recours concernant le titre de séjour */}
                    <button
                      type="button"
                      onClick={() => setFormData({ 
                        ...formData, 
                        situation: 'contentieux_titre',
                        typeDemande: '',
                        typeTitre: ''
                      })}
                      className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                        formData.situation === 'contentieux_titre'
                          ? 'bg-red-500 text-white shadow-lg scale-105'
                          : 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-300'
                      }`}
                    >
                      <span className="text-lg">⚖️</span>
                      <span>Recours concernant le titre de séjour</span>
                    </button>
                  </div>
                </div>

                {/* Champs pour Dépôt de titre de séjour */}
                {formData.situation === 'demande' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="typeDemande">Type de demande *</Label>
                      <Select
                        id="typeDemande"
                        value={formData.typeDemande}
                        onChange={(e) => setFormData({ ...formData, typeDemande: e.target.value })}
                        required
                      >
                        <option value="">-- Sélectionner --</option>
                        <option value="premiere">Première demande</option>
                        <option value="renouvellement">Renouvellement</option>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="typeTitre">Type de titre de séjour *</Label>
                      <Select
                        id="typeTitre"
                        value={formData.typeTitre}
                        onChange={(e) => setFormData({ ...formData, typeTitre: e.target.value })}
                        required
                      >
                        <option value="">-- Sélectionner --</option>
                        {typesTitres.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prefecture">Préfecture compétente</Label>
                      <Select
                        id="prefecture"
                        value={formData.prefecture}
                        onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                      >
                        <option value="">-- Sélectionner --</option>
                        {prefectures.map((pref) => (
                          <option key={pref} value={pref}>{pref}</option>
                        ))}
                      </Select>
                    </div>

                    {formData.typeDemande === 'renouvellement' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="dateExpiration">Date d'expiration du titre actuel *</Label>
                          <Input
                            id="dateExpiration"
                            type="date"
                            value={formData.dateExpiration}
                            onChange={(e) => setFormData({ ...formData, dateExpiration: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dateDelivrance">Date de délivrance</Label>
                          <Input
                            id="dateDelivrance"
                            type="date"
                            value={formData.dateDelivrance}
                            onChange={(e) => setFormData({ ...formData, dateDelivrance: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="dureeTitre">Durée du titre actuel</Label>
                          <Select
                            id="dureeTitre"
                            value={formData.dureeTitre}
                            onChange={(e) => setFormData({ ...formData, dureeTitre: e.target.value })}
                          >
                            <option value="">-- Sélectionner --</option>
                            <option value="1">1 an</option>
                            <option value="2">2 ans</option>
                            <option value="4">4 ans</option>
                            <option value="10">10 ans</option>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Champs pour Recours contre refus de visa */}
                {formData.situation === 'contentieux_visa' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="natureDecision_visa">Nature de la décision *</Label>
                      <Select
                        id="natureDecision_visa"
                        value={formData.natureDecision}
                        onChange={(e) => setFormData({ ...formData, natureDecision: e.target.value })}
                        required
                      >
                        <option value="">-- Sélectionner --</option>
                        <option value="refus_visa">Refus de visa</option>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateDecision_visa">Date de la décision *</Label>
                      <Input
                        id="dateDecision_visa"
                        type="date"
                        value={formData.dateDecision}
                        onChange={(e) => setFormData({ ...formData, dateDecision: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prefecture_visa">Consulat / Autorité compétente</Label>
                      <Select
                        id="prefecture_visa"
                        value={formData.prefecture}
                        onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                      >
                        <option value="">-- Sélectionner --</option>
                        {prefectures.map((pref) => (
                          <option key={pref} value={pref}>{pref}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                {/* Champs pour Recours concernant le titre de séjour */}
                {formData.situation === 'contentieux_titre' && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label htmlFor="natureDecision_titre">Nature de la décision *</Label>
                      <Select
                        id="natureDecision_titre"
                        value={formData.natureDecision}
                        onChange={(e) => setFormData({ ...formData, natureDecision: e.target.value })}
                        required
                      >
                        <option value="">-- Sélectionner --</option>
                        {typesDecisions.filter(d => d.value !== 'refus_visa').map((decision) => (
                          <option key={decision.value} value={decision.value}>{decision.label}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dateDecision_titre">Date de la décision *</Label>
                      <Input
                        id="dateDecision_titre"
                        type="date"
                        value={formData.dateDecision}
                        onChange={(e) => setFormData({ ...formData, dateDecision: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prefecture_titre">Préfecture / Autorité compétente</Label>
                      <Select
                        id="prefecture_titre"
                        value={formData.prefecture}
                        onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })}
                      >
                        <option value="">-- Sélectionner --</option>
                        {prefectures.map((pref) => (
                          <option key={pref} value={pref}>{pref}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Colonne 3 : Explications */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-primary/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-xl">ℹ️</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">Explications</h2>
              </div>

              {!formData.typeTitre && formData.situation === 'demande' && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📚</div>
                  <p className="text-muted-foreground">
                    Sélectionnez un type de titre pour voir les informations détaillées
                  </p>
                </div>
              )}

              {formData.situation === 'contentieux_visa' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="font-semibold mb-2 text-blue-800">Délai de recours pour refus de visa</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Le délai de recours contre un refus de visa est de <strong>2 mois</strong> à compter de la notification de la décision.
                    </p>
                    <ul className="space-y-2 text-sm text-blue-700">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Recours gracieux ou hiérarchique auprès du consulat</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span>Recours contentieux devant le tribunal administratif</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h3 className="font-semibold mb-2 text-purple-800">Conseils pratiques</h3>
                    <ul className="space-y-2 text-sm text-purple-700">
                      <li>• Déposez votre recours le plus tôt possible</li>
                      <li>• Conservez tous les justificatifs de votre demande</li>
                      <li>• Consultez un avocat spécialisé si le délai est court</li>
                      <li>• Le recours gracieux peut être une première étape avant le recours contentieux</li>
                    </ul>
                  </div>
                </div>
              )}

              {formData.situation === 'contentieux_titre' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="font-semibold mb-2 text-blue-800">Délais de recours</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Les délais de recours varient selon le type de décision :
                    </p>
                    <ul className="space-y-2 text-sm text-blue-700">
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Rejet CNDA :</strong> 1 mois</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Refus d'enregistrement :</strong> 15 jours</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span>•</span>
                        <span><strong>Autres décisions :</strong> 30 jours</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h3 className="font-semibold mb-2 text-purple-800">Procédures d'urgence</h3>
                    <p className="text-sm text-purple-700 mb-2">
                      En cas d'urgence, vous pouvez engager :
                    </p>
                    <ul className="space-y-1 text-sm text-purple-700">
                      <li>• Référé suspension</li>
                      <li>• Référé liberté</li>
                      <li>• Référé mesures utiles</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h3 className="font-semibold mb-2 text-green-800">Conseils pratiques</h3>
                    <ul className="space-y-2 text-sm text-green-700">
                      <li>• Déposez votre recours le plus tôt possible</li>
                      <li>• Conservez tous les justificatifs</li>
                      <li>• Consultez un avocat spécialisé si le délai est court</li>
                      <li>• En cas de délai dépassé, un recours en annulation peut encore être possible</li>
                    </ul>
                  </div>
                </div>
              )}

              {formData.typeTitre && infosTitres[formData.typeTitre] && (
                <div className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                    <h3 className="font-semibold mb-2 text-primary">Description</h3>
                    <p className="text-sm text-foreground">
                      {infosTitres[formData.typeTitre].description}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h3 className="font-semibold mb-2 text-blue-800">Durées possibles</h3>
                    <p className="text-sm text-blue-700">
                      {infosTitres[formData.typeTitre].duree.join(', ')} an{infosTitres[formData.typeTitre].duree.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h3 className="font-semibold mb-2 text-green-800">Conditions légales</h3>
                    <ul className="space-y-1 text-sm text-green-700">
                      {infosTitres[formData.typeTitre].conditions.map((condition: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span>•</span>
                          <span>{condition}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                    <h3 className="font-semibold mb-2 text-purple-800">Documents nécessaires</h3>
                    <ul className="space-y-1 text-sm text-purple-700">
                      {infosTitres[formData.typeTitre].documents.map((doc: string, index: number) => (
                        <li key={index} className="flex items-start gap-2">
                          <span>•</span>
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                    <h3 className="font-semibold mb-2 text-orange-800">Délais légaux</h3>
                    <ul className="space-y-2 text-sm text-orange-700">
                      <li>
                        <strong>Première demande :</strong> {infosTitres[formData.typeTitre].delaiPremiereDemande} mois avant le début
                      </li>
                      <li>
                        <strong>Renouvellement :</strong> {infosTitres[formData.typeTitre].delaiRenouvellement.min} à {infosTitres[formData.typeTitre].delaiRenouvellement.max} mois avant expiration
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="font-semibold mb-2 text-gray-800">Conseils pratiques</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>• Anticipez votre renouvellement pour éviter la perte de droits</li>
                      <li>• Préparez vos documents à l'avance</li>
                      <li>• Vérifiez les délais de traitement de votre préfecture</li>
                      <li>• En cas de retard, déposez immédiatement même si le délai est dépassé</li>
                    </ul>
                  </div>

                  <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                    <h3 className="font-semibold mb-2 text-indigo-800">Textes officiels</h3>
                    <ul className="space-y-1 text-sm text-indigo-700">
                      <li>
                        <a href="https://www.service-public.fr/particuliers/vosdroits/F1205" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                          • Service-public.fr - Titres de séjour
                        </a>
                      </li>
                      <li>
                        <a href="https://www.legifrance.gouv.fr/codes/id/LEGITEXT000006070158" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-900">
                          • Code de l'entrée et du séjour
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

