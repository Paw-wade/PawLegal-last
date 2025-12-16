'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageNotificationModal } from '@/components/MessageNotificationModal';
import { userAPI, appointmentsAPI, documentsAPI, tasksAPI, messagesAPI, dossiersAPI } from '@/lib/api';
import { getStatutColor, getStatutLabel, getPrioriteColor } from '@/lib/dossierUtils';
import { useCmsText } from '@/lib/contentClient';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return <button className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>{children}</button>;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState({
    utilisateurs: 0,
    dossiers: 0,
    rendezVous: 0,
    documents: 0,
    dossiersEnCours: 0,
    nouveauxClients: 0,
    revenus: 0,
    tasks: 0,
    tasksEnCours: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [tomorrowAppointments, setTomorrowAppointments] = useState<any[]>([]);
  const [weekTasks, setWeekTasks] = useState<any[]>([]);
  // Fonction pour obtenir la date du jour au format YYYY-MM-DD
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [taskFormData, setTaskFormData] = useState({
    titre: '',
    description: '',
    assignedTo: '',
    priorite: 'normale',
    dateEcheance: getTodayDate(),
    dossier: '',
  });
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  // État pour gérer l'index du document affiché pour chaque utilisateur
  const [documentIndices, setDocumentIndices] = useState<{ [userId: string]: number }>({});
  const [unreadMessage, setUnreadMessage] = useState<any>(null);
  const [messagesPreview, setMessagesPreview] = useState<any[]>([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [hasCheckedMessages, setHasCheckedMessages] = useState(false);
  const [showTasksNotificationModal, setShowTasksNotificationModal] = useState(false);
  const [hasShownTasksNotification, setHasShownTasksNotification] = useState(false);
  const [selectedTaskForStatus, setSelectedTaskForStatus] = useState<any>(null);
  const [showTaskStatusModal, setShowTaskStatusModal] = useState(false);
  const [taskStatusComment, setTaskStatusComment] = useState('');
  const [isUpdatingTaskStatus, setIsUpdatingTaskStatus] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'a_faire' | 'en_cours' | 'termine' | 'en_attente'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | 'urgente' | 'haute' | 'normale' | 'basse'>('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('all');
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any>(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);
  const [isUpdatingTaskAssignment, setIsUpdatingTaskAssignment] = useState(false);
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [isDocumentsSectionCollapsed, setIsDocumentsSectionCollapsed] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const hasChecked = useRef(false);
  const [newTaskNote, setNewTaskNote] = useState('');
  const [isAddingTaskNote, setIsAddingTaskNote] = useState(false);
  const [taskNotesError, setTaskNotesError] = useState<string | null>(null);

  // Textes CMS pour le header du dashboard admin
  const dashboardTitle = useCmsText(
    'admin.dashboard.title',
    'Tableau de bord Administrateur'
  );
  const dashboardSubtitle = useCmsText(
    'admin.dashboard.subtitle',
    "Vue d'ensemble de votre cabinet juridique"
  );

  useEffect(() => {
    // Empêcher les vérifications multiples
    if (hasChecked.current) {
      return;
    }

    if (status === 'loading') {
      return; // Attendre que la session soit chargée
    }

    if (status === 'unauthenticated') {
      hasChecked.current = true;
      window.location.href = '/auth/signin';
      return;
    }

    if (!session) {
      return; // Attendre que la session soit disponible
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== 'admin' && userRole !== 'superadmin') {
      hasChecked.current = true;
      window.location.href = '/client';
      return;
    }

    // Si on est admin, charger les statistiques
    hasChecked.current = true;
    loadStats();
    loadTasks();
    loadTeamMembers();
    checkUnreadMessages();
    loadNotifications();
  }, [session, status]);

  // Vérifier les messages non lus à la connexion
  const checkUnreadMessages = async () => {
    if (hasCheckedMessages) return;
    
    try {
      const response = await messagesAPI.getMessages({ type: 'unread' });
      if (response.data.success && response.data.messages && response.data.messages.length > 0) {
        // Prendre le message le plus récent
        const latestMessage = response.data.messages[0];
        setUnreadMessage(latestMessage);
        setShowMessageModal(true);
        // Garder un aperçu des 3 derniers messages pour le dashboard
        setMessagesPreview(response.data.messages.slice(0, 3));
        setHasCheckedMessages(true);
      } else {
        setMessagesPreview([]);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des messages:', error);
    }
  };

  const loadStats = async () => {
    try {
      // Charger les utilisateurs
      const usersResponse = await userAPI.getAllUsers();
      if (usersResponse.data.success) {
        const users = usersResponse.data.users || [];
        const totalUsers = users.length;
        const newUsers = users.filter((user: any) => {
          const createdAt = new Date(user.createdAt);
          const now = new Date();
          const daysDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 30; // Utilisateurs créés dans les 30 derniers jours
        }).length;

        setStats(prev => ({
          ...prev,
          utilisateurs: totalUsers,
          nouveauxClients: newUsers,
        }));
      }

      // Charger les rendez-vous
      const appointmentsResponse = await appointmentsAPI.getAllAppointments();
      if (appointmentsResponse.data.success) {
        const appointments = appointmentsResponse.data.data || appointmentsResponse.data.appointments || [];
        setStats(prev => ({
          ...prev,
          rendezVous: appointments.length,
        }));
      }

      // Charger les documents
      try {
        console.log('📄 Chargement des documents pour le dashboard admin...');
        const documentsResponse = await documentsAPI.getAllDocuments();
        console.log('📄 Réponse getAllDocuments:', documentsResponse.data);
        
        if (documentsResponse.data.success) {
          const documents = documentsResponse.data.documents || documentsResponse.data.data || [];
          console.log('📄 Documents trouvés:', documents.length);
          
          setStats(prev => ({
            ...prev,
            documents: documents.length,
          }));
          // Garder les 5 documents les plus récents
          setRecentDocuments(documents.slice(0, 5));
        } else {
          console.error('❌ Erreur dans la réponse getAllDocuments:', documentsResponse.data.message);
          // Mettre à jour avec 0 si erreur
          setStats(prev => ({
            ...prev,
            documents: 0,
          }));
        }
      } catch (docError: any) {
        console.error('❌ Erreur lors du chargement des documents:', docError);
        console.error('Détails:', {
          message: docError.message,
          response: docError.response?.data,
          status: docError.response?.status
        });
        // Mettre à jour avec 0 si erreur
        setStats(prev => ({
          ...prev,
          documents: 0,
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    }
  };

  const handleDownloadDocument = async (documentId: string, nom: string) => {
    try {
      const response = await documentsAPI.downloadDocument(documentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nom);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erreur lors du téléchargement:', err);
      alert('Erreur lors du téléchargement du document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (typeMime: string) => {
    if (typeMime.includes('pdf')) return '📄';
    if (typeMime.includes('image')) return '🖼️';
    if (typeMime.includes('word') || typeMime.includes('document')) return '📝';
    if (typeMime.includes('excel') || typeMime.includes('spreadsheet')) return '📊';
    return '📎';
  };

  const loadTasks = async () => {
    try {
      const response = await tasksAPI.getAllTasks();
      if (response.data.success) {
        const allTasks = response.data.tasks || [];
        setTasks(allTasks);
        const tasksEnCours = allTasks.filter((t: any) => 
          t.statut === 'a_faire' || t.statut === 'en_cours' || t.statut === 'en_attente'
        ).length;
        setStats(prev => ({
          ...prev,
          tasks: allTasks.length,
          tasksEnCours,
        }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des tâches:', error);
    }
  };

  // Fonction loadDossiers supprimée car les dossiers ne sont plus affichés sur le dashboard


  const loadTeamMembers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      if (response.data.success) {
        const users = response.data.users || [];
        // Filtrer pour ne garder que les membres de l'équipe (admin, superadmin, avocat, etc.)
        const members = users.filter((user: any) => 
          ['admin', 'superadmin', 'avocat', 'assistant', 'comptable', 'secretaire', 'juriste', 'stagiaire'].includes(user.role)
        );
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des membres:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      // Charger tous les rendez-vous
      const appointmentsResponse = await appointmentsAPI.getAllAppointments();
      if (appointmentsResponse.data.success) {
        const appointments = appointmentsResponse.data.data || appointmentsResponse.data.appointments || [];
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);

        // Filtrer les rendez-vous du jour
        const todayApps = appointments.filter((apt: any) => {
          if (!apt.date) return false;
          const aptDate = new Date(apt.date);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === today.getTime() && apt.statut !== 'annule' && apt.statut !== 'annulé';
        });

        // Filtrer les rendez-vous du lendemain
        const tomorrowApps = appointments.filter((apt: any) => {
          if (!apt.date) return false;
          const aptDate = new Date(apt.date);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.getTime() === tomorrow.getTime() && apt.statut !== 'annule' && apt.statut !== 'annulé';
        });

        setTodayAppointments(todayApps);
        setTomorrowAppointments(tomorrowApps);
      }

      // Charger les tâches de la semaine
      const tasksResponse = await tasksAPI.getAllTasks();
      if (tasksResponse.data.success && session) {
        const allTasks = tasksResponse.data.tasks || [];
        const now = new Date();
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const weekTasks = allTasks.filter((task: any) => {
          if (!task.dateEcheance) return false;
          const taskDate = new Date(task.dateEcheance);
          return taskDate <= weekFromNow && 
                 (task.statut === 'a_faire' || task.statut === 'en_cours' || task.statut === 'en_attente');
        });
        
        setWeekTasks(weekTasks);
        
        // Filtrer les tâches assignées à l'admin connecté
        // Note: Le popup de notification des tâches a été désactivé
        // const currentUserId = (session.user as any)?.id;
        // const tasksForAdmin = weekTasks.filter((task: any) => {
        //   // Tâches assignées à l'admin connecté
        //   if (task.assignedTo) {
        //     if (typeof task.assignedTo === 'object' && task.assignedTo._id === currentUserId) {
        //       return true;
        //     }
        //     if (typeof task.assignedTo === 'string' && task.assignedTo === currentUserId) {
        //       return true;
        //     }
        //   }
        //   return false;
        // });
        
        // Afficher la pop-up si il y a des tâches et qu'elle n'a pas encore été affichée
        // DÉSACTIVÉ: Le popup des tâches ne s'affiche plus à la connexion
        // if (tasksForAdmin.length > 0 && !hasShownTasksNotification) {
        //   setTimeout(() => {
        //     setShowTasksNotificationModal(true);
        //     setHasShownTasksNotification(true);
        //   }, 1000); // Délai de 1 seconde après le chargement
        // }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des notifications:', error);
    }
  };

  const handleOpenTaskDetail = async (task: any) => {
    try {
      setTaskNotesError(null);
      setNewTaskNote('');
      // Recharger la tâche depuis l'API pour inclure l'historique des commentaires
      const id = task._id || task.id;
      const response = await tasksAPI.getTaskById(id);
      if (response.data.success && response.data.task) {
        setSelectedTaskDetail(response.data.task);
      } else {
        setSelectedTaskDetail(task);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du détail de la tâche:', error);
      // En cas d'erreur, afficher au moins les infos de base déjà chargées
      setSelectedTaskDetail(task);
    } finally {
      setShowTaskDetailModal(true);
    }
  };

  const handleAddTaskNote = async () => {
    if (!selectedTaskDetail || !newTaskNote.trim()) return;
    try {
      setIsAddingTaskNote(true);
      setTaskNotesError(null);
      const id = selectedTaskDetail._id || selectedTaskDetail.id;
      const response = await tasksAPI.addNoteToTask(id, { contenu: newTaskNote.trim() });
      if (response.data.success && response.data.task) {
        const updatedTask = response.data.task;
        // Mettre à jour le détail
        setSelectedTaskDetail(updatedTask);
        // Mettre à jour la liste principale
        setTasks(prev =>
          prev.map((t: any) => (t._id === updatedTask._id ? { ...t, ...updatedTask } : t))
        );
        setNewTaskNote('');
      } else {
        setTaskNotesError(response.data.message || 'Erreur lors de l\'ajout de la note');
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout de la note de tâche:', error);
      setTaskNotesError(
        error.response?.data?.message || 'Erreur lors de l\'ajout de la note de tâche'
      );
    } finally {
      setIsAddingTaskNote(false);
    }
  };

  const handleUpdateTaskAssignment = async () => {
    if (!selectedTaskDetail || !newAssigneeId) {
      return;
    }

    setIsUpdatingTaskAssignment(true);
    try {
      await tasksAPI.updateTask(selectedTaskDetail._id, {
        assignedTo: newAssigneeId
      });
      
      // Recharger les tâches
      await loadTasks();
      
      // Mettre à jour la tâche sélectionnée
      const updatedTask = tasks.find((t: any) => t._id === selectedTaskDetail._id);
      if (updatedTask) {
        setSelectedTaskDetail(updatedTask);
      }
      
      setNewAssigneeId('');
      alert('Assignation mise à jour avec succès !');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de l\'assignation:', error);
      alert('Erreur lors de la mise à jour de l\'assignation: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsUpdatingTaskAssignment(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskFormData.titre || !taskFormData.assignedTo) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmittingTask(true);
    try {
      const response = await tasksAPI.createTask(taskFormData);
      if (response.data.success) {
        setShowTaskModal(false);
        setTaskFormData({
          titre: '',
          description: '',
          assignedTo: '',
          priorite: 'normale',
          dateEcheance: '',
          dossier: '',
        });
        loadTasks();
        alert('Tâche créée avec succès !');
      }
    } catch (error: any) {
      console.error('Erreur lors de la création de la tâche:', error);
      alert(error.response?.data?.message || 'Erreur lors de la création de la tâche');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (effectue: boolean) => {
    if (!selectedTaskForStatus) return;

    setIsUpdatingTaskStatus(true);
    try {
      const response = await tasksAPI.updateTask(selectedTaskForStatus._id, {
        effectue: effectue,
        commentaireEffectue: taskStatusComment,
        statut: effectue ? 'termine' : 'a_faire',
      });

      if (response.data.success) {
        setShowTaskStatusModal(false);
        setSelectedTaskForStatus(null);
        setTaskStatusComment('');
        await loadTasks();
        await loadNotifications();
      } else {
        alert(response.data.message || 'Erreur lors de la mise à jour de la tâche');
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de la tâche:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour de la tâche');
    } finally {
      setIsUpdatingTaskStatus(false);
    }
  };

  const handleInlineStatusChange = async (task: any, newStatus: string) => {
    if (!newStatus || task.statut === newStatus) return;
    setUpdatingTaskId(task._id);
    try {
      const response = await tasksAPI.updateTask(task._id, { statut: newStatus });
      if (response.data.success) {
        const updatedTask = response.data.task;
        setTasks(prev =>
          prev.map((t: any) => (t._id === updatedTask._id ? updatedTask : t))
        );
        if (selectedTaskDetail && selectedTaskDetail._id === updatedTask._id) {
          setSelectedTaskDetail(updatedTask);
        }
      } else {
        alert(response.data.message || 'Erreur lors de la mise à jour du statut de la tâche');
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du statut de la tâche:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour du statut de la tâche');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleInlinePriorityChange = async (task: any, newPriority: string) => {
    if (!newPriority || task.priorite === newPriority) return;
    setUpdatingTaskId(task._id);
    try {
      const response = await tasksAPI.updateTask(task._id, { priorite: newPriority });
      if (response.data.success) {
        const updatedTask = response.data.task;
        setTasks(prev =>
          prev.map((t: any) => (t._id === updatedTask._id ? updatedTask : t))
        );
        if (selectedTaskDetail && selectedTaskDetail._id === updatedTask._id) {
          setSelectedTaskDetail(updatedTask);
        }
      } else {
        alert(response.data.message || 'Erreur lors de la mise à jour de la priorité de la tâche');
      }
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de la priorité de la tâche:', error);
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour de la priorité de la tâche');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'termine':
        return 'bg-green-100 text-green-800';
      case 'en_cours':
        return 'bg-yellow-100 text-yellow-800';
      case 'en_attente':
        return 'bg-blue-100 text-blue-800';
      case 'annule':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatutLabel = (statut: string) => {
    const labels: { [key: string]: string } = {
      'a_faire': 'À faire',
      'en_cours': 'En cours',
      'en_attente': 'En attente',
      'termine': 'Terminée',
      'annule': 'Annulé',
    };
    return labels[statut] || statut;
  };

  const getPrioriteColor = (priorite: string) => {
    switch (priorite) {
      case 'urgente':
        return 'bg-red-100 text-red-800';
      case 'haute':
        return 'bg-orange-100 text-orange-800';
      case 'normale':
        return 'bg-blue-100 text-blue-800';
      case 'basse':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Afficher un loader pendant le chargement de la session
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

  // Si pas de session ou pas admin, ne rien afficher (la redirection est gérée dans useEffect)
  if (!session || ((session.user as any)?.role !== 'admin' && (session.user as any)?.role !== 'superadmin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <main className="container mx-auto px-4 py-8">
        {/* En-tête avec navigation rapide */}
        <div id="dashboard-top" className="mb-8 scroll-mt-20">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {dashboardTitle}
              </h1>
              <p className="text-muted-foreground text-lg">{dashboardSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Notifications intelligentes */}
        {tomorrowAppointments.length > 0 && (
          <div className="mb-8 grid md:grid-cols-1 gap-4">
            {/* Rendez-vous du lendemain */}
            {tomorrowAppointments.length > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl shadow-lg p-6 border-2 border-orange-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📆</span>
        </div>
                  <div>
                    <h3 className="font-bold text-lg text-orange-900">Rendez-vous demain</h3>
                    <p className="text-sm text-orange-700">{tomorrowAppointments.length} rendez-vous</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tomorrowAppointments.slice(0, 5).map((apt: any) => {
                    const clientName = `${apt.prenom || ''} ${apt.nom || ''}`.trim() || 'Client';
                    return (
                      <div key={apt._id || apt.id} className="p-2 rounded-lg bg-white border border-orange-200">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        <p className="text-xs text-muted-foreground">⏰ {apt.heure?.substring(0, 5) || '-'}</p>
                      </div>
                    );
                  })}
                </div>
                <Link href="/admin/rendez-vous" className="mt-4 inline-block text-sm text-orange-700 hover:text-orange-900 font-semibold">
                  Voir tous →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Statistiques principales - Design professionnel et chaleureux avec accès direct */}
        <div id="utilisateurs-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 scroll-mt-20">
          {/* Badge Utilisateurs avec lien direct */}
          <Link href="/admin/utilisateurs" className="group">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-primary hover:shadow-lg hover:border-primary/80 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground mb-0 group-hover:text-primary transition-colors">{stats.utilisateurs}</p>
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Utilisateurs</h3>
              <p className="text-xs text-muted-foreground mb-3">Clients actifs</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold group-hover:bg-primary/20 transition-colors">
                  +{stats.nouveauxClients} ce mois
                </span>
                <span className="text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Accéder →</span>
              </div>
            </div>
          </Link>

          {/* Badge Documents avec lien direct */}
          <div id="documents-section" className="scroll-mt-20">
          <Link href="/admin/documents" className="group">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg hover:border-purple-600 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                  <span className="text-2xl">📄</span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground mb-0 group-hover:text-purple-600 transition-colors">{stats.documents}</p>
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Documents</h3>
              <p className="text-xs text-muted-foreground mb-3">Total des documents</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-muted-foreground">Téléversés par les clients</span>
                <span className="text-purple-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Accéder →</span>
              </div>
            </div>
          </Link>
          </div>

          {/* Badge Tâches - lien vers la page dédiée */}
          <Link href="/admin/taches" className="group">
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg hover:border-orange-600 transition-all duration-200 hover:-translate-y-1 cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground mb-0 group-hover:text-orange-600 transition-colors">{stats.tasks}</p>
                </div>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Tâches</h3>
              <p className="text-xs text-muted-foreground mb-3">Gestion complète des tâches</p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-orange-500/10 text-orange-600 text-xs font-semibold">
                  {stats.tasksEnCours} en cours
                </span>
                <span className="text-orange-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Accéder →</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Actions rapides - Seulement les sections sans doublons */}
        <div id="dossiers-section" className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 scroll-mt-20">
          <Link href="/admin/dossiers" className="group">
            <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-blue-200 hover:border-blue-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📁</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors mb-1">Dossiers</h3>
                  <p className="text-sm text-muted-foreground">Suivez tous les dossiers</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-blue-200">
                <span className="text-xs font-medium text-blue-600">Accéder →</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-blue-600 text-sm">→</span>
                </div>
              </div>
            </div>
          </Link>

          <div id="rendez-vous-section" className="scroll-mt-20">
          <Link href="/admin/rendez-vous" className="group">
            <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-green-200 hover:border-green-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📅</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-green-600 transition-colors mb-1">Rendez-vous</h3>
                  <p className="text-sm text-muted-foreground">Gérez le calendrier</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-green-200">
                <span className="text-xs font-medium text-green-600">Accéder →</span>
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <span className="text-green-600 text-sm">→</span>
                </div>
              </div>
            </div>
          </Link>
          </div>

          <div id="temoignages-section" className="scroll-mt-20">
          <Link href="/admin/temoignages" className="group">
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border border-purple-200 hover:border-purple-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">⭐</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-purple-600 transition-colors mb-1">Témoignages</h3>
                  <p className="text-sm text-muted-foreground">Validez les avis</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-purple-200">
                <span className="text-xs font-medium text-purple-600">Accéder →</span>
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <span className="text-purple-600 text-sm">→</span>
                </div>
              </div>
            </div>
          </Link>
          </div>

          {/* Navigation rapide vers l'impersonation */}
          <Link href="/admin/impersonate" className="group">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">👤</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors mb-1">Impersonation</h3>
                  <p className="text-sm text-muted-foreground">Consulter un compte client</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-blue-200">
                <span className="text-xs font-medium text-blue-600">Accéder →</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <span className="text-blue-600 text-sm">→</span>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Colonne droite : bloc messagerie intégré au dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2" />
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span>✉️ Messagerie interne</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Accédez rapidement à vos échanges avec les clients et l&apos;équipe.
                  </p>
                </div>
                <Link href="/admin/messages">
                  <Button variant="outline" className="text-xs">
                    Ouvrir la messagerie
                  </Button>
                </Link>
              </div>
              {messagesPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun message non lu pour le moment.
                </p>
              ) : (
                <div className="space-y-3">
                  {messagesPreview.map((msg) => (
                    <Link
                      key={msg._id || msg.id}
                      href={`/admin/messages/${msg._id || msg.id}`}
                      className="block rounded-lg border border-gray-100 px-3 py-2 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{msg.sujet}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {msg.contenu}
                          </p>
                        </div>
                        <span className="ml-2 flex-shrink-0 rounded-full bg-primary text-white text-[10px] px-2 py-0.5">
                          Voir
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section Gestion des Tâches */}
        <div id="tasks-section" className="bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-lg p-8 mb-8 border border-orange-200">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Gestion des Tâches</h2>
                  <p className="text-muted-foreground text-sm mt-1">Créez et assignez des tâches aux membres de l'équipe</p>
                </div>
              </div>
            </div>
            <Button onClick={() => setShowTaskModal(true)} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md">
              + Nouvelle tâche
            </Button>
          </div>

          {/* Statistiques des tâches (badges cliquables pour filtrer) */}
          {tasks.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setTaskFilter('all')}
                className={`text-left bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg p-4 shadow-sm transition-all ${
                  taskFilter === 'all'
                    ? 'ring-2 ring-blue-500/60 shadow-md'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <p className="text-xs text-blue-700 font-semibold mb-1 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-blue-900">{tasks.length}</p>
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('a_faire')}
                className={`text-left bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 rounded-lg p-4 shadow-sm transition-all ${
                  taskFilter === 'a_faire' || taskFilter === 'en_attente'
                    ? 'ring-2 ring-yellow-500/60 shadow-md'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <p className="text-xs text-yellow-700 font-semibold mb-1 uppercase tracking-wide">À faire</p>
                <p className="text-2xl font-bold text-yellow-900">
                  {tasks.filter((t: any) => t.statut === 'a_faire' || t.statut === 'en_attente').length}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('en_cours')}
                className={`text-left bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 rounded-lg p-4 shadow-sm transition-all ${
                  taskFilter === 'en_cours'
                    ? 'ring-2 ring-purple-500/60 shadow-md'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <p className="text-xs text-purple-700 font-semibold mb-1 uppercase tracking-wide">En cours</p>
                <p className="text-2xl font-bold text-purple-900">
                  {tasks.filter((t: any) => t.statut === 'en_cours').length}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setTaskFilter('termine')}
                className={`text-left bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 rounded-lg p-4 shadow-sm transition-all ${
                  taskFilter === 'termine'
                    ? 'ring-2 ring-green-500/60 shadow-md'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <p className="text-xs text-green-700 font-semibold mb-1 uppercase tracking-wide">Terminées</p>
                <p className="text-2xl font-bold text-green-900">
                  {tasks.filter((t: any) => t.statut === 'termine' || t.effectue).length}
                </p>
              </button>
            </div>
          )}

          {/* Filtres */}
          {tasks.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-3 items-center bg-white rounded-lg p-4 border border-gray-200">
              <span className="text-sm font-medium text-muted-foreground">Filtres:</span>
              
              {/* Filtre par statut */}
              <select
                value={taskFilter}
                onChange={(e) => setTaskFilter(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="en_attente">En attente</option>
                <option value="termine">Terminées</option>
              </select>

              {/* Filtre par priorité */}
              <select
                value={taskPriorityFilter}
                onChange={(e) => setTaskPriorityFilter(e.target.value as any)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Toutes les priorités</option>
                <option value="urgente">Urgente</option>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
                <option value="basse">Basse</option>
              </select>

              {/* Filtre par assigné */}
              <select
                value={taskAssigneeFilter}
                onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">Tous les assignés</option>
                {teamMembers.map((member: any) => (
                  <option key={member._id} value={member._id}>
                    {member.firstName} {member.lastName}
                  </option>
                ))}
              </select>

              {/* Bouton réinitialiser */}
              {(taskFilter !== 'all' || taskPriorityFilter !== 'all' || taskAssigneeFilter !== 'all') && (
                <button
                  onClick={() => {
                    setTaskFilter('all');
                    setTaskPriorityFilter('all');
                    setTaskAssigneeFilter('all');
                  }}
                  className="px-3 py-1.5 text-sm text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md transition-colors"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <p className="text-muted-foreground mb-4 font-medium">Aucune tâche pour le moment</p>
              <Button onClick={() => setShowTaskModal(true)} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                Créer la première tâche
              </Button>
            </div>
          ) : (() => {
            // Filtrer les tâches
            const filteredTasks = tasks.filter((task: any) => {
              const matchStatut = taskFilter === 'all' || task.statut === taskFilter || (taskFilter === 'termine' && task.effectue);
              const matchPriority = taskPriorityFilter === 'all' || task.priorite === taskPriorityFilter;
              const matchAssignee = taskAssigneeFilter === 'all' || 
                (task.assignedTo && (
                  (typeof task.assignedTo === 'object' && task.assignedTo._id === taskAssigneeFilter) ||
                  (typeof task.assignedTo === 'string' && task.assignedTo === taskAssigneeFilter)
                ));
              return matchStatut && matchPriority && matchAssignee;
            });

            if (filteredTasks.length === 0) {
              return (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-muted-foreground mb-2 font-medium">Aucune tâche ne correspond aux filtres</p>
                  <button
                    onClick={() => {
                      setTaskFilter('all');
                      setTaskPriorityFilter('all');
                      setTaskAssigneeFilter('all');
                    }}
                    className="text-sm text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              );
            }

            // Afficher sur 2 lignes (max 6 tâches) si plus de 6 tâches
            const maxVisibleTasks = 6;
            const tasksToShow = showAllTasks ? filteredTasks : filteredTasks.slice(0, maxVisibleTasks);
            const hasMoreTasks = filteredTasks.length > maxVisibleTasks;

            return (
              <div className="space-y-4">
                {/* Conteneur avec scroll horizontal si plus de 6 tâches */}
                <div className={`${hasMoreTasks && !showAllTasks ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                  {tasksToShow.map((task: any) => {
                  const isUrgent = task.dateEcheance && new Date(task.dateEcheance) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
                  const isOverdue = task.dateEcheance && new Date(task.dateEcheance) < new Date();
                  
                  return (
                    <div 
                      key={task._id} 
                      className={`rounded-xl border-2 p-5 hover:shadow-xl transition-all duration-200 ${
                        // 1. Tâche terminée : vert
                        (task.effectue || task.statut === 'termine')
                          ? 'border-green-500 bg-green-50'
                        // 2. Tâche dépassée (échéance passée et pas effectuée) : rouge
                        : isOverdue
                          ? 'border-red-500 bg-red-50'
                        // 3. Tâche urgente (non terminée, non dépassée) : affichage dynamique, contrasté
                        : task.priorite === 'urgente'
                          ? 'border-red-500 bg-gradient-to-br from-red-50 via-yellow-50 to-red-100 animate-pulse'
                        // 4. Tâche en cours : jaune
                        : task.statut === 'en_cours'
                          ? 'border-yellow-400 bg-yellow-50'
                        // 5. Tâche en attente ou à faire : affichage normal
                        : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* En-tête de la carte */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground mb-2 line-clamp-2 leading-tight">
                            {task.titre}
                          </h3>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {/* Badge de statut interactif */}
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getStatutColor(task.statut)} cursor-pointer bg-white`}
                            >
                              <span className="mr-1 text-[11px] text-gray-600">Statut :</span>
                              <select
                                value={task.statut}
                                onChange={(e) => handleInlineStatusChange(task, e.target.value)}
                                disabled={updatingTaskId === task._id}
                                className="bg-transparent border-none text-xs font-semibold focus:outline-none focus:ring-0 cursor-pointer pr-4"
                              >
                                <option value="a_faire">À faire</option>
                                <option value="en_cours">En cours</option>
                                <option value="en_attente">En attente</option>
                                <option value="termine">Terminée</option>
                              </select>
                            </div>
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getPrioriteColor(task.priorite)} bg-white`}
                            >
                              <span className="mr-1 text-[11px] text-gray-600">Priorité :</span>
                              <select
                                value={task.priorite}
                                onChange={(e) => handleInlinePriorityChange(task, e.target.value)}
                                disabled={updatingTaskId === task._id}
                                className="bg-transparent border-none text-xs font-semibold focus:outline-none focus:ring-0 cursor-pointer pr-4"
                              >
                                <option value="basse">Basse</option>
                                <option value="normale">Normale</option>
                                <option value="haute">Haute</option>
                                <option value="urgente">Urgente</option>
                              </select>
                            </div>
                            {isOverdue && !task.effectue && (
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                ⚠️ En retard
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-3 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      {/* Informations */}
                      <div className="space-y-2 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">👤</span>
                          <span className="font-semibold text-foreground">
                            {task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Non assigné'}
                          </span>
                        </div>
                        {task.dateEcheance && (
                          <div className={`flex items-center gap-2 text-xs ${isOverdue && !task.effectue ? 'text-red-600 font-bold' : isUrgent && !task.effectue ? 'text-orange-600 font-semibold' : ''}`}>
                            <span>⏰</span>
                            <span>
                              Échéance: {new Date(task.dateEcheance).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                            {isOverdue && !task.effectue && <span className="text-red-600">⚠️</span>}
                          </div>
                        )}
                        {task.dossier && (
                          <div className="flex items-center gap-2 text-xs">
                            <span>📁</span>
                            <span className="font-semibold text-foreground truncate">{task.dossier.titre}</span>
                          </div>
                        )}
                        {task.effectue && (
                          <div className="flex items-center gap-2 text-xs bg-green-50 rounded-md p-2">
                            <span className="text-green-600 font-semibold">✅ Tâche effectuée</span>
                            {task.commentaireEffectue && (
                              <span className="text-muted-foreground italic text-xs">- {task.commentaireEffectue}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                        <Button
                          onClick={() => handleOpenTaskDetail(task)}
                          variant="outline"
                          className="text-sm flex-1"
                        >
                          👁️ Voir détails
                        </Button>
                      </div>
                    </div>
                  );
                })}
                </div>
                
                {/* Bouton pour afficher toutes les tâches ou scroll horizontal */}
                {hasMoreTasks && (
                  <div className="flex flex-col items-center gap-4 pt-4">
                    {!showAllTasks ? (
                      <>
                        {/* Barre de défilement horizontal avec flèches */}
                        <div className="w-full max-w-4xl">
                          <div className="relative flex items-center gap-2">
                            {/* Flèche gauche */}
                            <button
                              onClick={(e) => {
                                const container = e.currentTarget.nextElementSibling?.querySelector('.tasks-scroll-container') as HTMLElement;
                                if (container) {
                                  container.scrollBy({ left: -300, behavior: 'smooth' });
                                }
                              }}
                              className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary transition-colors shadow-sm"
                              aria-label="Défiler vers la gauche"
                            >
                              <span className="text-xl">←</span>
                            </button>
                            
                            {/* Conteneur avec scroll horizontal */}
                            <div className="flex-1 relative">
                              <div className="overflow-x-auto scrollbar-hide tasks-scroll-container" style={{ scrollbarWidth: 'thin' }}>
                                <div className="flex gap-4 pb-2" style={{ width: 'max-content' }}>
                                  {filteredTasks.slice(maxVisibleTasks).map((task: any, index: number) => {
                                    const isUrgent = task.dateEcheance && new Date(task.dateEcheance) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
                                    const isOverdue = task.dateEcheance && new Date(task.dateEcheance) < new Date();
                                    
                                    return (
                                      <div key={task._id} className="flex-shrink-0 w-64">
                                        <div className={`bg-white rounded-lg p-3 border-2 ${
                                          isOverdue && !task.effectue
                                            ? 'border-red-300 bg-red-50/50'
                                            : isUrgent && !task.effectue
                                            ? 'border-orange-300 bg-orange-50/50'
                                            : task.effectue
                                            ? 'border-green-300 bg-green-50/30'
                                            : 'border-gray-200'
                                        }`}>
                                          <p className="text-xs font-semibold text-foreground truncate mb-1">{task.titre}</p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {task.assignedTo?.firstName ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Non assigné'}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Gradient à droite */}
                              <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white to-transparent pointer-events-none"></div>
                            </div>
                            
                            {/* Flèche droite */}
                            <button
                              onClick={(e) => {
                                const container = e.currentTarget.previousElementSibling?.querySelector('.tasks-scroll-container') as HTMLElement;
                                if (container) {
                                  container.scrollBy({ left: 300, behavior: 'smooth' });
                                }
                              }}
                              className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary transition-colors shadow-sm"
                              aria-label="Défiler vers la droite"
                            >
                              <span className="text-xl">→</span>
                            </button>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => setShowAllTasks(true)}
                          variant="outline"
                          className="flex items-center gap-2 whitespace-nowrap"
                        >
                          <span>Voir toutes les tâches ({filteredTasks.length})</span>
                          <span className="text-lg">↓</span>
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => {
                          setShowAllTasks(false);
                          // Scroll vers le haut de la section des tâches
                          const tasksSection = document.getElementById('tasks-section');
                          tasksSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <span>↑</span>
                        <span>Voir moins (afficher 6 tâches)</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Activités récentes et graphiques */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-white to-primary/5 rounded-2xl shadow-lg p-8 border border-primary/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                  <span className="text-xl">📊</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">Activités récentes</h2>
              </div>
              <Link href="/admin/utilisateurs" className="text-sm text-primary hover:underline font-semibold">
                Voir tout →
              </Link>
            </div>
            <div className="space-y-3">
              {stats.utilisateurs === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl">📊</span>
                  </div>
                  <p className="text-muted-foreground text-sm">Aucune activité récente</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50/50 border border-green-200 hover:bg-green-50 transition-colors">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-sm">
                      <span className="text-white text-lg">✓</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Nouveau client inscrit</p>
                      <p className="text-xs text-muted-foreground mt-1">Il y a 1 heure</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200 hover:bg-blue-50 transition-colors">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                      <span className="text-white text-lg">📁</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Nouveau dossier créé</p>
                      <p className="text-xs text-muted-foreground mt-1">Il y a 3 heures</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-lg p-8 border border-blue-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-xl">📈</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">Statistiques du mois</h2>
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">Nouveaux clients</span>
                  <span className="text-lg font-bold text-primary">{stats.nouveauxClients}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary to-primary/70 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.nouveauxClients / 50) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">Dossiers traités</span>
                  <span className="text-lg font-bold text-blue-600">{stats.dossiersEnCours}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.dossiersEnCours / 100) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-foreground">Taux de complétion</span>
                  <span className="text-lg font-bold text-green-600">85%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Documents récents */}
        {recentDocuments.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-white to-primary/5 rounded-2xl shadow-lg p-8 border border-primary/10">
            {/* En-tête amélioré */}
              <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-xl">📄</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Documents récents</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {recentDocuments.length} document{recentDocuments.length > 1 ? 's' : ''} récemment ajouté{recentDocuments.length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsDocumentsSectionCollapsed(!isDocumentsSectionCollapsed)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white rounded-lg transition-colors shadow-sm hover:shadow-md"
                  aria-label={isDocumentsSectionCollapsed ? "Déplier la section" : "Replier la section"}
                >
                  <span className={`text-lg transition-transform duration-200 ${isDocumentsSectionCollapsed ? 'rotate-0' : 'rotate-90'}`}>
                    ▶
                  </span>
                </button>
                <Link 
                  href="/admin/documents" 
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg font-medium text-sm"
                >
                  Voir tous les documents
                  <span className="text-lg">→</span>
                </Link>
              </div>
              </div>

            {/* Liste de documents */}
            {!isDocumentsSectionCollapsed && (
            <div className="space-y-3">
              {recentDocuments.map((doc, index) => {
                const userName = doc.user 
                  ? `${doc.user.firstName || ''} ${doc.user.lastName || ''}`.trim() || 'Utilisateur inconnu'
                  : 'Utilisateur inconnu';
                const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

                  return (
                  <div
                    key={doc._id || doc.id || index}
                    className="group bg-white rounded-xl border-2 border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 p-5"
                            >
                    <div className="flex items-center gap-4">
                      {/* Icône du fichier */}
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <span className="text-2xl">{getFileIcon(doc.typeMime)}</span>
                          </div>

                      {/* Informations du document */}
                        <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-foreground mb-2 group-hover:text-primary transition-colors">
                          {doc.nom}
                        </h3>
                        <div className="flex items-center gap-4 flex-wrap">
                          {/* Utilisateur */}
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">
                                {userInitials}
                              </span>
                        </div>
                            <span className="text-sm font-medium text-muted-foreground">
                              {userName}
                            </span>
                      </div>

                          {/* Taille */}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>📊</span>
                            <span className="font-medium">{formatFileSize(doc.taille)}</span>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>📅</span>
                            <span className="font-medium">
                              {new Date(doc.createdAt).toLocaleDateString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bouton de téléchargement */}
                      <div className="flex-shrink-0">
                      <Button
                          variant="default"
                        size="sm"
                          className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 px-4"
                          onClick={() => handleDownloadDocument(doc._id || doc.id, doc.nom)}
                      >
                          <span className="flex items-center gap-2">
                            <span className="text-base">📥</span>
                            <span>Télécharger</span>
                          </span>
                      </Button>
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal de création de tâche */}
        {showTaskModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Créer une nouvelle tâche</h3>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Titre *</label>
                  <input
                    type="text"
                    value={taskFormData.titre}
                    onChange={(e) => setTaskFormData({ ...taskFormData, titre: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-input rounded-md"
                    placeholder="Ex: Réviser le dossier X"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={taskFormData.description}
                    onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md min-h-[100px]"
                    placeholder="Détails de la tâche..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Assigner à *</label>
                    <select
                      value={taskFormData.assignedTo}
                      onChange={(e) => setTaskFormData({ ...taskFormData, assignedTo: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-input rounded-md"
                    >
                      <option value="">Sélectionner un membre</option>
                      {teamMembers.map((member: any) => (
                        <option key={member._id} value={member._id}>
                          {member.firstName} {member.lastName} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priorité</label>
                    <select
                      value={taskFormData.priorite}
                      onChange={(e) => setTaskFormData({ ...taskFormData, priorite: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-md"
                    >
                      <option value="basse">Basse</option>
                      <option value="normale">Normale</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date d'échéance</label>
                  <input
                    type="date"
                    value={taskFormData.dateEcheance}
                    onChange={(e) => setTaskFormData({ ...taskFormData, dateEcheance: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTaskModal(false);
                      setTaskFormData({
                        titre: '',
                        description: '',
                        assignedTo: '',
                        priorite: 'normale',
                        dateEcheance: '',
                        dossier: '',
                      });
                    }}
                    disabled={isSubmittingTask}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmittingTask}>
                    {isSubmittingTask ? 'Création...' : 'Créer la tâche'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de détail de tâche */}
        {showTaskDetailModal && selectedTaskDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Détails de la tâche</h3>
                <button
                  onClick={() => {
                    setShowTaskDetailModal(false);
                    setSelectedTaskDetail(null);
                    setNewAssigneeId('');
                  }}
                  className="text-2xl text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Titre */}
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">Titre</label>
                  <p className="text-lg font-bold text-foreground">{selectedTaskDetail.titre}</p>
                </div>

                {/* Statut et Priorité */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Statut</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatutColor(selectedTaskDetail.statut)}`}>
                      {getStatutLabel(selectedTaskDetail.statut)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Priorité</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPrioriteColor(selectedTaskDetail.priorite)}`}>
                      {selectedTaskDetail.priorite === 'urgente' ? '🔴 ' : selectedTaskDetail.priorite === 'haute' ? '🟠 ' : ''}
                      {selectedTaskDetail.priorite}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {selectedTaskDetail.description && (
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Description</label>
                    <p className="text-foreground bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
                      {selectedTaskDetail.description}
                    </p>
                  </div>
                )}

                {/* Assignation */}
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">
                    Assigné à
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-foreground font-medium">
                        {selectedTaskDetail.assignedTo?.firstName 
                          ? `${selectedTaskDetail.assignedTo.firstName} ${selectedTaskDetail.assignedTo.lastName} (${selectedTaskDetail.assignedTo.email})`
                          : 'Non assigné'}
                      </p>
                    </div>
                    <div className="flex-1">
                      <select
                        value={newAssigneeId || (selectedTaskDetail.assignedTo?._id || selectedTaskDetail.assignedTo || '')}
                        onChange={(e) => setNewAssigneeId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Sélectionner un membre</option>
                        {teamMembers.map((member: any) => (
                          <option key={member._id} value={member._id}>
                            {member.firstName} {member.lastName} ({member.role})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      onClick={handleUpdateTaskAssignment}
                      disabled={isUpdatingTaskAssignment || !newAssigneeId || newAssigneeId === (selectedTaskDetail.assignedTo?._id || selectedTaskDetail.assignedTo || '')}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      {isUpdatingTaskAssignment ? 'Mise à jour...' : 'Réassigner'}
                    </Button>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedTaskDetail.dateEcheance && (
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Date d'échéance</label>
                      <p className="text-foreground">
                        {new Date(selectedTaskDetail.dateEcheance).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                        {new Date(selectedTaskDetail.dateEcheance) < new Date() && !selectedTaskDetail.effectue && (
                          <span className="ml-2 text-red-600 font-semibold">⚠️ En retard</span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedTaskDetail.dateDebut && (
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Date de début</label>
                      <p className="text-foreground">
                        {new Date(selectedTaskDetail.dateDebut).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {selectedTaskDetail.dateFin && (
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Date de fin</label>
                      <p className="text-foreground">
                        {new Date(selectedTaskDetail.dateFin).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                  {selectedTaskDetail.dateEffectue && (
                    <div>
                      <label className="block text-sm font-semibold text-muted-foreground mb-2">Date d'effectuation</label>
                      <p className="text-foreground">
                        {new Date(selectedTaskDetail.dateEffectue).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dossier lié */}
                {selectedTaskDetail.dossier && (
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Dossier lié</label>
                    <p className="text-foreground font-medium">
                      {selectedTaskDetail.dossier.titre || selectedTaskDetail.dossier}
                      {selectedTaskDetail.dossier.numero && (
                        <span className="text-muted-foreground ml-2">
                          (N° {selectedTaskDetail.dossier.numero})
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {selectedTaskDetail.notes && (
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Notes</label>
                    <p className="text-foreground bg-gray-50 rounded-md p-3 whitespace-pre-wrap">
                      {selectedTaskDetail.notes}
                    </p>
                  </div>
                )}

                {/* Commentaire d'effectuation */}
                {selectedTaskDetail.commentaireEffectue && (
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">Commentaire d'effectuation</label>
                    <p className="text-foreground bg-green-50 rounded-md p-3 whitespace-pre-wrap border border-green-200">
                      {selectedTaskDetail.commentaireEffectue}
                    </p>
                  </div>
                )}

                {/* Historique des notes / commentaires sur la tâche */}
                {Array.isArray(selectedTaskDetail.commentaires) && selectedTaskDetail.commentaires.length > 0 && (
                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-muted-foreground mb-2">
                      Notes / commentaires sur la tâche
                    </label>
                    <div className="space-y-3 max-h-60 overflow-y-auto bg-gray-50 rounded-md p-3 border border-gray-200">
                      {selectedTaskDetail.commentaires
                        .slice()
                        .sort(
                          (a: any, b: any) =>
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        )
                        .map((comment: any, index: number) => (
                          <div
                            key={comment._id || index}
                            className="rounded-md bg-white p-2.5 border border-gray-200 text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-foreground">
                                {comment.utilisateur?.firstName || comment.utilisateur?.lastName
                                  ? `${comment.utilisateur.firstName || ''} ${
                                      comment.utilisateur.lastName || ''
                                    }`.trim()
                                  : comment.utilisateur?.email || 'Utilisateur'}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {comment.createdAt
                                  ? new Date(comment.createdAt).toLocaleString('fr-FR', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {comment.contenu}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Ajouter une note */}
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-muted-foreground mb-2">
                    Ajouter une note / commentaire
                  </label>
                  <textarea
                    value={newTaskNote}
                    onChange={(e) => setNewTaskNote(e.target.value)}
                    placeholder="Renseignez un suivi, une décision, ou un échange interne lié à cette tâche..."
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  {taskNotesError && (
                    <p className="text-xs text-red-600 mt-1">{taskNotesError}</p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAddTaskNote}
                      disabled={isAddingTaskNote || !newTaskNote.trim()}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      {isAddingTaskNote ? 'Enregistrement...' : 'Enregistrer la note'}
                    </Button>
                  </div>
                </div>

                {/* Informations de création */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Créé par</label>
                      <p className="text-foreground">
                        {selectedTaskDetail.createdBy?.firstName 
                          ? `${selectedTaskDetail.createdBy.firstName} ${selectedTaskDetail.createdBy.lastName}`
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">Date de création</label>
                      <p className="text-foreground">
                        {selectedTaskDetail.createdAt 
                          ? new Date(selectedTaskDetail.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTaskDetailModal(false);
                      setSelectedTaskDetail(null);
                      setNewAssigneeId('');
                    }}
                  >
                    Fermer
                  </Button>
                  {/* Bouton pour ouvrir la modale de commentaire de statut, sans mention de “Marquer comme effectuée” */}
                  <Button
                    onClick={() => {
                      setSelectedTaskForStatus(selectedTaskDetail);
                      setTaskStatusComment(selectedTaskDetail.commentaireEffectue || '');
                      setShowTaskDetailModal(false);
                      setShowTaskStatusModal(true);
                    }}
                    className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                  >
                    Commenter le statut
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de notification des tâches */}
        {showTasksNotificationModal && weekTasks.filter((task: any) => {
          const currentUserId = (session?.user as any)?.id;
          if (task.assignedTo) {
            if (typeof task.assignedTo === 'object' && task.assignedTo._id === currentUserId) return true;
            if (typeof task.assignedTo === 'string' && task.assignedTo === currentUserId) return true;
          }
          return false;
        }).length > 0 && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTasksNotificationModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* En-tête */}
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Tâches à effectuer</h2>
                      <p className="text-purple-100 text-sm">Vous avez {weekTasks.filter((task: any) => {
                        const currentUserId = (session?.user as any)?.id;
                        if (task.assignedTo) {
                          if (typeof task.assignedTo === 'object' && task.assignedTo._id === currentUserId) return true;
                          if (typeof task.assignedTo === 'string' && task.assignedTo === currentUserId) return true;
                        }
                        return false;
                      }).length} tâche(s) à réaliser</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTasksNotificationModal(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  >
                    <span className="text-xl">×</span>
                  </button>
                </div>
              </div>

              {/* Liste des tâches */}
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-3">
                  {weekTasks.filter((task: any) => {
                    const currentUserId = (session?.user as any)?.id;
                    if (task.assignedTo) {
                      if (typeof task.assignedTo === 'object' && task.assignedTo._id === currentUserId) return true;
                      if (typeof task.assignedTo === 'string' && task.assignedTo === currentUserId) return true;
                    }
                    return false;
                  }).map((task: any) => {
                    const assignedUser = teamMembers.find((m: any) => 
                      (task.assignedTo && typeof task.assignedTo === 'object' && m._id === task.assignedTo._id) ||
                      (task.assignedTo && typeof task.assignedTo === 'string' && m._id === task.assignedTo)
                    );
                    const isUrgent = task.dateEcheance && new Date(task.dateEcheance) <= new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
                    
                    return (
                      <div key={task._id || task.id} className={`p-4 rounded-lg border-2 ${
                        isUrgent 
                          ? 'bg-red-50 border-red-300' 
                          : task.priorite === 'haute' 
                          ? 'bg-orange-50 border-orange-300' 
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-bold text-lg text-foreground flex-1">{task.titre}</h3>
                          <div className="flex gap-2 ml-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatutColor(task.statut)}`}>
                              {getStatutLabel(task.statut)}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPrioriteColor(task.priorite)}`}>
                              {task.priorite}
                            </span>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {assignedUser ? (
                            <span className="flex items-center gap-1">
                              <span>👤</span>
                              <span>{assignedUser.firstName} {assignedUser.lastName}</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600 font-semibold">
                              <span>⚠️</span>
                              <span>Non assignée</span>
                            </span>
                          )}
                          {task.dateEcheance && (
                            <span className={`flex items-center gap-1 ${isUrgent ? 'text-red-600 font-bold' : ''}`}>
                              <span>📅</span>
                              <span>Échéance: {new Date(task.dateEcheance).toLocaleDateString('fr-FR')}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pied de page */}
              <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <Link href="/admin?section=tasks" onClick={() => setShowTasksNotificationModal(false)}>
                  <Button variant="outline" className="border-purple-300 text-purple-600 hover:bg-purple-50">
                    Voir toutes les tâches →
                  </Button>
                </Link>
                <Button onClick={() => setShowTasksNotificationModal(false)} className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                  J'ai compris
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de notification de message */}
        <MessageNotificationModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setUnreadMessage(null);
          }}
          message={unreadMessage}
        />

        {/* Modal de commentaire sur le statut de la tâche */}
        {showTaskStatusModal && selectedTaskForStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                <h2 className="text-2xl font-bold">
                  Commentaire sur la tâche
                </h2>
                <button
                  onClick={() => {
                    setShowTaskStatusModal(false);
                    setSelectedTaskForStatus(null);
                    setTaskStatusComment('');
                  }}
                  className="text-muted-foreground hover:text-foreground text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tâche:</p>
                  <p className="font-semibold text-lg">{selectedTaskForStatus.titre}</p>
                  {selectedTaskForStatus.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selectedTaskForStatus.description}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="taskStatusComment" className="block text-sm font-medium mb-2">
                    Commentaire
                  </label>
                  <textarea
                    id="taskStatusComment"
                    value={taskStatusComment}
                    onChange={(e) => setTaskStatusComment(e.target.value)}
                    placeholder="Ajoutez un commentaire sur l'état de la tâche..."
                    rows={4}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTaskStatusModal(false);
                      setSelectedTaskForStatus(null);
                      setTaskStatusComment('');
                    }}
                    disabled={isUpdatingTaskStatus}
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => handleUpdateTaskStatus(selectedTaskForStatus.effectue)}
                    disabled={isUpdatingTaskStatus}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {isUpdatingTaskStatus ? 'Enregistrement...' : 'Enregistrer le commentaire'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
