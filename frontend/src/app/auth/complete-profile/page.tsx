'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { userAPI } from '@/lib/api';
import { DateInput as DateInputComponent } from '@/components/ui/DateInput';

// Composants simplifiés
function Button({ children, variant = 'default', className = '', disabled = false, type = 'button', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent',
  };
  return (
    <button type={type} disabled={disabled} className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
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
        className={`flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors ${className}`}
        {...props}
      />
    );
  }
  
  return (
    <input
      type={type}
      className={`flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors ${className}`}
      {...props}
    />
  );
}

function Label({ children, ...props }: any) {
  return (
    <label className="text-sm font-semibold leading-none mb-2 block" {...props}>
      {children}
    </label>
  );
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    numeroEtranger: '',
    dateNaissance: '',
    lieuNaissance: '',
    nationalite: '',
    sexe: '',
    adressePostale: '',
    ville: '',
    codePostal: '',
    pays: 'France',
  });

  useEffect(() => {
    // Vérifier si l'utilisateur a un token
    const token = localStorage.getItem('token');
    
    if (status === 'loading') {
      return; // Attendre que NextAuth termine le chargement
    }

    if (!session && !token) {
      // Pas de session et pas de token, rediriger vers la connexion
      router.push('/auth/signin');
      return;
    }

    // Si on a un token mais pas de session, essayer de se connecter automatiquement
    if (!session && token) {
      // L'utilisateur vient de s'inscrire, on peut continuer avec le token
      setIsChecking(false);
      return;
    }

    // Si on a une session mais le profil est déjà complet, rediriger vers le client
    if (session && (session.user as any)?.profilComplete) {
      router.push('/client');
      return;
    }

    setIsChecking(false);
  }, [session, status, router]);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Vérifier la taille (max 5 Mo)
      if (file.size > 5 * 1024 * 1024) {
        setError('La photo ne doit pas dépasser 5 Mo');
        return;
      }
      // Vérifier le type
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner une image');
        return;
      }
      setProfilePhoto(file);
      // Créer un aperçu
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation minimale
    if (!formData.numeroEtranger.trim()) {
      setError('Le numéro d\'étranger est requis');
      setIsLoading(false);
      return;
    }

    try {
      // Si une photo est sélectionnée, utiliser FormData
      if (profilePhoto) {
        const formDataToSend = new FormData();
        formDataToSend.append('photo', profilePhoto);
        Object.keys(formData).forEach((key) => {
          formDataToSend.append(key, (formData as any)[key]);
        });
        formDataToSend.append('profilComplete', 'true');

        const response = await userAPI.updateProfile(formDataToSend);
        
        if (response.data.success) {
          setError(null);
          setSuccess(true);
          setIsLoading(false);
          setTimeout(() => {
            window.location.href = '/client';
          }, 2000);
        } else {
          setError('Une erreur est survenue lors de la mise à jour du profil');
          setIsLoading(false);
        }
        return;
      }

      // Sinon, envoyer les données normalement
      const response = await userAPI.updateProfile({
        ...formData,
        profilComplete: true,
      });

      if (response.data.success) {
        // Afficher un message de succès
        setError(null);
        setSuccess(true);
        setIsLoading(false);
        
        // Toujours utiliser window.location.href pour forcer un rechargement complet
        // Cela permet de rafraîchir la session et d'afficher correctement la page client
        setTimeout(() => {
          window.location.href = '/client';
        }, 2000); // Délai pour permettre à l'utilisateur de voir le succès
      } else {
        setError('Une erreur est survenue lors de la mise à jour du profil');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du profil:', err);
      setError(err.response?.data?.message || 'Une erreur est survenue lors de la mise à jour du profil');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden">
          {/* En-tête amélioré */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-8 py-6 border-b border-border">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">📝</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Compléter votre profil</h1>
              <p className="text-muted-foreground">
                Veuillez compléter les informations suivantes pour finaliser votre inscription
              </p>
            </div>
          </div>

          <div className="p-8">
            {/* Messages améliorés */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✅</span>
                  <p className="text-sm font-medium text-green-800">Profil complété avec succès ! Redirection en cours...</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section Photo de profil */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📷</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Photo de profil</h3>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="relative">
                    {photoPreview ? (
                      <img 
                        src={photoPreview} 
                        alt="Aperçu" 
                        className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 shadow-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-2xl">
                          {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="photo">Choisir une photo</Label>
                    <input
                      id="photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="mt-1 block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 file:cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Format accepté : JPG, PNG (max 5 Mo)</p>
                  </div>
                </div>
              </div>

              {/* Section Informations personnelles */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🆔</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Informations personnelles</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="numeroEtranger">Numéro d'étranger *</Label>
                    <Input
                      id="numeroEtranger"
                      name="numeroEtranger"
                      value={formData.numeroEtranger}
                      onChange={handleChange}
                      required
                      placeholder="Ex: 12AB34567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateNaissance">Date de naissance</Label>
                    <Input
                      id="dateNaissance"
                      name="dateNaissance"
                      type="date"
                      value={formData.dateNaissance}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="lieuNaissance">Lieu de naissance</Label>
                    <Input
                      id="lieuNaissance"
                      name="lieuNaissance"
                      value={formData.lieuNaissance}
                      onChange={handleChange}
                      placeholder="Ville, Pays"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nationalite">Nationalité</Label>
                    <Input
                      id="nationalite"
                      name="nationalite"
                      value={formData.nationalite}
                      onChange={handleChange}
                      placeholder="Ex: Française, Algérienne..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sexe">Sexe</Label>
                  <select
                    id="sexe"
                    name="sexe"
                    value={formData.sexe}
                    onChange={handleChange}
                    className="flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors"
                  >
                    <option value="">Sélectionner</option>
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              </div>

              {/* Séparateur */}
              <div className="border-t border-border"></div>

              {/* Section Adresse */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">📍</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Adresse</h3>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adressePostale">Adresse postale</Label>
                  <Input
                    id="adressePostale"
                    name="adressePostale"
                    value={formData.adressePostale}
                    onChange={handleChange}
                    placeholder="Numéro et nom de rue"
                  />
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="ville">Ville</Label>
                    <Input
                      id="ville"
                      name="ville"
                      value={formData.ville}
                      onChange={handleChange}
                      placeholder="Ville"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="codePostal">Code postal</Label>
                    <Input
                      id="codePostal"
                      name="codePostal"
                      value={formData.codePostal}
                      onChange={handleChange}
                      placeholder="75001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pays">Pays</Label>
                    <Input
                      id="pays"
                      name="pays"
                      value={formData.pays}
                      onChange={handleChange}
                      placeholder="France"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    <span>Enregistrement...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>✅</span>
                    <span>Finaliser mon profil</span>
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

