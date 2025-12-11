'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { appointmentsAPI } from '@/lib/api';

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
  return <input className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${className}`} {...props} />;
}

function Textarea({ className = '', ...props }: any) {
  return <textarea className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ${className}`} {...props} />;
}

function Label({ htmlFor, children, className = '' }: any) {
  return <label htmlFor={htmlFor} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>;
}

export default function AdminRendezVousPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rendezVous, setRendezVous] = useState<any[]>([]);
  const [filter, setFilter] = useState('all'); // all, today, week, month
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRdv, setEditingRdv] = useState<any | null>(null);
  // Fonction pour obtenir la date du jour au format YYYY-MM-DD
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [editFormData, setEditFormData] = useState({
    statut: '',
    date: getTodayDate(),
    heure: '',
    motif: '',
    description: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && (session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin') {
      router.push('/client');
    } else if (status === 'authenticated') {
      loadAppointments();
    }
  }, [session, status, router, filter]);

  const loadAppointments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await appointmentsAPI.getAllAppointments();
      if (response.data.success) {
        const appointments = response.data.data || response.data.appointments || [];
        
        // Filtrer selon le filtre sélectionné
        let filtered = appointments;
        const now = new Date();
        
        if (filter === 'today') {
          filtered = appointments.filter((apt: any) => {
            const aptDate = new Date(apt.date);
            return aptDate.toDateString() === now.toDateString();
          });
        } else if (filter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          filtered = appointments.filter((apt: any) => {
            const aptDate = new Date(apt.date);
            return aptDate >= weekAgo;
          });
        } else if (filter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          filtered = appointments.filter((apt: any) => {
            const aptDate = new Date(apt.date);
            return aptDate >= monthAgo;
          });
        }
        
        setRendezVous(filtered);
      } else {
        setError('Erreur lors du chargement des rendez-vous');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des rendez-vous:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des rendez-vous');
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

  if (!session || ((session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <Header variant="admin" />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Gestion des Rendez-vous
            </h1>
            <p className="text-muted-foreground text-lg">Gérez tous les rendez-vous de votre cabinet</p>
          </div>
          <Button>Nouveau rendez-vous</Button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Filtrer :</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📋 Tous
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'today' 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Aujourd'hui
            </button>
            <button
              onClick={() => setFilter('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'week' 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📆 Cette semaine
            </button>
            <button
              onClick={() => setFilter('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === 'month' 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗓️ Ce mois
            </button>
            <Button onClick={loadAppointments} variant="outline" className="ml-auto">
              🔄 Actualiser
            </Button>
          </div>
        </div>

        {/* Statistiques rapides */}
        {!isLoading && rendezVous.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700 font-medium mb-1">En attente</p>
              <p className="text-2xl font-bold text-blue-900">
                {rendezVous.filter((r: any) => r.statut === 'en_attente').length}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-700 font-medium mb-1">Confirmés</p>
              <p className="text-2xl font-bold text-green-900">
                {rendezVous.filter((r: any) => r.statut === 'confirme' || r.statut === 'confirmé').length}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs text-red-700 font-medium mb-1">Annulés</p>
              <p className="text-2xl font-bold text-red-900">
                {rendezVous.filter((r: any) => r.statut === 'annule' || r.statut === 'annulé').length}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-700 font-medium mb-1">Terminés</p>
              <p className="text-2xl font-bold text-gray-900">
                {rendezVous.filter((r: any) => r.statut === 'termine' || r.statut === 'terminé').length}
              </p>
            </div>
          </div>
        )}

        {/* Liste des rendez-vous */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des rendez-vous...</p>
            </div>
          ) : rendezVous.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📅</span>
              </div>
              <p className="text-muted-foreground text-lg font-medium mb-2">
                {filter === 'all' ? 'Aucun rendez-vous programmé' : `Aucun rendez-vous pour cette période`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {rendezVous.map((rdv) => {
                const clientName = `${rdv.prenom || ''} ${rdv.nom || ''}`.trim() || 'Client';
                const dateObj = rdv.date ? new Date(rdv.date) : null;
                const formattedDate = dateObj ? dateObj.toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }) : rdv.date;
                const formattedTime = rdv.heure ? rdv.heure.substring(0, 5) : '-';
                const isPast = dateObj ? dateObj < new Date() : false;
                const statut = rdv.statut || 'en_attente';
                
                const getStatutColor = (statut: string) => {
                  if (statut === 'confirme' || statut === 'confirmé') return 'bg-green-100 text-green-800 border-green-300';
                  if (statut === 'annule' || statut === 'annulé') return 'bg-red-100 text-red-800 border-red-300';
                  if (statut === 'termine' || statut === 'terminé') return 'bg-gray-100 text-gray-800 border-gray-300';
                  return 'bg-yellow-100 text-yellow-800 border-yellow-300';
                };

                const getStatutLabel = (statut: string) => {
                  if (statut === 'confirme' || statut === 'confirmé') return 'Confirmé';
                  if (statut === 'annule' || statut === 'annulé') return 'Annulé';
                  if (statut === 'termine' || statut === 'terminé') return 'Terminé';
                  return 'En attente';
                };
                
                return (
                  <div
                    key={rdv._id || rdv.id}
                    className={`border-2 rounded-xl p-5 hover:shadow-lg transition-all duration-200 ${
                      isPast && statut !== 'termine' && statut !== 'terminé'
                        ? 'bg-gray-50 border-gray-300 opacity-75'
                        : getStatutColor(statut).split(' ')[0] === 'bg-green-100'
                        ? 'bg-green-50/50 border-green-300'
                        : getStatutColor(statut).split(' ')[0] === 'bg-red-100'
                        ? 'bg-red-50/50 border-red-300'
                        : getStatutColor(statut).split(' ')[0] === 'bg-yellow-100'
                        ? 'bg-yellow-50/50 border-yellow-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    {/* En-tête */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-1">
                          {clientName}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {rdv.email}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatutColor(statut)}`}>
                        {getStatutLabel(statut)}
                      </span>
                    </div>

                    {/* Date et heure */}
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">📅</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-foreground">
                            {formattedDate}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ⏰ {formattedTime}
                          </p>
                          {isPast && statut !== 'termine' && statut !== 'terminé' && (
                            <span className="text-xs text-orange-600 font-medium mt-1 inline-block">
                              ⚠️ Rendez-vous passé
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Informations */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">📞</span>
                        <span className="text-foreground">{rdv.telephone || 'Non renseigné'}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-muted-foreground">💼</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">Motif: {rdv.motif || 'Non spécifié'}</p>
                          {rdv.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {rdv.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {rdv.notes && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">📝</span>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            <strong>Notes:</strong> {rdv.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-200 space-y-2">
                      {statut === 'en_attente' && (
                        <div className="flex gap-2 mb-2">
                          <Button
                            variant="default"
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                            onClick={async () => {
                              try {
                                const response = await appointmentsAPI.updateAppointment(rdv._id || rdv.id, { statut: 'confirme' });
                                if (response.data.success) {
                                  await loadAppointments();
                                }
                              } catch (err: any) {
                                console.error('Erreur lors de l\'acceptation:', err);
                                setError(err.response?.data?.message || 'Erreur lors de l\'acceptation');
                              }
                            }}
                          >
                            ✓ Accepter
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1 text-xs"
                            onClick={async () => {
                              if (confirm('Êtes-vous sûr de vouloir refuser ce rendez-vous ?')) {
                                try {
                                  const response = await appointmentsAPI.updateAppointment(rdv._id || rdv.id, { statut: 'annule' });
                                  if (response.data.success) {
                                    await loadAppointments();
                                  }
                                } catch (err: any) {
                                  console.error('Erreur lors du refus:', err);
                                  setError(err.response?.data?.message || 'Erreur lors du refus');
                                }
                              }
                            }}
                          >
                            ✗ Refuser
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => {
                          const dateObj = rdv.date ? new Date(rdv.date) : new Date();
                          const formattedDate = dateObj.toISOString().split('T')[0];
                          
                          setEditFormData({
                            statut: rdv.statut || 'en_attente',
                            date: formattedDate,
                            heure: rdv.heure || '',
                            motif: rdv.motif || '',
                            description: rdv.description || '',
                            notes: rdv.notes || ''
                          });
                          setEditingRdv(rdv);
                        }}
                      >
                        ✏️ Modifier le rendez-vous
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && rendezVous.length > 0 && (
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{rendezVous.length}</span> rendez-vous{rendezVous.length > 1 ? '' : ''}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modal de modification */}
      {editingRdv && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Modifier le rendez-vous</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Client: <strong>{editingRdv.prenom} {editingRdv.nom}</strong> ({editingRdv.email})
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsSubmitting(true);
              setError(null);
              
              try {
                const updateData: any = {};
                if (editFormData.statut) updateData.statut = editFormData.statut;
                if (editFormData.date) updateData.date = editFormData.date;
                if (editFormData.heure) updateData.heure = editFormData.heure;
                if (editFormData.motif) updateData.motif = editFormData.motif;
                if (editFormData.description !== undefined) updateData.description = editFormData.description;
                if (editFormData.notes !== undefined) updateData.notes = editFormData.notes;

                const response = await appointmentsAPI.updateAppointment(editingRdv._id || editingRdv.id, updateData);
                
                if (response.data.success) {
                  setEditingRdv(null);
                  await loadAppointments();
                } else {
                  setError(response.data.message || 'Erreur lors de la modification');
                }
              } catch (err: any) {
                console.error('Erreur lors de la modification:', err);
                setError(err.response?.data?.message || 'Erreur lors de la modification du rendez-vous');
              } finally {
                setIsSubmitting(false);
              }
            }} className="space-y-4">
              {/* Statut */}
              <div>
                <Label htmlFor="editStatut">Statut *</Label>
                <select
                  id="editStatut"
                  value={editFormData.statut}
                  onChange={(e) => setEditFormData({ ...editFormData, statut: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  required
                >
                  <option value="en_attente">En attente</option>
                  <option value="confirme">Confirmé</option>
                  <option value="annule">Annulé</option>
                  <option value="termine">Terminé</option>
                </select>
              </div>

              {/* Date et Heure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editDate">Date *</Label>
                  <Input
                    id="editDate"
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editHeure">Heure *</Label>
                  <Input
                    id="editHeure"
                    type="time"
                    value={editFormData.heure}
                    onChange={(e) => setEditFormData({ ...editFormData, heure: e.target.value })}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Motif */}
              <div>
                <Label htmlFor="editMotif">Motif *</Label>
                <select
                  id="editMotif"
                  value={editFormData.motif}
                  onChange={(e) => setEditFormData({ ...editFormData, motif: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  required
                >
                  <option value="">Sélectionner un motif</option>
                  <option value="Consultation">Consultation</option>
                  <option value="Dossier administratif">Dossier administratif</option>
                  <option value="Suivi de dossier">Suivi de dossier</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Textarea
                  id="editDescription"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Description du rendez-vous (max 500 caractères)"
                  maxLength={500}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editFormData.description.length}/500 caractères
                </p>
              </div>

              {/* Notes administratives */}
              <div>
                <Label htmlFor="editNotes">Notes administratives</Label>
                <Textarea
                  id="editNotes"
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Notes internes (non visibles par le client)"
                  className="mt-1"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingRdv(null);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


