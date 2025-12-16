'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useEffect } from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Mettre à jour le titre de la page
    document.title = "Service d'accompagnement juridique - Paw Legal";
  }, []);

  return <DashboardLayout variant="admin">{children}</DashboardLayout>;
}
