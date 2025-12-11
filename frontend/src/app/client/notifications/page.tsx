'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { notificationsAPI } from '@/lib/api';

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

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      // Ensure token is stored in localStorage
      if (session && (session.user as any)?.accessToken && typeof window !== 'undefined') {
        const token = (session.user as any).accessToken;
        if (!localStorage.getItem('token')) {
          localStorage.setItem('token', token);
          console.log('🔑 Token stored in localStorage from session');
        }
      }
      loadNotifications();
    }
  }, [session, status, router, filter]);

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await notificationsAPI.getNotifications({
        lu: filter === 'unread' ? false : undefined,
        limit: 100
      });
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      } else {
        setError('Erreur lors du chargement des notifications');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des notifications:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await notificationsAPI.markAsRead(id);
      if (response.data.success) {
        await loadNotifications();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de la notification:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await notificationsAPI.markAllAsRead();
      if (response.data.success) {
        await loadNotifications();
      }
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour des notifications:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await notificationsAPI.deleteNotification(id);
      if (response.data.success) {
        await loadNotifications();
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression de la notification:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      dossier_created: '📁',
      dossier_updated: '✏️',
      dossier_deleted: '🗑️',
      dossier_status_changed: '🔄',
      dossier_assigned: '👤',
      document_uploaded: '📄',
      appointment_created: '📅',
      appointment_updated: '📅',
      appointment_cancelled: '❌',
      message_received: '💬',
      other: '🔔',
    };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type: string) => {
    const colors: { [key: string]: string } = {
      dossier_created: 'bg-blue-50 border-blue-200',
      dossier_updated: 'bg-yellow-50 border-yellow-200',
      dossier_deleted: 'bg-red-50 border-red-200',
      dossier_status_changed: 'bg-green-50 border-green-200',
      dossier_assigned: 'bg-purple-50 border-purple-200',
      document_uploaded: 'bg-indigo-50 border-indigo-200',
      appointment_created: 'bg-teal-50 border-teal-200',
      appointment_updated: 'bg-teal-50 border-teal-200',
      appointment_cancelled: 'bg-red-50 border-red-200',
      message_received: 'bg-pink-50 border-pink-200',
      other: 'bg-gray-50 border-gray-200',
    };
    return colors[type] || 'bg-gray-50 border-gray-200';
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

  if (!session) return null;

  const unreadCount = notifications.filter(n => !n.lu).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-primary">Paw Legal</Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/client" className="hover:text-primary">Dashboard</Link>
              <Link href="/client/dossiers" className="hover:text-primary">Mes dossiers</Link>
              <Link href="/client/documents" className="hover:text-primary">Documents</Link>
              <Link href="/client/rendez-vous" className="hover:text-primary">Rendez-vous</Link>
              <Link href="/client/notifications" className="text-primary font-medium">Notifications {unreadCount > 0 && `(${unreadCount})`}</Link>
              <Link href="/client/compte" className="hover:text-primary">Mon compte</Link>
            </nav>
            <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mes Notifications</h1>
            <p className="text-muted-foreground">Restez informé de toutes les actions sur vos dossiers</p>
          </div>
          <div className="flex gap-3">
            <div className="flex gap-2 border rounded-md p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filter === 'all' ? 'bg-primary text-white' : 'hover:bg-accent'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  filter === 'unread' ? 'bg-primary text-white' : 'hover:bg-accent'
                }`}
              >
                Non lues ({unreadCount})
              </button>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={handleMarkAllAsRead}>
                Tout marquer comme lu
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Chargement des notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-muted-foreground text-lg mb-2">
              {filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
            <p className="text-sm text-muted-foreground">
              Vous serez notifié lorsque des actions seront effectuées sur vos dossiers
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification._id || notification.id}
                className={`bg-white rounded-lg shadow-lg p-6 border-2 transition-all ${
                  notification.lu ? 'opacity-75' : getNotificationColor(notification.type)
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className={`font-semibold text-lg ${notification.lu ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.titre}
                        </h3>
                        {!notification.lu && (
                          <span className="inline-block w-2 h-2 bg-primary rounded-full ml-2"></span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className={`text-sm mb-3 ${notification.lu ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {notification.message}
                    </p>
                    <div className="flex gap-2">
                      {notification.lien && (
                        <Link href={notification.lien}>
                          <Button variant="outline" size="sm">
                            Voir
                          </Button>
                        </Link>
                      )}
                      {!notification.lu && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification._id || notification.id)}
                        >
                          Marquer comme lu
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(notification._id || notification.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


