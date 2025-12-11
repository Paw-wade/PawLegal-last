'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';

// Composants simplifiés intégrés
function Button({ 
  children, 
  variant = 'default', 
  size = 'default', 
  className = '',
  disabled = false,
  type = 'button',
  ...props 
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: any;
}) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  };
  
  const sizeClasses = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10',
  };
  
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Input({ className = '', ...props }: any) {
  return (
    <input
      className={`flex h-11 w-full rounded-md border-2 border-input bg-background px-4 py-2.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus:border-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ className = '', children, ...props }: any) {
  return (
    <label
      className={`text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-2 block ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // États pour les valeurs du formulaire
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // États pour les erreurs de validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (name: string, value: string) => {
    const errors: Record<string, string> = { ...fieldErrors };
    
    switch (name) {
      case 'firstName':
        if (!value || value.trim().length === 0) {
          errors.firstName = 'Le prénom est requis';
        } else if (value.trim().length < 2) {
          errors.firstName = 'Le prénom doit contenir au moins 2 caractères';
        } else {
          delete errors.firstName;
        }
        break;
      case 'lastName':
        if (!value || value.trim().length === 0) {
          errors.lastName = 'Le nom est requis';
        } else if (value.trim().length < 2) {
          errors.lastName = 'Le nom doit contenir au moins 2 caractères';
        } else {
          delete errors.lastName;
        }
        break;
      case 'email':
        if (!value || value.trim().length === 0) {
          errors.email = 'L\'email est requis';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          errors.email = 'Email invalide';
        } else {
          delete errors.email;
        }
        break;
      case 'password':
        if (!value || value.length === 0) {
          errors.password = 'Le mot de passe est requis';
        } else if (value.length < 6) {
          errors.password = 'Le mot de passe doit contenir au moins 6 caractères';
        } else {
          delete errors.password;
        }
        // Vérifier aussi la confirmation si elle existe
        if (formData.confirmPassword && value !== formData.confirmPassword) {
          errors.confirmPassword = 'Les mots de passe ne correspondent pas';
        } else if (formData.confirmPassword) {
          delete errors.confirmPassword;
        }
        break;
      case 'confirmPassword':
        if (!value || value.length === 0) {
          errors.confirmPassword = 'Veuillez confirmer votre mot de passe';
        } else if (value !== formData.password) {
          errors.confirmPassword = 'Les mots de passe ne correspondent pas';
        } else {
          delete errors.confirmPassword;
        }
        break;
    }
    
    setFieldErrors(errors);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Valider le champ modifié
    validateField(name, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Valider tous les champs
    validateField('firstName', formData.firstName);
    validateField('lastName', formData.lastName);
    validateField('email', formData.email);
    validateField('password', formData.password);
    validateField('confirmPassword', formData.confirmPassword);

    // Vérifier s'il y a des erreurs
    const hasErrors = Object.keys(fieldErrors).length > 0;
    if (hasErrors) {
      setError('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    // Vérifications finales
    if (!formData.firstName.trim() || formData.firstName.trim().length < 2) {
      setError('Le prénom doit contenir au moins 2 caractères');
      return;
    }

    if (!formData.lastName.trim() || formData.lastName.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return;
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setIsLoading(true);

    try {
      const registerData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim() || undefined,
      };

      const response = await authAPI.register(registerData);

      if (response.data.success) {
        // Stocker le token
        localStorage.setItem('token', response.data.token);
        
        // Connecter automatiquement l'utilisateur avec NextAuth
        const result = await signIn('credentials', {
          email: registerData.email,
          password: registerData.password,
          redirect: false,
        });

        if (result?.ok) {
          // Rediriger vers la page de complétion de profil
          router.push('/auth/complete-profile');
        } else {
          // Si la connexion automatique échoue, rediriger quand même
          router.push('/auth/complete-profile');
        }
      }
    } catch (err: any) {
      console.error('Erreur lors de l\'inscription:', err);
      
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.errors) {
        const errorMessages = err.response.data.errors.map((e: any) => e.msg || e.message).join(', ');
        setError(errorMessages);
      } else {
        setError('Une erreur est survenue lors de l\'inscription. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-xl border border-border overflow-hidden">
          {/* Bouton retour à l'accueil */}
          <div className="px-8 pt-6 pb-2">
            <Link href="/">
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                ← Retour à l'accueil
              </Button>
            </Link>
          </div>
          
          {/* En-tête amélioré */}
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-8 py-6 border-b border-border">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">✨</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Créer un compte</h1>
              <p className="text-muted-foreground">
                Remplissez le formulaire pour créer votre compte Paw Legal
              </p>
            </div>
          </div>

          <div className="p-8">
            {/* Message d'erreur amélioré */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    onBlur={(e) => validateField('firstName', e.target.value)}
                    placeholder="Votre prénom"
                    className={fieldErrors.firstName ? 'border-red-500 focus:border-red-500' : ''}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{fieldErrors.firstName}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    onBlur={(e) => validateField('lastName', e.target.value)}
                    placeholder="Votre nom"
                    className={fieldErrors.lastName ? 'border-red-500 focus:border-red-500' : ''}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <span>⚠️</span>
                      <span>{fieldErrors.lastName}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={(e) => validateField('email', e.target.value)}
                  placeholder="votre@email.com"
                  className={fieldErrors.email ? 'border-red-500 focus:border-red-500' : ''}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone (optionnel)</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+33 1 23 45 67 89"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={(e) => validateField('password', e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className={`pr-12 ${fieldErrors.password ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{fieldErrors.password}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={(e) => validateField('confirmPassword', e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className={`pr-12 ${fieldErrors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>{fieldErrors.confirmPassword}</span>
                  </p>
                )}
                {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Les mots de passe ne correspondent pas</span>
                  </p>
                )}
                {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && formData.password.length >= 8 && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <span>✅</span>
                    <span>Les mots de passe correspondent</span>
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    <span>Création en cours...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>✨</span>
                    <span>Créer mon compte</span>
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-sm text-muted-foreground">
                Vous avez déjà un compte ?{' '}
                <Link href="/auth/signin" className="text-primary hover:underline font-semibold">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
