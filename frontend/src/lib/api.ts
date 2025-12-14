import axios from 'axios';

// URL de base de l'API backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';

// Créer une instance axios avec la configuration par défaut
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 secondes
});

// Fonction utilitaire pour récupérer le token
const getToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  // 1. Essayer localStorage
  let token = localStorage.getItem('token');
  if (token) {
    console.log('🔑 Token trouvé dans localStorage');
    return token;
  }

  // 2. Essayer sessionStorage
  token = sessionStorage.getItem('token');
  if (token) {
    console.log('🔑 Token trouvé dans sessionStorage');
    localStorage.setItem('token', token); // Migrer vers localStorage
    return token;
  }

  // 3. Essayer de récupérer depuis NextAuth
  try {
    const { getSession } = await import('next-auth/react');
    const session = await getSession();
    if (session && (session.user as any)?.accessToken) {
      token = (session.user as any).accessToken;
      if (token) {
        localStorage.setItem('token', token);
        console.log('🔑 Token récupéré de NextAuth et stocké dans localStorage');
        return token;
      }
    }
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer la session NextAuth:', error);
  }

  // 4. Essayer de faire un appel direct à l'API pour obtenir le token
  // (si l'utilisateur est connecté via NextAuth mais le token n'est pas dans la session)
  try {
    const sessionResponse = await fetch('/api/auth/session');
    const sessionData = await sessionResponse.json();
    if (sessionData?.user && sessionData?.accessToken) {
      token = sessionData.accessToken;
      if (token) {
        localStorage.setItem('token', token);
        console.log('🔑 Token récupéré depuis /api/auth/session');
        return token;
      }
    }
  } catch (error) {
    console.warn('⚠️ Impossible de récupérer le token depuis /api/auth/session:', error);
  }

  console.warn('⚠️ Aucun token trouvé');
  return null;
};

