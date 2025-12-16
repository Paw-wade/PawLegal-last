// Utilitaires pour les statuts de tâches

export const getStatutColor = (statut: string): string => {
  const colors: { [key: string]: string } = {
    a_faire: 'bg-gray-100 text-gray-800',
    en_cours: 'bg-blue-100 text-blue-800',
    en_attente: 'bg-yellow-100 text-yellow-800',
    termine: 'bg-green-100 text-green-800',
    annule: 'bg-red-100 text-red-800',
  };
  return colors[statut] || 'bg-gray-100 text-gray-800';
};

export const getStatutLabel = (statut: string): string => {
  const labels: { [key: string]: string } = {
    a_faire: 'À faire',
    en_cours: 'En cours',
    en_attente: 'En attente',
    termine: 'Terminé',
    annule: 'Annulé',
  };
  return labels[statut] || statut;
};

export const getPrioriteColor = (priorite: string): string => {
  const colors: { [key: string]: string } = {
    urgente: 'bg-red-100 text-red-800',
    haute: 'bg-orange-100 text-orange-800',
    normale: 'bg-blue-100 text-blue-800',
    basse: 'bg-gray-100 text-gray-800',
  };
  return colors[priorite] || 'bg-gray-100 text-gray-800';
};

export const getPrioriteLabel = (priorite: string): string => {
  const labels: { [key: string]: string } = {
    urgente: 'Urgente',
    haute: 'Haute',
    normale: 'Normale',
    basse: 'Basse',
  };
  return labels[priorite] || priorite;
};

