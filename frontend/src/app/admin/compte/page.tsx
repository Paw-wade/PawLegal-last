'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/layout/Header';
import { userAPI } from '@/lib/api';
import { DateInput as DateInputComponent } from '@/components/ui/DateInput';

function Button({ children, variant = 'default', className = '', disabled = false, ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} disabled={disabled} {...props}>{children}</button>;
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

function Textarea({ className = '', ...props }: any) {
  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export default function AdminComptePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'profil' | 'password'>('profil');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Données du profil - Tous les champs seront automatiquement pré-remplis avec les données de la base
  // lors du chargement du profil via loadProfile()
  // L'administrateur peut modifier tous les champs de son propre profil
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
  // IMPORTANT : Le mot de passe n'est JAMAIS pré-rempli pour des raisons de sécurité
  // L'administrateur doit toujours saisir son mot de passe actuel pour le changer
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && (session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin') {
      router.push('/client');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (status === 'authenticated' && session && ((session.user as any)?.role === 'admin' || (session.user as any)?.role === 'superadmin')) {
      loadProfile();
    }
  }, [status, session]);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await userAPI.getProfile();
      if (response.data.success) {
        const user = response.data.user || response.data.data;
        // Pré-remplir TOUS les champs avec les données existantes ou des valeurs vides par défaut
        // L'administrateur peut modifier tous les champs de son propre profil
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
      } else {
        setError('Impossible de charger le profil');
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement du profil:', error);
      setError(error.response?.data?.message || 'Erreur lors du chargement du profil');
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
        // Recharger le profil pour avoir les données à jour (au cas où le backend modifie certaines valeurs)
        await loadProfile();
      } else {
        setError(response.data.message || 'Erreur lors de la mise à jour du profil');
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du profil:', error);
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

  if (!session || ((session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <Header variant="admin" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Mon Compte
          </h1>
          <p className="text-muted-foreground text-lg">Gérez vos informations personnelles et votre mot de passe</p>
        </div>

        {/* Onglets */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex gap-2 border-b mb-6">
            <button
              onClick={() => setActiveTab('profil')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'profil'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              👤 Informations personnelles
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeTab === 'password'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              🔒 Mot de passe
            </button>
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

          {/* Formulaire de profil */}
          {activeTab === 'profil' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Informations de base */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Informations de base</h3>
                  
                  <div>
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      required
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="mt-1 bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">L'email ne peut pas être modifié</p>
                  </div>

                  <div>
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="mt-1"
                      placeholder="+33 6 12 34 56 78"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateNaissance">Date de naissance</Label>
                    <Input
                      id="dateNaissance"
                      type="date"
                      value={profileData.dateNaissance}
                      onChange={(e) => setProfileData({ ...profileData, dateNaissance: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lieuNaissance">Lieu de naissance</Label>
                    <Input
                      id="lieuNaissance"
                      value={profileData.lieuNaissance}
                      onChange={(e) => setProfileData({ ...profileData, lieuNaissance: e.target.value })}
                      className="mt-1"
                      placeholder="Ville, Pays"
                    />
                  </div>

                  <div>
                    <Label htmlFor="nationalite">Nationalité</Label>
                    <Input
                      id="nationalite"
                      value={profileData.nationalite}
                      onChange={(e) => setProfileData({ ...profileData, nationalite: e.target.value })}
                      className="mt-1"
                      placeholder="Ex: Française"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sexe">Sexe</Label>
                    <select
                      id="sexe"
                      value={profileData.sexe}
                      onChange={(e) => setProfileData({ ...profileData, sexe: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      <option value="">Sélectionner</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>

                {/* Informations administratives */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Informations administratives</h3>

                  <div>
                    <Label htmlFor="numeroEtranger">Numéro d'étranger</Label>
                    <Input
                      id="numeroEtranger"
                      value={profileData.numeroEtranger}
                      onChange={(e) => setProfileData({ ...profileData, numeroEtranger: e.target.value })}
                      className="mt-1"
                      placeholder="Ex: 1234567890123"
                    />
                  </div>

                  <div>
                    <Label htmlFor="numeroTitre">Numéro de titre de séjour</Label>
                    <Input
                      id="numeroTitre"
                      value={profileData.numeroTitre}
                      onChange={(e) => setProfileData({ ...profileData, numeroTitre: e.target.value })}
                      className="mt-1"
                      placeholder="Ex: 12AB34567"
                    />
                  </div>

                  <div>
                    <Label htmlFor="typeTitre">Type de titre</Label>
                    <select
                      id="typeTitre"
                      value={profileData.typeTitre}
                      onChange={(e) => setProfileData({ ...profileData, typeTitre: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      <option value="">Sélectionner</option>
                      <option value="visiteur">Visiteur</option>
                      <option value="etudiant">Étudiant</option>
                      <option value="salarie">Salarié</option>
                      <option value="travailleur_temporaire">Travailleur temporaire</option>
                      <option value="scientifique">Scientifique</option>
                      <option value="artiste">Artiste</option>
                      <option value="commercant">Commerçant</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="dateDelivrance">Date de délivrance</Label>
                    <Input
                      id="dateDelivrance"
                      type="date"
                      value={profileData.dateDelivrance}
                      onChange={(e) => setProfileData({ ...profileData, dateDelivrance: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateExpiration">Date d'expiration</Label>
                    <Input
                      id="dateExpiration"
                      type="date"
                      value={profileData.dateExpiration}
                      onChange={(e) => setProfileData({ ...profileData, dateExpiration: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-foreground border-b pb-2 mt-6">Adresse</h3>

                  <div>
                    <Label htmlFor="adressePostale">Adresse postale</Label>
                    <Textarea
                      id="adressePostale"
                      value={profileData.adressePostale}
                      onChange={(e) => setProfileData({ ...profileData, adressePostale: e.target.value })}
                      className="mt-1"
                      placeholder="Numéro et nom de rue"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="codePostal">Code postal</Label>
                      <Input
                        id="codePostal"
                        value={profileData.codePostal}
                        onChange={(e) => setProfileData({ ...profileData, codePostal: e.target.value })}
                        className="mt-1"
                        placeholder="75001"
                      />
                    </div>

                    <div>
                      <Label htmlFor="ville">Ville</Label>
                      <Input
                        id="ville"
                        value={profileData.ville}
                        onChange={(e) => setProfileData({ ...profileData, ville: e.target.value })}
                        className="mt-1"
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pays">Pays</Label>
                    <Input
                      id="pays"
                      value={profileData.pays}
                      onChange={(e) => setProfileData({ ...profileData, pays: e.target.value })}
                      className="mt-1"
                      placeholder="France"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin')}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </form>
          )}

          {/* Formulaire de changement de mot de passe */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
              <div>
                <Label htmlFor="currentPassword">Mot de passe actuel *</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="newPassword">Nouveau mot de passe *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Le mot de passe doit contenir au moins 8 caractères
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  minLength={8}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/admin')}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Modification...' : 'Modifier le mot de passe'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