// Intercepteur pour ajouter le token d'authentification et le header d'impersonation
api.interceptors.request.use(
  async (config) => {
    if (typeof window !== 'undefined') {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('🔑 Token ajouté à la requête:', config.url);
      } else {
        console.warn('⚠️ Aucun token trouvé pour la requête:', config.url);
      }
      
      // Ajouter le header d'impersonation si on est en mode impersonation
      const impersonateUserId = localStorage.getItem('impersonateUserId');
      const impersonateAdminId = localStorage.getItem('impersonateAdminId');
      
      if (impersonateUserId && impersonateAdminId) {
        config.headers['X-Impersonate-User-Id'] = impersonateUserId;
        config.headers['X-Impersonate-Admin-Id'] = impersonateAdminId;
        console.log('👤 Mode impersonation actif pour la requête:', config.url, 'User:', impersonateUserId);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de réponse
api.interceptors.response.use(
  (response) => {
    // Log des réponses réussies pour le débogage
    if (response.config?.url?.includes('/dossiers') || response.config?.url?.includes('/appointments')) {
      console.log('✅ Réponse API reçue pour:', response.config.url);
      console.log('✅ Status:', response.status);
      console.log('✅ Data:', response.data);
    }
    return response;
  },
  (error) => {
    // Log détaillé des erreurs pour appointments
    if (error.config?.url?.includes('/appointments')) {
      console.error('❌ Erreur API appointments:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.status === 404) {
        console.error('❌ Route non trouvée:', error.config?.url);
      }
    }
    
    // Gérer les erreurs de connexion (backend non disponible)
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ERR_CONNECTION_REFUSED') || !error.response) {
      console.warn('⚠️ Le serveur backend n\'est pas disponible. Vérifiez que le serveur est démarré sur le port 3005.');
      // Ne pas rejeter l'erreur de manière agressive, retourner une erreur contrôlée
      return Promise.reject({
        ...error,
        isConnectionError: true,
        message: 'Le serveur backend n\'est pas disponible. Veuillez vérifier que le serveur est démarré.'
      });
    }
    
    // Log des erreurs pour le débogage
    console.error('❌ Erreur API:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    // Gérer les erreurs 401 (non autorisé)
    // Ne pas déconnecter automatiquement - laisser l'utilisateur choisir
    if (error.response?.status === 401) {
      console.warn('⚠️ Token invalide ou expiré pour:', error.config?.url);
      // Ne pas supprimer le token ni rediriger automatiquement
      // L'utilisateur peut choisir de se déconnecter manuellement
    }
    
    // Gérer les erreurs 404 (route non trouvée)
    if (error.response?.status === 404) {
      console.error('❌ Route non trouvée:', error.config?.url);
    }
    
    return Promise.reject(error);
  }
);

export default api;

// Fonctions utilitaires pour les appels API
export const authAPI = {
  register: (data: { firstName: string; lastName: string; email: string; password: string; phone?: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),
  
  getMe: () =>
    api.get('/auth/me'),
};

export const userAPI = {
  getProfile: () =>
    api.get('/user/profile'),
  
  updateProfile: (data: any) => {
    // Si c'est FormData, ne pas définir Content-Type pour laisser le navigateur le faire
    if (data instanceof FormData) {
      return api.put('/user/profile', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    }
    return api.put('/user/profile', data);
  },
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/user/password', data),
  
  // Admin - Récupérer tous les utilisateurs
  getAllUsers: () =>
    api.get('/user/all'),
  
  // Admin - Récupérer un utilisateur par ID
  getUserById: (id: string) =>
    api.get(`/user/${id}`),
  
  // Admin - Mettre à jour un utilisateur par ID
  updateUser: (id: string, data: any) =>
    api.put(`/user/${id}`, data),
  
  // Admin - Supprimer un utilisateur par ID
  deleteUser: (id: string) =>
    api.delete(`/user/${id}`),
  
  // SuperAdmin - Créer un utilisateur
  createUser: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    role: 'client' | 'admin' | 'superadmin';
  }) => api.post('/user/create', data),
};

export const logsAPI = {
  // SuperAdmin - Récupérer tous les logs
  getAllLogs: (params?: { action?: string; userId?: string; targetUserId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }) => {
    return api.get('/logs', { params });
  },
  
  // SuperAdmin - Récupérer les logs de connexion
  getLoginLogs: (params?: { userId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }) => {
    return api.get('/logs', { params: { ...params, action: 'login' } });
  },
  
  // SuperAdmin - Télécharger le DLOG en PDF pour une date donnée
  downloadDlogPDF: async (date: string): Promise<void> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
    
    // Utiliser la même logique que pour API_BASE_URL
    let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005/api';
    
    // Si baseURL se termine déjà par /api, ne pas l'ajouter à nouveau
    // Sinon, construire l'URL complète
    const url = baseURL.endsWith('/api')
      ? `${baseURL}/logs/dlog/pdf?date=${date}`
      : `${baseURL}/api/logs/dlog/pdf?date=${date}`;
    
    console.log('📥 Tentative de téléchargement DLOG:', { url, date, hasToken: !!token });
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });
      
      console.log('📥 Réponse DLOG:', { 
        status: response.status, 
        statusText: response.statusText, 
        ok: response.ok,
        contentType: response.headers.get('content-type')
      });
    
      if (!response.ok) {
        // Essayer de récupérer le message d'erreur du serveur
        let errorMessage = 'Erreur lors du téléchargement du DLOG';
        let errorDetails = '';
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            errorDetails = errorData.details || '';
            console.error('📥 Détails de l\'erreur serveur:', errorData);
          } else {
            // Si la réponse n'est pas du JSON, utiliser le statut
            errorMessage = `Erreur ${response.status}: ${response.statusText}`;
          }
        } catch (e) {
          console.error('📥 Erreur lors de la lecture de la réponse d\'erreur:', e);
          // Si la réponse n'est pas du JSON, utiliser le statut
          errorMessage = `Erreur ${response.status}: ${response.statusText}`;
        }
        
        const fullErrorMessage = errorDetails 
          ? `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`
          : errorMessage;
        throw new Error(fullErrorMessage);
      }
      
      // Vérifier que la réponse est bien un PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        console.warn('⚠️ Content-Type inattendu:', contentType);
        // Ne pas bloquer si le contenu est vide mais le type est correct
        if (!contentType) {
          console.warn('⚠️ Content-Type manquant, tentative de téléchargement quand même');
        }
    }
    
    const blob = await response.blob();
      console.log('📥 Blob reçu:', { size: blob.size, type: blob.type });
      
      // Vérifier que le blob n'est pas vide
      if (blob.size === 0) {
        throw new Error('Le fichier PDF téléchargé est vide. Aucun log trouvé pour cette date.');
      }
      
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `DLOG_${date.replace(/-/g, '_')}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
      
      console.log('✅ DLOG téléchargé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur détaillée lors du téléchargement du DLOG:', error);
      
      // Gérer les erreurs de connexion
      if (error.message?.includes('Failed to fetch') || 
          error.message?.includes('NetworkError') || 
          error.message?.includes('ERR_CONNECTION_REFUSED') ||
          (error.name === 'TypeError' && error.message?.includes('fetch'))) {
        throw new Error('Impossible de contacter le serveur. Vérifiez que le serveur backend est démarré sur le port 3005.');
      }
      
      throw error;
    }
  },
};

export const contactAPI = {
  sendMessage: (data: { name: string; email: string; phone?: string; subject: string; message: string }) =>
    api.post('/contact', data),
  
  // Admin - Récupérer tous les messages
  getAllMessages: (params?: { lu?: boolean; repondu?: boolean; limit?: number; page?: number }) =>
    api.get('/contact', { params }),
  
  // Admin - Récupérer un message spécifique
  getMessage: (id: string) =>
    api.get(`/contact/${id}`),
  
  // Admin - Mettre à jour un message
  updateMessage: (id: string, data: { lu?: boolean; repondu?: boolean; reponse?: string }) =>
    api.patch(`/contact/${id}`, data),
  
  // Admin - Télécharger un document
  downloadDocument: (messageId: string, docId: string) =>
    api.get(`/contact/${messageId}/document/${docId}`, { responseType: 'blob' }),
};

export const permissionsAPI = {
  // Récupérer les permissions d'un utilisateur
  getUserPermissions: (userId: string) =>
    api.get(`/permissions/${userId}`),
  
  // Créer ou mettre à jour les permissions
  savePermissions: (data: { userId: string; roles: string[]; permissions: any[] }) =>
    api.post('/permissions', data),
  
  // Mettre à jour les permissions
  updatePermissions: (userId: string, data: { roles?: string[]; permissions?: any[] }) =>
    api.put(`/permissions/${userId}`, data),
  
  // Récupérer les modèles prédéfinis
  getPresets: () =>
    api.get('/permissions/roles/presets'),
};

export const temoignagesAPI = {
  // Public - Récupérer les témoignages validés
  getTemoignages: () =>
    api.get('/temoignages'),
  
  // Client - Créer un témoignage
  createTemoignage: (data: { texte: string; note: number; nom?: string; role?: string }) =>
    api.post('/temoignages', data),
  
  // Client - Récupérer son témoignage
  getMyTemoignage: () =>
    api.get('/temoignages/my'),
  
  // Admin - Récupérer tous les témoignages
  getAllTemoignages: (valide?: boolean) => {
    const params = valide !== undefined ? { params: { valide } } : {};
    return api.get('/temoignages/admin', params);
  },
  
  // Admin - Valider/rejeter un témoignage
  validateTemoignage: (id: string, valide: boolean) =>
    api.patch(`/temoignages/${id}/validate`, { valide }),
  
  // Admin - Supprimer un témoignage
  deleteTemoignage: (id: string) =>
    api.delete(`/temoignages/${id}`),
};

export const appointmentsAPI = {
  // Public - Créer un rendez-vous
  createAppointment: (data: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    date: string;
    heure: string;
    motif: string;
    description?: string;
  }) => api.post('/appointments', data),
  
  // Client - Récupérer ses rendez-vous
  getMyAppointments: () =>
    api.get('/appointments'),
  
  // Récupérer un rendez-vous par ID
  getAppointmentById: (id: string) =>
    api.get(`/appointments/${id}`),
  
  // Client - Annuler un rendez-vous
  cancelAppointment: (id: string) =>
    api.patch(`/appointments/${id}/cancel`),
  
  // Client - Mettre à jour un rendez-vous
  updateMyAppointment: (id: string, data: {
    date?: string;
    heure?: string;
    motif?: string;
    description?: string;
    effectue?: boolean;
  }) =>
    api.put(`/appointments/${id}`, data),
  
  // Admin - Récupérer tous les rendez-vous
  getAllAppointments: (params?: { statut?: string; date?: string; userId?: string }) => {
    return api.get('/appointments/admin', { params });
  },
  
  // Admin - Mettre à jour un rendez-vous
  updateAppointment: (id: string, data: { 
    statut?: string; 
    date?: string;
    heure?: string;
    motif?: string;
    description?: string;
    notes?: string;
    effectue?: boolean;
  }) =>
    api.patch(`/appointments/${id}`, data),
  
  // Admin - Supprimer un rendez-vous
  deleteAppointment: (id: string) =>
    api.delete(`/appointments/${id}`),
};

export const tasksAPI = {
  // Récupérer toutes les tâches (Admin)
  getAllTasks: (params?: { statut?: string; assignedTo?: string; createdBy?: string; dossier?: string; priorite?: string }) => {
    return api.get('/tasks', { params });
  },
  
  // Récupérer les tâches assignées à l'utilisateur connecté
  getMyTasks: (params?: { statut?: string; priorite?: string }) => {
    return api.get('/tasks/my', { params });
  },
  
  // Récupérer une tâche par ID
  getTaskById: (id: string) => {
    return api.get(`/tasks/${id}`);
  },
  
  // Créer une tâche (Admin)
  createTask: (data: {
    titre: string;
    description?: string;
    statut?: string;
    priorite?: string;
    assignedTo: string;
    dateEcheance?: string;
    dateDebut?: string;
    dossier?: string;
    notes?: string;
  }) => {
    return api.post('/tasks', data);
  },
  
  // Mettre à jour une tâche
  updateTask: (id: string, data: {
    titre?: string;
    description?: string;
    statut?: string;
    priorite?: string;
    assignedTo?: string;
    dateEcheance?: string;
    dateDebut?: string;
    dateFin?: string;
    dossier?: string;
    notes?: string;
    effectue?: boolean;
    commentaireEffectue?: string;
  }) => {
    return api.put(`/tasks/${id}`, data);
  },
  
  // Supprimer une tâche (Admin)
  deleteTask: (id: string) => {
    return api.delete(`/tasks/${id}`);
  },
};

export const dossiersAPI = {
  // Client - Récupérer ses dossiers
  getMyDossiers: () =>
    api.get('/user/dossiers'),
  
  // Admin - Récupérer tous les dossiers
  getAllDossiers: (params?: { statut?: string; type?: string; categorie?: string; userId?: string; search?: string }) => {
    return api.get('/user/dossiers/admin', { params });
  },
  
  // Créer un dossier
  createDossier: (data: {
    userId?: string;
    clientNom?: string;
    clientPrenom?: string;
    clientEmail?: string;
    clientTelephone?: string;
    titre: string;
    description?: string;
    categorie?: string;
    type?: string;
    statut?: string;
    priorite?: string;
    dateEcheance?: string;
    notes?: string;
    assignedTo?: string;
  }) => api.post('/user/dossiers', data),
  
  // Récupérer un dossier par ID
  getDossierById: (id: string) =>
    api.get(`/user/dossiers/${id}`),
  
  // Client - Annuler un dossier
  cancelDossier: (id: string) =>
    api.patch(`/user/dossiers/${id}/cancel`),
  
  // Mettre à jour un dossier
  updateDossier: (id: string, data: any) =>
    api.put(`/user/dossiers/${id}`, data),
  
  // Supprimer un dossier (Admin)
  deleteDossier: (id: string) =>
    api.delete(`/user/dossiers/${id}`),
};

export const notificationsAPI = {
  // Récupérer toutes les notifications
  getNotifications: (params?: { lu?: boolean; limit?: number }) =>
    api.get('/notifications', { params }),
  
  // Récupérer le nombre de notifications non lues
  getUnreadCount: () =>
    api.get('/notifications/unread'),
  
  // Marquer une notification comme lue
  markAsRead: (id: string) =>
    api.put(`/notifications/${id}/read`),
  
  // Marquer toutes les notifications comme lues
  markAllAsRead: () =>
    api.put('/notifications/read-all'),
  
  // Supprimer une notification
  deleteNotification: (id: string) =>
    api.delete(`/notifications/${id}`),
};

export const messagesAPI = {
  // Récupérer les messages
  getMessages: (params?: { type?: 'all' | 'received' | 'sent' | 'unread' }) =>
    api.get('/messages', { params }),
  
  // Récupérer le nombre de messages non lus
  getUnreadCount: () =>
    api.get('/messages/unread-count'),
  
  // Récupérer un message spécifique
  getMessage: (id: string) =>
    api.get(`/messages/${id}`),
  
  // Récupérer la liste des utilisateurs (admin seulement)
  getUsers: () =>
    api.get('/messages/users'),
  
  // Envoyer un message
  sendMessage: (data: FormData) =>
    api.post('/messages', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  // Marquer un message comme lu
  markAsRead: (id: string) =>
    api.put(`/messages/${id}/read`),
  
  // Archiver un message
  archiveMessage: (id: string) =>
    api.put(`/messages/${id}/archive`),
  
  // Télécharger une pièce jointe
  downloadAttachment: (messageId: string, fileIndex: number) =>
    api.get(`/messages/${messageId}/download/${fileIndex}`, {
      responseType: 'blob',
    }),
  
  // Supprimer un message (seul l'expéditeur peut supprimer)
  deleteMessage: (id: string) =>
    api.delete(`/messages/${id}`),
};

export const documentsAPI = {
  // Client - Récupérer ses documents
  getMyDocuments: () =>
    api.get('/user/documents'),
  
  // Admin - Récupérer tous les documents
  getAllDocuments: (params?: { userId?: string }) => {
    return api.get('/user/documents/admin', { params });
  },
  
  // Téléverser un document
  uploadDocument: (formData: FormData) =>
    api.post('/user/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  // Prévisualiser un document (retourne une Promise qui résout avec l'URL du blob)
  previewDocument: async (id: string): Promise<string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
    let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    // Si baseURL contient déjà /api, ne pas l'ajouter à nouveau
    const url = baseURL.endsWith('/api')
      ? `${baseURL}/user/documents/${id}/preview`
      : `${baseURL}/api/user/documents/${id}/preview`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token || ''}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de la prévisualisation');
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
  
  // Obtenir l'URL directe de prévisualisation (pour iframe)
  getPreviewUrl: (id: string): string => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
    let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
    // Si baseURL contient déjà /api, ne pas l'ajouter à nouveau
    return baseURL.endsWith('/api')
      ? `${baseURL}/user/documents/${id}/preview`
      : `${baseURL}/api/user/documents/${id}/preview`;
  },
  
  // Télécharger un document
  downloadDocument: (id: string) =>
    api.get(`/user/documents/${id}/download`, {
      responseType: 'blob',
    }),
  
  // Supprimer un document
  deleteDocument: (id: string) =>
    api.delete(`/user/documents/${id}`),
};

export const creneauxAPI = {
  // Récupérer les créneaux disponibles pour une date
  getAvailableSlots: (date: string) =>
    api.get('/creneaux/available', { params: { date } }),
  
  // Admin - Récupérer tous les créneaux
  getAllCreneaux: (params?: { date?: string; ferme?: boolean }) =>
    api.get('/creneaux', { params }),
  
  // Admin - Fermer des créneaux
  closeSlots: (data: { date: string; heures: string[]; motifFermeture?: string }) =>
    api.post('/creneaux', data),
  
  // Admin - Rouvrir un créneau
  reopenSlot: (id: string) =>
    api.delete(`/creneaux/${id}`),
};

