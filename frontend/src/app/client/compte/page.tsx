'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { userAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', disabled = false, ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
}

function Input({ className = '', ...props }: any) {
  return (
    <input
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ className = '', children, ...props }: any) {
  return (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props}>
      {children}
    </label>
  );
}

export default function ComptePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'profil' | 'password'>('profil');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Données du profil
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateNaissance: '',
    lieuNaissance: '',
    nationalite: '',
    sexe: '',
    numeroEtranger: '',
    numeroTitre: '',
    typeTitre: '',
    dateDelivrance: '',
    dateExpiration: '',
    adressePostale: '',
    ville: '',
    codePostal: '',
    pays: '',
  });

  // Données pour le changement de mot de passe
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && !(session.user as any).profilComplete) {
      router.push('/auth/complete-profile');
    } else if (session && ((session.user as any)?.role === 'admin' || (session.user as any)?.role === 'superadmin')) {
      router.push('/admin');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      loadProfile();
    }
  }, [status]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const response = await userAPI.getProfile();
      if (response.data.success) {
        const user = response.data.user || response.data.data;
        setProfileData({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || '',
          dateNaissance: user.dateNaissance ? new Date(user.dateNaissance).toISOString().split('T')[0] : '',
          lieuNaissance: user.lieuNaissance || '',
          nationalite: user.nationalite || '',
          sexe: user.sexe || '',
          numeroEtranger: user.numeroEtranger || '',
          numeroTitre: user.numeroTitre || '',
          typeTitre: user.typeTitre || '',
          dateDelivrance: user.dateDelivrance ? new Date(user.dateDelivrance).toISOString().split('T')[0] : '',
          dateExpiration: user.dateExpiration ? new Date(user.dateExpiration).toISOString().split('T')[0] : '',
          adressePostale: user.adressePostale || '',
          ville: user.ville || '',
          codePostal: user.codePostal || '',
          pays: user.pays || 'France',
        });
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement du profil:', error);
      setError('Erreur lors du chargement du profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await userAPI.updateProfile(profileData);
      if (response.data.success) {
        setSuccess('Profil mis à jour avec succès');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      setIsSaving(false);
      return;
    }

    try {
      const response = await userAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.data.success) {
        setSuccess('Mot de passe modifié avec succès');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      {/* Header */}
      <Header 
        variant="client" 
        navItems={[
          { href: '/client', label: 'Dashboard' },
          { href: '/client/dossiers', label: 'Mes dossiers' },
          { href: '/client/rendez-vous', label: 'Rendez-vous' },
          { href: '/client/documents', label: 'Documents' },
          { href: '/client/temoignages', label: 'Témoignage' },
          { href: '/calculateur', label: 'Calculateur', highlight: true },
        ]}
      />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* En-tête amélioré */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-2xl">
                {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Mon compte
              </h1>
              <p className="text-muted-foreground text-lg">Gérez vos informations personnelles et vos paramètres de sécurité</p>
            </div>
          </div>
        </div>

        {/* Onglets améliorés */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-2 inline-flex gap-2">
          <button
            onClick={() => setActiveTab('profil')}
            className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === 'profil'
                ? 'bg-primary text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>👤</span>
              <span>Informations personnelles</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
              activeTab === 'password'
                ? 'bg-primary text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🔒</span>
              <span>Mot de passe</span>
            </span>
          </button>
        </div>

        {/* Messages d'erreur et de succès améliorés */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg shadow-sm animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Contenu des onglets */}
        {activeTab === 'profil' && (
          <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-8 py-6 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <span className="text-3xl">👤</span>
                <span>Informations personnelles</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-2">Mettez à jour vos informations de profil</p>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-8 space-y-8">
              {/* Informations de base */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📋</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Informations de base</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-semibold">Prénom *</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      required
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Votre prénom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-semibold">Nom *</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      required
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Votre nom"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      required
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="votre@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-semibold">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-border"></div>

              {/* Informations personnelles */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🆔</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Informations personnelles</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="dateNaissance" className="text-sm font-semibold">Date de naissance</Label>
                    <Input
                      id="dateNaissance"
                      type="date"
                      value={profileData.dateNaissance}
                      onChange={(e) => setProfileData({ ...profileData, dateNaissance: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lieuNaissance" className="text-sm font-semibold">Lieu de naissance</Label>
                    <Input
                      id="lieuNaissance"
                      type="text"
                      value={profileData.lieuNaissance}
                      onChange={(e) => setProfileData({ ...profileData, lieuNaissance: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Ville, Pays"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="nationalite" className="text-sm font-semibold">Nationalité</Label>
                    <Input
                      id="nationalite"
                      type="text"
                      value={profileData.nationalite}
                      onChange={(e) => setProfileData({ ...profileData, nationalite: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Ex: Française, Algérienne..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sexe" className="text-sm font-semibold">Sexe</Label>
                    <select
                      id="sexe"
                      value={profileData.sexe}
                      onChange={(e) => setProfileData({ ...profileData, sexe: e.target.value })}
                      className="mt-1 flex h-11 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors"
                    >
                      <option value="">Sélectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-border"></div>

              {/* Informations de séjour */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🛂</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Informations de séjour</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numeroEtranger" className="text-sm font-semibold">Numéro d'étranger</Label>
                  <Input
                    id="numeroEtranger"
                    type="text"
                    value={profileData.numeroEtranger}
                    onChange={(e) => setProfileData({ ...profileData, numeroEtranger: e.target.value })}
                    className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    placeholder="Ex: 12AB34567"
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="numeroTitre" className="text-sm font-semibold">Numéro de titre</Label>
                    <Input
                      id="numeroTitre"
                      type="text"
                      value={profileData.numeroTitre}
                      onChange={(e) => setProfileData({ ...profileData, numeroTitre: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Numéro du titre de séjour"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="typeTitre" className="text-sm font-semibold">Type de titre</Label>
                    <Input
                      id="typeTitre"
                      type="text"
                      value={profileData.typeTitre}
                      onChange={(e) => setProfileData({ ...profileData, typeTitre: e.target.value })}
                      placeholder="Ex: Carte de séjour, Visa, etc."
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="dateDelivrance" className="text-sm font-semibold">Date de délivrance</Label>
                    <Input
                      id="dateDelivrance"
                      type="date"
                      value={profileData.dateDelivrance}
                      onChange={(e) => setProfileData({ ...profileData, dateDelivrance: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateExpiration" className="text-sm font-semibold">Date d'expiration</Label>
                    <Input
                      id="dateExpiration"
                      type="date"
                      value={profileData.dateExpiration}
                      onChange={(e) => setProfileData({ ...profileData, dateExpiration: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-border"></div>

              {/* Adresse */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📍</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Adresse</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adressePostale" className="text-sm font-semibold">Adresse postale</Label>
                  <Input
                    id="adressePostale"
                    type="text"
                    value={profileData.adressePostale}
                    onChange={(e) => setProfileData({ ...profileData, adressePostale: e.target.value })}
                    className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                    placeholder="Numéro et nom de rue"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="ville" className="text-sm font-semibold">Ville</Label>
                    <Input
                      id="ville"
                      type="text"
                      value={profileData.ville}
                      onChange={(e) => setProfileData({ ...profileData, ville: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="Ville"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codePostal" className="text-sm font-semibold">Code postal</Label>
                    <Input
                      id="codePostal"
                      type="text"
                      value={profileData.codePostal}
                      onChange={(e) => setProfileData({ ...profileData, codePostal: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="75001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pays" className="text-sm font-semibold">Pays</Label>
                    <Input
                      id="pays"
                      type="text"
                      value={profileData.pays}
                      onChange={(e) => setProfileData({ ...profileData, pays: e.target.value })}
                      className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                      placeholder="France"
                    />
                  </div>
                </div>
              </div>

              {/* Boutons d'action améliorés */}
              <div className="flex gap-4 pt-6 border-t border-border">
                <Button 
                  type="submit" 
                  disabled={isSaving} 
                  className="flex-1 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      <span>Enregistrement...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>💾</span>
                      <span>Enregistrer les modifications</span>
                    </span>
                  )}
                </Button>
                <Link href="/client">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="h-12 px-6 border-2 hover:bg-accent transition-colors"
                  >
                    Annuler
                  </Button>
                </Link>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="bg-white rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-8 py-6 border-b border-border">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <span className="text-3xl">🔒</span>
                <span>Changer le mot de passe</span>
              </h2>
              <p className="text-sm text-muted-foreground mt-2">Mettez à jour votre mot de passe pour sécuriser votre compte</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6 max-w-2xl">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Conseil de sécurité :</strong> Utilisez un mot de passe fort contenant au moins 8 caractères, avec des majuscules, minuscules, chiffres et symboles.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm font-semibold">Mot de passe actuel *</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                  placeholder="Entrez votre mot de passe actuel"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-semibold">Nouveau mot de passe *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                  placeholder="Minimum 8 caractères"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Le mot de passe doit contenir au moins 8 caractères
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold">Confirmer le nouveau mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="mt-1 h-11 border-2 focus:border-primary transition-colors"
                  placeholder="Confirmez votre nouveau mot de passe"
                />
                {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1">⚠️ Les mots de passe ne correspondent pas</p>
                )}
                {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                  <p className="text-xs text-green-600 mt-1">✅ Les mots de passe correspondent</p>
                )}
              </div>
              
              <div className="flex gap-4 pt-6 border-t border-border">
                <Button 
                  type="submit" 
                  disabled={isSaving || (passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword)} 
                  className="flex-1 h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">⏳</span>
                      <span>Modification...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>🔐</span>
                      <span>Modifier le mot de passe</span>
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

