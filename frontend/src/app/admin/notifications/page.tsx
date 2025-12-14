'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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

export default function AdminNotificationsPage() {
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
      const userRole = (session?.user as any)?.role;
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        router.push('/client');
        return;
      }
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
      dossier_cancelled: '❌',
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
      dossier_created: 'bg-blue-50 border-l-4 border-blue-500',
      dossier_updated: 'bg-yellow-50 border-l-4 border-yellow-500',
      dossier_deleted: 'bg-red-50 border-l-4 border-red-500',
      dossier_status_changed: 'bg-green-50 border-l-4 border-green-500',
      dossier_assigned: 'bg-purple-50 border-l-4 border-purple-500',
      dossier_cancelled: 'bg-orange-50 border-l-4 border-orange-500',
      document_uploaded: 'bg-indigo-50 border-l-4 border-indigo-500',
      appointment_created: 'bg-teal-50 border-l-4 border-teal-500',
      appointment_updated: 'bg-teal-50 border-l-4 border-teal-500',
      appointment_cancelled: 'bg-red-50 border-l-4 border-red-500',
      message_received: 'bg-pink-50 border-l-4 border-pink-500',
      other: 'bg-gray-50 border-l-4 border-gray-500',
    };
    return colors[type] || 'bg-gray-50 border-l-4 border-gray-500';
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

  const unreadCount = notifications.filter(n => !n.lu).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Notifications</h1>
            <p className="text-muted-foreground">Restez informé de toutes les actions sur les dossiers et les utilisateurs</p>
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
              Vous serez notifié lorsque des actions seront effectuées sur les dossiers ou les utilisateurs
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {notifications.map((notification) => (
              <div
                key={notification._id || notification.id}
                className={`bg-white rounded-xl shadow-md p-5 border transition-all hover:shadow-lg ${
                  notification.lu 
                    ? 'opacity-60 border-gray-200' 
                    : `${getNotificationColor(notification.type)} shadow-lg`
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    notification.lu ? 'bg-gray-100' : 'bg-primary/10'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-base ${notification.lu ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {notification.titre}
                          </h3>
                          {!notification.lu && (
                            <span className="inline-block w-2 h-2 bg-primary rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className={`text-sm mb-2 ${notification.lu ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {notification.message}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {notification.lien && (
                        <Link href={notification.lien}>
                          <Button variant="outline" size="sm" className="text-xs">
                            Voir les détails
                          </Button>
                        </Link>
                      )}
                      {!notification.lu && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification._id || notification.id)}
                          className="text-xs"
                        >
                          Marquer comme lu
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(notification._id || notification.id)}
                        className="text-red-600 hover:text-red-700 text-xs"
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

