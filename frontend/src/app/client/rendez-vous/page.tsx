'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { ReservationWidget } from '@/components/ReservationWidget';
import { appointmentsAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

export default function RendezVousPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rendezVous, setRendezVous] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReservationWidgetOpen, setIsReservationWidgetOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated' && session) {
      // S'assurer que le token est stocké dans localStorage
      if ((session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
      }
      loadRendezVous();
    }
  }, [session, status, router]);

  const loadRendezVous = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('📅 Chargement des rendez-vous pour l\'utilisateur:', session?.user?.email);
      
      // Vérifier que le token est disponible
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token && session && (session.user as any)?.accessToken) {
          localStorage.setItem('token', (session.user as any).accessToken);
          console.log('🔑 Token stocké dans localStorage depuis la session');
        }
        if (!token) {
          console.warn('⚠️ Aucun token trouvé pour charger les rendez-vous');
        }
      }
      
      const response = await appointmentsAPI.getMyAppointments();
      console.log('📅 Réponse API rendez-vous:', response.data);
      
      if (response.data.success) {
        const appointments = response.data.data || response.data.appointments || [];
        setRendezVous(appointments);
        console.log('✅ Rendez-vous chargés:', appointments.length);
      } else {
        setError('Erreur lors du chargement des rendez-vous');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors du chargement des rendez-vous:', err);
      console.error('❌ Détails de l\'erreur:', {
        status: err.response?.status,
        message: err.response?.data?.message,
        data: err.response?.data
      });
      setError(err.response?.data?.message || 'Erreur lors du chargement des rendez-vous');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    setCancellingId(appointmentId);
    setError(null);
    try {
      const response = await appointmentsAPI.cancelAppointment(appointmentId);
      
      if (response.data.success) {
        // Recharger la liste des rendez-vous
        await loadRendezVous();
        setShowCancelConfirm(null);
      } else {
        setError(response.data.message || 'Erreur lors de l\'annulation du rendez-vous');
      }
    } catch (err: any) {
      console.error('❌ Erreur lors de l\'annulation du rendez-vous:', err);
      setError(err.response?.data?.message || 'Erreur lors de l\'annulation du rendez-vous');
    } finally {
      setCancellingId(null);
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
            <h1 className="text-4xl font-bold mb-2">Mes Rendez-vous</h1>
            <p className="text-muted-foreground">Gérez vos rendez-vous et prenez de nouveaux créneaux</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadRendezVous} disabled={isLoading}>
              Actualiser
            </Button>
            <Button onClick={() => setIsReservationWidgetOpen(true)}>Prendre rendez-vous</Button>
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
            <p className="text-muted-foreground">Chargement des rendez-vous...</p>
          </div>
        ) : rendezVous.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-muted-foreground mb-4">Vous n'avez pas de rendez-vous programmé</p>
            <Button onClick={() => setIsReservationWidgetOpen(true)}>Prendre mon premier rendez-vous</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rendezVous.map((rdv) => {
              const getStatutColor = (statut: string) => {
                switch (statut) {
                  case 'confirme':
                    return 'bg-green-100 text-green-800';
                  case 'en_attente':
                    return 'bg-yellow-100 text-yellow-800';
                  case 'annule':
                    return 'bg-red-100 text-red-800';
                  case 'termine':
                    return 'bg-gray-100 text-gray-800';
                  default:
                    return 'bg-blue-100 text-blue-800';
                }
              };

              const formatDate = (date: string) => {
                const d = new Date(date);
                return d.toLocaleDateString('fr-FR', { 
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              };

              const formatTime = (time: string) => {
                if (!time) return '';
                return time.substring(0, 5); // Format HH:MM
              };

              // Calculer si le rendez-vous est passé en tenant compte de la date ET de l'heure
              let isPast = false;
              if (rdv.date && rdv.heure) {
                const dateObj = new Date(rdv.date);
                const [hours, minutes] = rdv.heure.split(':').map(Number);
                const appointmentDateTime = new Date(dateObj);
                appointmentDateTime.setHours(hours || 0, minutes || 0, 0, 0);
                const now = new Date();
                isPast = appointmentDateTime < now;
              } else if (rdv.date) {
                const dateObj = new Date(rdv.date);
                const appointmentDateEnd = new Date(dateObj);
                appointmentDateEnd.setHours(23, 59, 59, 999);
                isPast = appointmentDateEnd < new Date();
              }

              const canCancel = rdv.statut !== 'annule' && rdv.statut !== 'termine';
              const appointmentId = rdv._id || rdv.id;

              // Déterminer le style de la carte
              const getCardStyle = () => {
                if (isPast && rdv.statut !== 'termine' && rdv.statut !== 'annule' && !rdv.effectue) {
                  return 'bg-red-50 border-l-4 border-red-500';
                }
                if (rdv.effectue) {
                  return 'bg-green-50 border-l-4 border-green-500';
                }
                return 'bg-white border-l-4 border-primary';
              };

              return (
                <div key={appointmentId} className={`rounded-lg shadow-lg p-6 ${getCardStyle()} hover:shadow-xl transition-shadow`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 text-foreground">{rdv.motif || 'Rendez-vous'}</h3>
                      {rdv.description && (
                        <p className="text-muted-foreground mb-3">{rdv.description}</p>
                      )}
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <span>📅</span>
                          <span>{formatDate(rdv.date)}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span>🕐</span>
                          <span>{formatTime(rdv.heure)}</span>
                        </p>
                        {isPast && rdv.statut !== 'termine' && rdv.statut !== 'annule' && !rdv.effectue && (
                          <p className="flex items-center gap-2 text-red-600 font-bold mt-2">
                            <span>⚠️</span>
                            <span>Rendez-vous dépassé</span>
                          </p>
                        )}
                        {rdv.effectue && (
                          <p className="flex items-center gap-2 text-green-700 font-bold mt-2">
                            <span>✅</span>
                            <span>Rendez-vous effectué</span>
                          </p>
                        )}
                        {(rdv.nom || rdv.prenom) && (
                          <p className="flex items-center gap-2">
                            <span>👤</span>
                            <span>{rdv.prenom} {rdv.nom}</span>
                          </p>
                        )}
                        {rdv.email && (
                          <p className="flex items-center gap-2">
                            <span>✉️</span>
                            <span>{rdv.email}</span>
                          </p>
                        )}
                        {rdv.telephone && (
                          <p className="flex items-center gap-2">
                            <span>📞</span>
                            <span>{rdv.telephone}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatutColor(rdv.statut || 'en_attente')}`}>
                        {rdv.statut?.replace('_', ' ') || 'En attente'}
                      </span>
                      {canCancel && (
                        <Button
                          variant="outline"
                          className="text-xs border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          onClick={() => setShowCancelConfirm(appointmentId)}
                          disabled={cancellingId === appointmentId}
                        >
                          {cancellingId === appointmentId ? 'Annulation...' : '❌ Annuler'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {rdv.notes && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        <strong>Notes :</strong> {rdv.notes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de réservation */}
      {isReservationWidgetOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsReservationWidgetOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <ReservationWidget 
              isOpen={isReservationWidgetOpen} 
              onClose={() => setIsReservationWidgetOpen(false)}
              onSuccess={() => {
                setIsReservationWidgetOpen(false);
                loadRendezVous(); // Recharger la liste des rendez-vous
              }}
            />
          </div>
        </div>
      )}

      {/* Modal de confirmation d'annulation */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Confirmer l'annulation</h3>
            <p className="text-muted-foreground mb-6">
              Êtes-vous sûr de vouloir annuler ce rendez-vous ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCancelConfirm(null)}
                disabled={cancellingId === showCancelConfirm}
              >
                Annuler
              </Button>
              <Button
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={() => handleCancelAppointment(showCancelConfirm)}
                disabled={cancellingId === showCancelConfirm}
              >
                {cancellingId === showCancelConfirm ? 'Annulation...' : 'Confirmer l\'annulation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

