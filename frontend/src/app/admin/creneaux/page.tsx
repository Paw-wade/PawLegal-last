'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { creneauxAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

function Input({ className = '', ...props }: any) {
  return <input className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${className}`} {...props} />;
}

function Textarea({ className = '', ...props }: any) {
  return <textarea className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${className}`} {...props} />;
}

function Label({ htmlFor, children, className = '' }: any) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium leading-none mb-2 block ${className}`}>
      {children}
    </label>
  );
}

export default function AdminCreneauxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedHeures, setSelectedHeures] = useState<string[]>([]);
  const [motifFermeture, setMotifFermeture] = useState('');

  // Heures disponibles par défaut
  const heuresDisponibles = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && (session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin') {
      router.push('/client');
    } else if (status === 'authenticated') {
      loadCreneaux();
    }
  }, [session, status, router, selectedDate]);

  const loadCreneaux = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('🔄 Chargement des créneaux fermés pour:', selectedDate);
      // Charger UNIQUEMENT les créneaux fermés pour la date sélectionnée
      const response = await creneauxAPI.getAllCreneaux({ date: selectedDate, ferme: true });
      console.log('✅ Réponse chargement créneaux:', response.data);
      if (response.data.success) {
        const creneauxRecus = response.data.creneaux || [];
        console.log('📋 Créneaux fermés reçus:', creneauxRecus.length, creneauxRecus.map((c: any) => ({
          id: c._id || c.id,
          date: c.date ? new Date(c.date).toISOString().split('T')[0] : 'N/A',
          heure: c.heure,
          ferme: c.ferme,
          motif: c.motifFermeture
        })));
        
        // Filtrer pour s'assurer que la date correspond (double vérification)
        const creneauxFermes = creneauxRecus.filter((c: any) => {
          // Vérifier que la date correspond
          if (!c.date) {
            console.log('⚠️ Créneau sans date ignoré:', c);
            return false;
          }
          
          try {
            const creneauDate = new Date(c.date).toISOString().split('T')[0];
            const selectedDateStr = new Date(selectedDate).toISOString().split('T')[0];
            
            if (creneauDate !== selectedDateStr) {
              console.log(`⚠️ Créneau ${c.heure} ignoré: date ne correspond pas (${creneauDate} vs ${selectedDateStr})`);
              return false;
            }
            
            // Vérifier que le créneau est bien fermé
            const isFerme = c.ferme === true || c.ferme === 'true' || String(c.ferme) === 'true';
            if (!isFerme) {
              console.log(`⚠️ Créneau ${c.heure} ignoré: n'est pas marqué comme fermé`);
              return false;
            }
            
            return true;
          } catch (err) {
            console.error('Erreur lors du filtrage:', err, c);
            return false;
          }
        });
        
        console.log('📋 Créneaux fermés filtrés:', creneauxFermes.length, creneauxFermes.map((c: any) => ({
          heure: c.heure,
          ferme: c.ferme,
          motif: c.motifFermeture
        })));
        
        setCreneaux(creneauxFermes);
      } else {
        setError('Erreur lors du chargement des créneaux');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des créneaux:', err);
      console.error('Détails:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.message || 'Erreur lors du chargement des créneaux');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSlots = async () => {
    if (selectedHeures.length === 0) {
      setError('Veuillez sélectionner au moins un créneau à fermer');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      console.log('Fermeture des créneaux:', {
        date: selectedDate,
        heures: selectedHeures,
        motifFermeture: motifFermeture.trim() || undefined
      });
      
      const response = await creneauxAPI.closeSlots({
        date: selectedDate,
        heures: selectedHeures,
        motifFermeture: motifFermeture.trim() || undefined
      });
      
      console.log('Réponse de fermeture:', response.data);
      
      if (response.data.success) {
        // Afficher un message de succès temporaire
        const successMessage = response.data.message || `${selectedHeures.length} créneau(x) fermé(s) avec succès`;
        setError(null);
        
        // Fermer le modal et réinitialiser d'abord
        setShowCloseModal(false);
        setSelectedHeures([]);
        setMotifFermeture('');
        
        // Recharger les créneaux immédiatement
        await loadCreneaux();
        
        // Afficher un message de succès
        alert(successMessage);
      } else {
        setError(response.data.message || 'Erreur lors de la fermeture des créneaux');
      }
    } catch (err: any) {
      console.error('Erreur lors de la fermeture des créneaux:', err);
      console.error('Détails de l\'erreur:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(
        err.response?.data?.message || 
        err.response?.data?.errors?.map((e: any) => e.msg).join(', ') ||
        err.message || 
        'Erreur lors de la fermeture des créneaux'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopenSlot = async (creneauId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir rouvrir ce créneau ?')) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await creneauxAPI.reopenSlot(creneauId);
      if (response.data.success) {
        await loadCreneaux();
      }
    } catch (err: any) {
      console.error('Erreur lors de la réouverture du créneau:', err);
      setError(err.response?.data?.message || 'Erreur lors de la réouverture du créneau');
    } finally {
      setIsLoading(false);
    }
  };

  // Les créneaux sont déjà filtrés pour être fermés dans loadCreneaux
  // Mais on vérifie quand même la date pour être sûr
  // Note: loadCreneaux charge déjà uniquement les créneaux fermés pour la date sélectionnée
  const creneauxFermesPourDate = creneaux.filter(c => {
    if (!c.date) {
      console.log('⚠️ Créneau sans date:', c);
      return false;
    }
    
    try {
      const creneauDate = new Date(c.date);
      const selectedDateObj = new Date(selectedDate);
      
      // Normaliser les dates pour la comparaison (année, mois, jour uniquement)
      const creneauDateStr = creneauDate.toISOString().split('T')[0];
      const selectedDateStr = selectedDateObj.toISOString().split('T')[0];
      
      const matchesDate = creneauDateStr === selectedDateStr;
      const isFerme = c.ferme === true || c.ferme === 'true' || String(c.ferme) === 'true';
      
      if (matchesDate && isFerme) {
        console.log('✅ Créneau fermé valide:', {
          heure: c.heure,
          date: creneauDateStr,
          ferme: c.ferme,
          isFerme
        });
      }
      
      return matchesDate && isFerme;
    } catch (err) {
      console.error('Erreur lors du filtrage du créneau:', err, c);
      return false;
    }
  });

  // Pour le modal de fermeture, on doit charger tous les créneaux (fermés et non fermés) pour savoir lesquels sont déjà fermés
  const [allCreneauxForDate, setAllCreneauxForDate] = useState<any[]>([]);
  
  useEffect(() => {
    const loadAllCreneaux = async () => {
      try {
        const response = await creneauxAPI.getAllCreneaux({ date: selectedDate });
        if (response.data.success) {
          setAllCreneauxForDate(response.data.creneaux || []);
        }
      } catch (err) {
        console.error('Erreur lors du chargement de tous les créneaux:', err);
      }
    };
    loadAllCreneaux();
  }, [selectedDate]);

  const heuresFermees = allCreneauxForDate
    .filter(c => {
      if (!c.date) return false;
      const creneauDate = new Date(c.date).toISOString().split('T')[0];
      const selectedDateStr = new Date(selectedDate).toISOString().split('T')[0];
      return creneauDate === selectedDateStr && (c.ferme === true || c.ferme === 'true');
    })
    .map(c => c.heure);
  
  console.log('📊 Créneaux fermés pour la date:', {
    selectedDate,
    totalCreneauxCharges: creneaux.length,
    creneauxFermes: creneauxFermesPourDate.length,
    heuresFermees: heuresFermees,
    creneauxFermesPourDate: creneauxFermesPourDate.map(c => ({ heure: c.heure, date: c.date, ferme: c.ferme }))
  });

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
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <Header variant="admin" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Gestion des Créneaux
            </h1>
            <p className="text-muted-foreground text-lg">Fermez ou rouvrez des créneaux de rendez-vous</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={loadCreneaux}
              disabled={isLoading}
              className="shadow-sm"
            >
              <span className="mr-2">🔄</span>
              Actualiser
            </Button>
            <Button 
              onClick={() => setShowCloseModal(true)}
              className="bg-primary hover:bg-primary/90 shadow-md"
            >
              <span className="mr-2">🔒</span>
              Fermer des créneaux
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Sélection de date */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6 border-l-4 border-primary">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="date" className="text-base font-semibold mb-3 block">
                📅 Sélectionner une date
              </Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                {creneauxFermesPourDate.length} créneau{creneauxFermesPourDate.length > 1 ? 'x' : ''} fermé{creneauxFermesPourDate.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Liste des créneaux fermés */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Créneaux fermés
              </h2>
              <p className="text-muted-foreground">
                {new Date(selectedDate).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            {creneauxFermesPourDate.length > 0 && (
              <Button
                variant="outline"
                onClick={async () => {
                  if (confirm(`Êtes-vous sûr de vouloir rouvrir tous les ${creneauxFermesPourDate.length} créneaux fermés pour cette date ?`)) {
                    setIsLoading(true);
                    setError(null);
                    try {
                      let successCount = 0;
                      let errorCount = 0;
                      for (const creneau of creneauxFermesPourDate) {
                        try {
                          await creneauxAPI.reopenSlot(creneau._id || creneau.id);
                          successCount++;
                        } catch (err) {
                          errorCount++;
                          console.error('Erreur lors de la réouverture:', err);
                        }
                      }
                      await loadCreneaux();
                      if (successCount > 0) {
                        alert(`${successCount} créneau${successCount > 1 ? 'x' : ''} rouvert${successCount > 1 ? 's' : ''} avec succès${errorCount > 0 ? ` (${errorCount} erreur${errorCount > 1 ? 's' : ''})` : ''}`);
                      }
                    } catch (err: any) {
                      setError(err.response?.data?.message || 'Erreur lors de la réouverture');
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }}
                disabled={isLoading}
                className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
              >
                <span className="mr-2">🔄</span>
                Tout rouvrir
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des créneaux...</p>
            </div>
          ) : creneauxFermesPourDate.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📅</span>
              </div>
              <p className="text-muted-foreground mb-2 font-medium">Aucun créneau fermé pour cette date</p>
              <p className="text-sm text-muted-foreground">
                Tous les créneaux sont disponibles pour le {new Date(selectedDate).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
              {creneauxFermesPourDate.map((creneau) => (
                <div
                  key={creneau._id || creneau.id}
                  className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-300 rounded-xl p-5 text-center hover:shadow-lg transition-all hover:scale-105"
                >
                  <div className="mb-3">
                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-lg">{creneau.heure}</span>
                    </div>
                    {creneau.motifFermeture && (
                      <p className="text-xs text-red-700 font-medium mt-2 line-clamp-2" title={creneau.motifFermeture}>
                        {creneau.motifFermeture}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleReopenSlot(creneau._id || creneau.id)}
                    disabled={isLoading}
                    className="w-full text-sm bg-white hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors"
                  >
                    <span className="mr-2">🔓</span>
                    Rouvrir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de fermeture de créneaux */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-foreground">🔒 Fermer des créneaux</h3>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setSelectedHeures([]);
                  setMotifFermeture('');
                  setError(null);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4">
              <Label htmlFor="modalDate">Date</Label>
              <Input
                id="modalDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="mt-2"
              />
            </div>

            <div className="mb-6">
              <Label className="text-base font-semibold mb-3 block">
                ⏰ Sélectionner les créneaux à fermer
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {heuresDisponibles.map((heure) => {
                  const isSelected = selectedHeures.includes(heure);
                  const isAlreadyClosed = heuresFermees.includes(heure);
                  
                  return (
                    <button
                      key={heure}
                      type="button"
                      onClick={() => {
                        if (isAlreadyClosed) return;
                        if (isSelected) {
                          setSelectedHeures(selectedHeures.filter(h => h !== heure));
                        } else {
                          setSelectedHeures([...selectedHeures, heure]);
                        }
                      }}
                      disabled={isAlreadyClosed}
                      className={`p-3 rounded-lg border-2 transition-all font-medium ${
                        isAlreadyClosed
                          ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'bg-primary text-white border-primary shadow-md scale-105'
                          : 'bg-white border-gray-300 hover:border-primary hover:shadow-md hover:scale-105'
                      }`}
                    >
                      {heure}
                      {isAlreadyClosed && (
                        <span className="block text-xs mt-1 font-normal">(Fermé)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="motif">Motif de fermeture (optionnel)</Label>
              <Textarea
                id="motif"
                value={motifFermeture}
                onChange={(e) => setMotifFermeture(e.target.value)}
                placeholder="Ex: Congé, Formation, etc."
                rows={3}
                className="mt-2"
              />
            </div>

            {selectedHeures.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  ✓ <strong>{selectedHeures.length}</strong> créneau{selectedHeures.length > 1 ? 'x' : ''} sélectionné{selectedHeures.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-700">
                  {selectedHeures.sort().join(', ')}
                </p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCloseModal(false);
                  setSelectedHeures([]);
                  setMotifFermeture('');
                  setError(null);
                }} 
                disabled={isLoading}
                className="min-w-[100px]"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleCloseSlots} 
                disabled={isLoading || selectedHeures.length === 0}
                className="min-w-[180px] bg-primary hover:bg-primary/90 shadow-md"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Fermeture...
                  </>
                ) : (
                  <>
                    <span className="mr-2">🔒</span>
                    Fermer {selectedHeures.length} créneau{selectedHeures.length > 1 ? 'x' : ''}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

