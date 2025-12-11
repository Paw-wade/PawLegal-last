'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { MessageNotificationModal } from '@/components/MessageNotificationModal';
import { userAPI, appointmentsAPI, documentsAPI, tasksAPI, messagesAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
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
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [hasCheckedMessages, setHasCheckedMessages] = useState(false);
  const hasChecked = useRef(false);

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
        setHasCheckedMessages(true);
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
      const documentsResponse = await documentsAPI.getAllDocuments();
      if (documentsResponse.data.success) {
        const documents = documentsResponse.data.documents || [];
        setStats(prev => ({
          ...prev,
          documents: documents.length,
        }));
        // Garder les 5 documents les plus récents
        setRecentDocuments(documents.slice(0, 5));
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
        setTasks(allTasks.slice(0, 10)); // Garder les 10 dernières
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

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'termine':
        return 'bg-green-100 text-green-800';
      case 'en_cours':
        return 'bg-blue-100 text-blue-800';
      case 'en_attente':
        return 'bg-yellow-100 text-yellow-800';
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
      'termine': 'Terminé',
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
      {/* Header Professionnel Admin */}
      <Header variant="admin" />

      <main className="container mx-auto px-4 py-8">
        {/* En-tête avec navigation rapide */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Tableau de bord Administrateur
              </h1>
              <p className="text-muted-foreground text-lg">Vue d'ensemble de votre cabinet juridique</p>
            </div>
            {/* Navigation rapide vers le dashboard client */}
            <Link href="/client">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border-2 border-blue-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl">👤</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Vue Client</p>
                    <p className="text-xs text-blue-700">Accéder au dashboard utilisateur</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Statistiques principales - Design professionnel et chaleureux avec accès direct */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          {/* Badge Tâches - scroll vers la section */}
          <div 
            onClick={() => {
              const tasksSection = document.getElementById('tasks-section');
              tasksSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500 hover:shadow-lg hover:border-orange-600 transition-all duration-200 hover:-translate-y-1 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center hover:bg-orange-500/20 transition-colors">
                <span className="text-2xl">✅</span>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground mb-0 hover:text-orange-600 transition-colors">{stats.tasks}</p>
              </div>
            </div>
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">Tâches</h3>
            <p className="text-xs text-muted-foreground mb-3">Total des tâches</p>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-orange-500/10 text-orange-600 text-xs font-semibold">
                {stats.tasksEnCours} en cours
              </span>
              <span className="text-orange-600 text-xs font-medium opacity-70">Voir ci-dessous ↓</span>
            </div>
          </div>
        </div>

        {/* Actions rapides - Seulement les sections sans doublons */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

          {/* Navigation rapide vers le dashboard client */}
          <Link href="/client" className="group">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-2 border-blue-200 hover:border-blue-400 hover:scale-105">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <span className="text-3xl">👤</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground group-hover:text-blue-600 transition-colors mb-1">Vue Client</h3>
                  <p className="text-sm text-muted-foreground">Dashboard utilisateur</p>
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

        {/* Section Gestion des Tâches */}
        <div id="tasks-section" className="bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-lg p-8 mb-8 border border-orange-200">
          <div className="flex items-center justify-between mb-6">
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map((task: any) => (
                <div key={task._id} className="bg-white rounded-xl border-2 border-orange-200 p-5 hover:shadow-lg transition-all duration-200 hover:border-orange-400">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-foreground mb-2 line-clamp-1">{task.titre}</h3>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatutColor(task.statut)}`}>
                          {getStatutLabel(task.statut)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPrioriteColor(task.priorite)}`}>
                          {task.priorite}
                        </span>
                      </div>
                    </div>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                  )}
                  <div className="space-y-2 pt-3 border-t border-orange-100">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">👤 Assigné à:</span>
                      <span className="font-semibold text-foreground">{task.assignedTo?.firstName} {task.assignedTo?.lastName}</span>
                    </div>
                    {task.dateEcheance && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">⏰ Échéance:</span>
                        <span className="font-semibold text-foreground">{new Date(task.dateEcheance).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    {task.dossier && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">📁 Dossier:</span>
                        <span className="font-semibold text-foreground truncate">{task.dossier.titre}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
        {recentDocuments.length > 0 && (() => {
          // Grouper les documents par utilisateur
          const documentsByUser: { [userId: string]: any[] } = {};
          recentDocuments.forEach((doc) => {
            const userId = doc.user?._id || doc.user?.id || 'unknown';
            if (!documentsByUser[userId]) {
              documentsByUser[userId] = [];
            }
            documentsByUser[userId].push(doc);
          });

          // Convertir en tableau pour l'affichage
          const groupedDocuments = Object.entries(documentsByUser).map(([userId, docs]) => ({
            userId,
            userName: docs[0]?.user ? `${docs[0].user.firstName} ${docs[0].user.lastName}` : 'Utilisateur inconnu',
            documents: docs,
          }));

          return (
            <div className="mt-8 bg-white rounded-xl shadow-md p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">Documents récents</h2>
                <Link href="/admin/documents" className="text-sm text-primary hover:underline font-medium">
                  Voir tous les documents →
                </Link>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupedDocuments.map((group) => {
                  const currentIndex = documentIndices[group.userId] || 0;
                  const currentDoc = group.documents[currentIndex];
                  const hasMultipleDocs = group.documents.length > 1;

                  return (
                    <div key={group.userId} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow relative">
                      {/* Flèches de navigation si plusieurs documents */}
                      {hasMultipleDocs && (
                        <>
                          {/* Flèche gauche */}
                          {currentIndex > 0 && (
                            <button
                              onClick={() => {
                                setDocumentIndices({
                                  ...documentIndices,
                                  [group.userId]: currentIndex - 1,
                                });
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-border rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors shadow-md z-10"
                              title="Document précédent"
                            >
                              ←
                            </button>
                          )}
                          {/* Flèche droite */}
                          {currentIndex < group.documents.length - 1 && (
                            <button
                              onClick={() => {
                                setDocumentIndices({
                                  ...documentIndices,
                                  [group.userId]: currentIndex + 1,
                                });
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-border rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors shadow-md z-10"
                              title="Document suivant"
                            >
                              →
                            </button>
                          )}
                          {/* Indicateur de position */}
                          <div className="absolute top-2 right-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full font-medium">
                            {currentIndex + 1} / {group.documents.length}
                          </div>
                        </>
                      )}

                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">{getFileIcon(currentDoc.typeMime)}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{currentDoc.nom}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.userName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(currentDoc.taille)} • {new Date(currentDoc.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => handleDownloadDocument(currentDoc._id || currentDoc.id, currentDoc.nom)}
                      >
                        📥 Télécharger
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
      </main>
    </div>
  );
}
