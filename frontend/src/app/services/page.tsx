'use client';

import Link from 'next/link';
import { Footer } from '@/components/layout/Footer';

function Button({ children, variant = 'default', className = '', size = 'default', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  const sizeClasses = {
    default: 'h-10 py-2 px-4 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-8 text-base',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>{children}</button>;
}

export default function ServicesPage() {
  const services = [
    {
      titre: 'Consultation juridique',
      description: 'Première consultation pour évaluer votre situation',
      duree: '30 mn',
      prix: '25€',
      features: [
        'Analyse de votre dossier',
        'Conseils personnalisés',
        'Évaluation des options',
        'Recommandations stratégiques',
      ],
      icon: '💼',
      color: 'primary',
    },
    {
      titre: 'Accompagnement complet',
      description: 'Suivi de dossier avec représentation',
      duree: 'Selon le dossier',
      prix: 'Sur dossier',
      features: [
        'Suivi personnalisé',
        'Représentation juridique',
        'Gestion administrative',
        'Accompagnement jusqu\'au terme',
      ],
      icon: '🤝',
      color: 'primary',
    },
    {
      titre: 'Rédaction de contrats',
      description: 'Rédaction ou révision de documents juridiques',
      duree: 'Selon la complexité',
      prix: 'Sur dossier',
      features: [
        'Rédaction sur mesure',
        'Révision de contrats existants',
        'Conseil juridique',
        'Mise en conformité',
      ],
      icon: '📝',
      color: 'primary',
    },
    {
      titre: 'Portail de gestion du cycle de vie et de renouvellement du titre de séjour',
      description: 'Plateforme complète de suivi et de gestion de votre titre de séjour',
      duree: 'Jusqu\'au terme de renouvellement',
      prix: '25€',
      features: [
        'Tableau de bord du titre de séjour',
        'Assistant de renouvellement de titre de séjour',
        'Tracker de titre de séjour',
        'Système d\'alertes et de rappel pour titres de séjour',
      ],
      icon: '🌐',
      color: 'primary',
      isPortal: true,
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; hover: string }> = {
      primary: {
        bg: 'bg-primary/5',
        text: 'text-primary',
        border: 'border-primary/20',
        hover: 'hover:border-primary',
      },
      blue: {
        bg: 'bg-blue-500/5',
        text: 'text-blue-600',
        border: 'border-blue-500/20',
        hover: 'hover:border-blue-500',
      },
      green: {
        bg: 'bg-green-500/5',
        text: 'text-green-600',
        border: 'border-green-500/20',
        hover: 'hover:border-green-500',
      },
      purple: {
        bg: 'bg-purple-500/5',
        text: 'text-purple-600',
        border: 'border-purple-500/20',
        hover: 'hover:border-purple-500',
      },
    };
    return colors[color] || colors.primary;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary">Paw Legal</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
              <Link href="/domaines" className="hover:text-primary transition-colors">Domaines</Link>
              <Link href="/services" className="text-primary font-medium">Services</Link>
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

      {/* Hero Section */}
      <section className="relative py-8 md:py-12 bg-gradient-to-br from-primary/10 via-primary/5 to-background overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-block mb-3 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20">
              <span className="text-sm font-medium text-primary">Nos Services Juridiques</span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground leading-tight px-4">
              Des solutions <span className="text-primary">sur mesure</span> pour vos besoins
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
              Expertise juridique, accompagnement personnalisé et tarifs transparents pour vous offrir le meilleur service
            </p>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-20">

        {/* Services côte à côte */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-16">
          {services.map((service, index) => {
            const colors = getColorClasses(service.color);
            return (
              <div
                key={index}
                className={`group relative bg-white rounded-3xl shadow-xl p-6 border-2 ${colors.border} ${colors.hover} transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col`}
                style={{
                  background: `linear-gradient(135deg, ${colors.bg} 0%, white 50%, white 100%)`,
                }}
              >
                {/* Badge de popularité pour le premier service */}
                {index === 0 && (
                  <div className="absolute -top-4 right-6 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                    Le plus populaire
                  </div>
                )}

                {/* En-tête de la carte améliorée */}
                <div className="mb-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-all duration-300 shadow-md flex-shrink-0`}>
                      {service.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg md:text-xl font-bold mb-2 ${colors.text} break-words hyphens-auto`}>
                        {service.titre}
                      </h3>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4 break-words">
                    {service.description}
                  </p>
                </div>

                {/* Informations prix et durée améliorées */}
                <div className="flex flex-col gap-3 mb-6 pb-6 border-b-2 border-border/50">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg">
                    <span className="text-muted-foreground text-xs font-medium">⏱️ Durée:</span>
                    <span className="font-bold text-foreground text-sm">{service.duree}</span>
                  </div>
                  <div className="flex items-center justify-between bg-primary/10 px-3 py-2 rounded-lg">
                    <span className="text-muted-foreground text-xs font-medium">Tarif:</span>
                    <span className={`text-2xl font-bold ${colors.text}`}>{service.prix}</span>
                  </div>
                </div>

                {/* Liste des fonctionnalités améliorée */}
                <ul className="space-y-3 mb-6 flex-1">
                  {service.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 group/item">
                      <div className={`w-5 h-5 ${colors.bg} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:scale-110 transition-transform`}>
                        <span className={`${colors.text} text-xs font-bold`}>✓</span>
                      </div>
                      <span className="text-foreground text-sm leading-relaxed font-medium break-words">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Bouton d'action amélioré */}
                <div className="pt-6 border-t-2 border-border/50 mt-auto">
                  {service.isPortal ? (
                    <Link href="/calculateur" className="block">
                      <Button 
                        className="w-full bg-gradient-to-r from-primary to-primary/80 text-white hover:shadow-xl hover:scale-105 transition-all duration-300" 
                        size="lg"
                      >
                        <span className="mr-2">🚀</span>
                        Accéder au Calculateur
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/contact" className="block">
                      <Button 
                        variant="outline" 
                        className={`w-full border-2 transition-all duration-300 hover:scale-105 ${colors.border} ${colors.text} group-hover:bg-primary group-hover:text-white group-hover:border-primary`} 
                        size="lg"
                      >
                        <span className="mr-2">📧</span>
                        Soumettre un dossier
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section avantages supplémentaires */}
        <div className="mt-20 grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="text-center p-6 bg-white rounded-2xl shadow-lg border border-border hover:shadow-xl transition-all">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Réactivité</h3>
            <p className="text-muted-foreground text-sm">Réponse sous 24h pour toutes vos demandes</p>
          </div>
          <div className="text-center p-6 bg-white rounded-2xl shadow-lg border border-border hover:shadow-xl transition-all">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Confidentialité</h3>
            <p className="text-muted-foreground text-sm">Vos données sont protégées et sécurisées</p>
          </div>
          <div className="text-center p-6 bg-white rounded-2xl shadow-lg border border-border hover:shadow-xl transition-all">
            <div className="text-4xl mb-4">⭐</div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Expertise</h3>
            <p className="text-muted-foreground text-sm">Plus de 10 ans d'expérience à votre service</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
