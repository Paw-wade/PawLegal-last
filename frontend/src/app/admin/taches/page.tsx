'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { tasksAPI, userAPI } from '@/lib/api';

function Button({ children, variant = 'default', className = '', ...props }: any) {
  const baseClasses = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors';
  const variantClasses = {
    default: 'bg-orange-500 text-white hover:bg-orange-600 shadow-md font-semibold',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function AdminTachesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    const role = (session?.user as any)?.role;
    if (role !== 'admin' && role !== 'superadmin') {
      router.push('/client');
      return;
    }
    loadTasks();
    loadTeamMembers();
  }, [session, status, router]);

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

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement des tâches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Gestion des Tâches</h1>
            <p className="text-muted-foreground">
              Vue dédiée pour créer, assigner et suivre les tâches de l&apos;équipe.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" className="text-xs">
              ← Retour au tableau de bord
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Aucune tâche</h2>
            <p className="text-muted-foreground">
              Aucune tâche n&apos;a encore été créée. Vous pourrez ici gérer toutes les tâches de l&apos;équipe.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tasks.map((task: any) => (
              <div
                key={task._id || task.id}
                className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
              >
                <h3 className="font-bold text-lg text-foreground mb-2">{task.titre}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {task.description}
                  </p>
                )}
                <div className="text-xs text-muted-foreground space-y-1 mb-3">
                  {task.assignedTo && (
                    <p>
                      👤 Assignée à&nbsp;
                      {typeof task.assignedTo === 'object'
                        ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                        : 'Un membre de l\'équipe'}
                    </p>
                  )}
                  {task.dateEcheance && (
                    <p>
                      📅 Échéance&nbsp;
                      {new Date(task.dateEcheance).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


