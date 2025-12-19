'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { tasksAPI, userAPI, dossiersAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel, getPrioriteColor, getPrioriteLabel } from '@/lib/taskUtils';
import { DateInput as DateInputComponent } from '@/components/ui/DateInput';

function Button({ children, variant = 'default', size = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
  const variantClasses = {
    default: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-red-500 text-white hover:bg-red-600',
  };
  const sizeClasses = {
    default: 'h-10 py-2 px-4',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>{children}</button>;
}

function Input({ className = '', type, value, onChange, ...props }: any) {
  if (type === 'date') {
    return (
      <DateInputComponent
        value={value || ''}
        onChange={(newValue: string) => {
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
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

function Label({ htmlFor, children, className = '' }: any) {
  return (
    <label htmlFor={htmlFor} className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>
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

export default function AdminTachesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'a_faire' | 'en_cours' | 'en_attente' | 'termine' | 'annule'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'basse' | 'normale' | 'haute' | 'urgente'>('all');

  const [formData, setFormData] = useState({
    titre: '',
    description: '',
    statut: 'a_faire',
    priorite: 'normale',
    assignedTo: [] as string[],
    dateEcheance: '',
    dateDebut: '',
    dossier: '',
    notes: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (session && (session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin') {
      router.push('/client');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (status === 'authenticated' && ((session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'superadmin')) {
      loadTasks();
      loadTeamMembers();
      loadDossiers();
    }
  }, [session, status]);

  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.getAllTasks();
      if (response.data.success) {
        setTasks(response.data.tasks || []);
      } else {
        setError('Erreur lors du chargement des tâches');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des tâches:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des tâches');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      if (response.data.success) {
        const members = (response.data.users || []).filter(
          (user: any) => user.role === 'admin' || user.role === 'superadmin'
        );
        setTeamMembers(members);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des membres de l\'équipe:', err);
    }
  };

  const loadDossiers = async () => {
    try {
      const response = await dossiersAPI.getAllDossiers();
      if (response.data.success) {
        setDossiers(response.data.dossiers || []);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des dossiers:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validation frontend - uniquement pour la création
      if (!editingTask) {
        if (!formData.titre || formData.titre.trim() === '') {
          setError('Le titre de la tâche est requis');
          setIsLoading(false);
          return;
        }

        if (formData.assignedTo.length === 0) {
          setError('Veuillez assigner la tâche à au moins un membre');
          setIsLoading(false);
          return;
        }
      }

      console.log('📤 Envoi des données de tâche:', {
        titre: formData.titre,
        assignedTo: formData.assignedTo,
        statut: formData.statut,
        priorite: formData.priorite
      });

      const taskData: any = {
        titre: formData.titre.trim(),
        description: formData.description?.trim() || '',
        statut: formData.statut,
        priorite: formData.priorite,
        assignedTo: formData.assignedTo, // Tableau d'IDs
        notes: formData.notes?.trim() || '',
      };

      if (formData.dateEcheance) taskData.dateEcheance = formData.dateEcheance;
      if (formData.dateDebut) taskData.dateDebut = formData.dateDebut;
      if (formData.dossier) taskData.dossier = formData.dossier;

      let response;
      if (editingTask) {
        response = await tasksAPI.updateTask(editingTask._id || editingTask.id, taskData);
      } else {
        response = await tasksAPI.createTask(taskData);
      }

      if (response.data.success) {
        await loadTasks();
        setIsCreating(false);
        setEditingTask(null);
        setFormData({
          titre: '',
          description: '',
          statut: 'a_faire',
          priorite: 'normale',
          assignedTo: [],
          dateEcheance: '',
          dateDebut: '',
          dossier: '',
          notes: '',
        });
      }
    } catch (err: any) {
      console.error('Erreur lors de la création/modification de la tâche:', err);
      console.error('Détails de l\'erreur:', {
        status: err.response?.status,
        data: err.response?.data,
        errors: err.response?.data?.errors
      });
      
      // Afficher les détails de l'erreur
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        // Erreurs de validation express-validator
        const errorMessages = err.response.data.errors.map((e: any) => 
          `${e.param || e.field || 'Champ'}: ${e.msg || e.message || 'Erreur de validation'}`
        ).join(', ');
        setError(`Erreurs de validation: ${errorMessages}`);
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Erreur lors de la création/modification de la tâche. Vérifiez que tous les champs sont remplis correctement.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    const assignedToArray = Array.isArray(task.assignedTo) 
      ? task.assignedTo.map((u: any) => u._id || u)
      : [task.assignedTo?._id || task.assignedTo].filter(Boolean);
    
    setFormData({
      titre: task.titre || '',
      description: task.description || '',
      statut: task.statut || 'a_faire',
      priorite: task.priorite || 'normale',
      assignedTo: assignedToArray,
      dateEcheance: task.dateEcheance ? new Date(task.dateEcheance).toISOString().split('T')[0] : '',
      dateDebut: task.dateDebut ? new Date(task.dateDebut).toISOString().split('T')[0] : '',
      dossier: task.dossier?._id || task.dossier || '',
      notes: task.notes || '',
    });
    setIsCreating(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.deleteTask(taskId);
      if (response.data.success) {
        await loadTasks();
        setShowDeleteConfirm(null);
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression de la tâche:', err);
      setError(err.response?.data?.message || 'Erreur lors de la suppression de la tâche');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.updateTask(taskId, { statut: newStatus });
      if (response.data.success) {
        await loadTasks();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du statut:', err);
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePriority = async (taskId: string, newPriority: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.updateTask(taskId, { priorite: newPriority });
      if (response.data.success) {
        await loadTasks();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de la priorité:', err);
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour de la priorité');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateAssignment = async (taskId: string, assignedTo: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.updateTask(taskId, { assignedTo });
      if (response.data.success) {
        await loadTasks();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de l\'assignation:', err);
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour de l\'assignation');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setFormData(prev => {
      const current = prev.assignedTo || [];
      if (current.includes(userId)) {
        return { ...prev, assignedTo: current.filter(id => id !== userId) };
      } else {
        return { ...prev, assignedTo: [...current, userId] };
      }
    });
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

  const filteredTasks = tasks.filter((task: any) => {
    const matchesSearch = !searchTerm || 
      task.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.statut === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priorite === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getDaysUntilDeadline = (dateEcheance: string | Date) => {
    if (!dateEcheance) return null;
    const deadline = new Date(dateEcheance);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 py-8 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Gestion des Tâches</h1>
            <p className="text-muted-foreground text-sm">
              Gérez toutes les tâches de l'équipe
              {tasks.filter((t: any) => t.statut === 'a_faire' || t.statut === 'en_cours').length > 0 && (
                <span className="ml-2 text-primary font-semibold">
                  ({tasks.filter((t: any) => t.statut === 'a_faire' || t.statut === 'en_cours').length} en cours)
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)} className="shadow-md hover:shadow-lg transition-shadow">
            + Créer une tâche
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Formulaire de création/modification - Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-8">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-foreground">
                  {editingTask ? 'Modifier la tâche' : 'Créer une nouvelle tâche'}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setEditingTask(null);
                    setFormData({
                      titre: '',
                      description: '',
                      statut: 'a_faire',
                      priorite: 'normale',
                      assignedTo: [],
                      dateEcheance: '',
                      dateDebut: '',
                      dossier: '',
                      notes: '',
                    });
                  }}
                  className="text-muted-foreground hover:text-foreground text-2xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <Label htmlFor="titre">Titre de la tâche {!editingTask && '*'}</Label>
                  <Input
                    id="titre"
                    value={formData.titre}
                    onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                    required={!editingTask}
                    className="mt-1"
                    placeholder="Ex: Préparer le dossier de demande de titre de séjour"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="mt-1"
                    rows={3}
                    placeholder="Description détaillée de la tâche..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="statut">Statut</Label>
                    <select
                      id="statut"
                      value={formData.statut}
                      onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      <option value="a_faire">À faire</option>
                      <option value="en_cours">En cours</option>
                      <option value="en_attente">En attente</option>
                      <option value="termine">Terminé</option>
                      <option value="annule">Annulé</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="priorite">Priorité</Label>
                    <select
                      id="priorite"
                      value={formData.priorite}
                      onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                    >
                      <option value="basse">Basse</option>
                      <option value="normale">Normale</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="assignedTo">Assigner à {!editingTask && '*'}</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {teamMembers.map((member) => (
                      <label key={member._id || member.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.assignedTo.includes(member._id || member.id)}
                          onChange={() => toggleAssignee(member._id || member.id)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm">
                          {member.firstName} {member.lastName} ({member.email})
                        </span>
                      </label>
                    ))}
                  </div>
                  {formData.assignedTo.length === 0 && !editingTask && (
                    <p className="text-xs text-red-600 mt-1">Veuillez sélectionner au moins un membre</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dateDebut">Date de début</Label>
                    <Input
                      id="dateDebut"
                      type="date"
                      value={formData.dateDebut}
                      onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateEcheance">Date d'échéance</Label>
                    <Input
                      id="dateEcheance"
                      type="date"
                      value={formData.dateEcheance}
                      onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dossier">Lier à un dossier (optionnel)</Label>
                  <select
                    id="dossier"
                    value={formData.dossier}
                    onChange={(e) => setFormData({ ...formData, dossier: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  >
                    <option value="">-- Aucun dossier --</option>
                    {dossiers.map((dossier) => (
                      <option key={dossier._id || dossier.id} value={dossier._id || dossier.id}>
                        {dossier.titre} - {dossier.user ? `${dossier.user.firstName} ${dossier.user.lastName}` : `${dossier.clientPrenom} ${dossier.clientNom}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes internes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1"
                    rows={2}
                    placeholder="Notes internes pour l'équipe..."
                  />
                </div>

                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex gap-3 justify-end mt-6">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsCreating(false);
                    setEditingTask(null);
                    setFormData({
                      titre: '',
                      description: '',
                      statut: 'a_faire',
                      priorite: 'normale',
                      assignedTo: [],
                      dateEcheance: '',
                      dateDebut: '',
                      dossier: '',
                      notes: '',
                    });
                  }} disabled={isLoading}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading || formData.assignedTo.length === 0}>
                    {isLoading ? (editingTask ? 'Mise à jour...' : 'Création...') : (editingTask ? 'Mettre à jour' : 'Créer la tâche')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Liste des tâches */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
          {/* Barre de recherche et filtres */}
          <div className="mb-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:max-w-md">
              <input
                type="text"
                placeholder="🔍 Rechercher une tâche..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-300 bg-background px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="flex h-10 rounded-lg border border-gray-300 bg-background px-3 py-2 text-sm"
              >
                <option value="all">Tous les statuts</option>
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="en_attente">En attente</option>
                <option value="termine">Terminé</option>
                <option value="annule">Annulé</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="flex h-10 rounded-lg border border-gray-300 bg-background px-3 py-2 text-sm"
              >
                <option value="all">Toutes les priorités</option>
                <option value="urgente">Urgente</option>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
                <option value="basse">Basse</option>
              </select>
              <Button onClick={loadTasks} variant="outline" size="sm" className="whitespace-nowrap">
                🔄 Actualiser
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Chargement des tâches...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📋</span>
              </div>
              <p className="text-muted-foreground text-lg font-medium mb-2">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' 
                  ? 'Aucune tâche ne correspond aux filtres' 
                  : 'Aucune tâche trouvée'}
              </p>
              {!searchTerm && statusFilter === 'all' && priorityFilter === 'all' && (
                <p className="text-sm text-muted-foreground">Commencez par créer votre première tâche</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map((task) => {
                const assignedToArray = Array.isArray(task.assignedTo) 
                  ? task.assignedTo 
                  : [task.assignedTo].filter(Boolean);
                const daysUntilDeadline = getDaysUntilDeadline(task.dateEcheance);
                const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 2 && daysUntilDeadline >= 0;

                return (
                  <div
                    key={task._id || task.id}
                    className={`border rounded-xl p-5 hover:shadow-xl transition-all duration-200 bg-white ${
                      task.statut === 'a_faire'
                        ? 'border-l-4 border-l-gray-500'
                        : task.statut === 'en_cours'
                        ? 'border-l-4 border-l-blue-500'
                        : task.statut === 'en_attente'
                        ? 'border-l-4 border-l-yellow-500'
                        : task.statut === 'termine'
                        ? 'border-l-4 border-l-green-500'
                        : 'border-l-4 border-l-red-500'
                    } ${isUrgent ? 'ring-2 ring-red-300' : ''}`}
                  >
                    {/* En-tête de la carte */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="font-bold text-base text-foreground mb-1 line-clamp-2 leading-tight">
                          {task.titre}
                        </h3>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getStatutColor(task.statut)}`}>
                          {getStatutLabel(task.statut)}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getPrioriteColor(task.priorite)}`}>
                          {getPrioriteLabel(task.priorite)}
                        </span>
                      </div>
                    </div>

                    {/* Informations de la tâche */}
                    <div className="space-y-2 mb-3">
                      {assignedToArray.length > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">👥</span>
                          <div className="flex-1 min-w-0">
                            {assignedToArray.map((assigned: any, idx: number) => {
                              const name = assigned?.firstName && assigned?.lastName
                                ? `${assigned.firstName} ${assigned.lastName}`
                                : assigned?.email || 'Utilisateur';
                              return (
                                <div key={idx} className="text-xs">
                                  <span className="font-medium text-foreground">{name}</span>
                                  {idx < assignedToArray.length - 1 && <span className="text-muted-foreground">, </span>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {task.dossier && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>📁</span>
                          <span className="truncate">{task.dossier.titre || 'Dossier lié'}</span>
                        </div>
                      )}

                      {task.dateEcheance && (
                        <div className={`flex items-center gap-2 text-xs ${isUrgent ? 'text-red-600 font-semibold' : 'text-orange-600'}`}>
                          <span>⏰</span>
                          <span>
                            Échéance: {new Date(task.dateEcheance).toLocaleDateString('fr-FR')}
                            {daysUntilDeadline !== null && (
                              <span className="ml-1">
                                ({daysUntilDeadline === 0 ? "Aujourd'hui" : daysUntilDeadline === 1 ? 'Demain' : `Dans ${daysUntilDeadline} jours`})
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {task.createdBy && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>👤</span>
                          <span>
                            Créée par {task.createdBy.firstName} {task.createdBy.lastName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-gray-200 space-y-2">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTask(task)}
                          className="flex-1 text-xs h-8"
                        >
                          ✏️ Modifier
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteConfirm(task._id || task.id)}
                          className="text-xs h-8 px-3"
                        >
                          🗑️
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            📋 Statut
                          </label>
                          <select
                            value={task.statut}
                            onChange={(e) => handleUpdateStatus(task._id || task.id, e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors w-full"
                            disabled={isLoading}
                          >
                            <option value="a_faire">À faire</option>
                            <option value="en_cours">En cours</option>
                            <option value="en_attente">En attente</option>
                            <option value="termine">Terminé</option>
                            <option value="annule">Annulé</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            ⚡ Priorité
                          </label>
                          <select
                            value={task.priorite}
                            onChange={(e) => handleUpdatePriority(task._id || task.id, e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors w-full"
                            disabled={isLoading}
                          >
                            <option value="basse">Basse</option>
                            <option value="normale">Normale</option>
                            <option value="haute">Haute</option>
                            <option value="urgente">Urgente</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          👥 Assigner à
                        </label>
                        <details className="relative">
                          <summary
                            className="list-none cursor-pointer text-xs px-2 py-1.5 rounded-md border border-gray-300 bg-background hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors w-full flex items-center justify-between gap-2"
                            onClick={(e) => {
                              // empêcher le clic sur certains éléments enfants de fermer/ouvrir involontairement
                              e.stopPropagation();
                            }}
                          >
                            <span className="truncate">
                              {assignedToArray.length === 0
                                ? 'Choisir...'
                                : assignedToArray.length === 1
                                ? (() => {
                                    const a: any = assignedToArray[0];
                                    const m = teamMembers.find((u) => (u._id || u.id) === (a?._id || a));
                                    return m ? `${m.firstName} ${m.lastName}` : '1 sélectionné';
                                  })()
                                : `${assignedToArray.length} sélectionnés`}
                            </span>
                            <span className="text-gray-500">▾</span>
                          </summary>

                          <div
                            className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg p-2 max-h-56 overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <p className="text-[10px] text-muted-foreground px-2 pb-2">
                              Dépliez la liste puis cochez une ou plusieurs personnes.
                            </p>
                            {teamMembers.length === 0 ? (
                              <p className="text-xs text-muted-foreground p-2">
                                Aucun membre disponible
                              </p>
                            ) : (
                              <div className="space-y-1">
                                {teamMembers.map((member) => {
                                  const memberId = (member._id || member.id)?.toString();
                                  const currentIds = assignedToArray.map((a: any) => (a?._id || a)?.toString()).filter(Boolean);
                                  const isChecked = currentIds.includes(memberId);
                                  const wouldBeEmpty = isChecked && currentIds.length === 1;

                                  return (
                                    <label
                                      key={memberId}
                                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        disabled={isLoading || wouldBeEmpty}
                                        onChange={() => {
                                          const next = isChecked
                                            ? currentIds.filter((id) => id !== memberId)
                                            : [...currentIds, memberId];

                                          if (next.length === 0) {
                                            // Ne pas autoriser une tâche sans assignation
                                            return;
                                          }

                                          handleUpdateAssignment(task._id || task.id, next);
                                        }}
                                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                      />
                                      <span className="text-xs text-gray-800">
                                        {member.firstName} {member.lastName}
                                      </span>
                                      {wouldBeEmpty && (
                                        <span className="ml-auto text-[10px] text-muted-foreground">
                                          min. 1
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </details>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Dépliez la liste puis cochez une ou plusieurs personnes.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && filteredTasks.length > 0 && (
            <div className="mt-6 pt-4 border-t flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{filteredTasks.length}</span> tâche{filteredTasks.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Modal de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirmer la suppression</h3>
            <p className="text-muted-foreground mb-6">
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} disabled={isLoading}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => handleDeleteTask(showDeleteConfirm)} disabled={isLoading}>
                {isLoading ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
