// Utilitaires pour les statuts de dossiers

export const getStatutColor = (statut: string): string => {
  const colors: { [key: string]: string } = {
    recu: 'bg-gray-100 text-gray-800',
    accepte: 'bg-green-100 text-green-800',
    refuse: 'bg-red-100 text-red-800',
    en_attente_onboarding: 'bg-yellow-100 text-yellow-800',
    en_cours_instruction: 'bg-blue-100 text-blue-800',
    pieces_manquantes: 'bg-orange-100 text-orange-800',
    dossier_complet: 'bg-teal-100 text-teal-800',
    depose: 'bg-indigo-100 text-indigo-800',
    reception_confirmee: 'bg-cyan-100 text-cyan-800',
    complement_demande: 'bg-amber-100 text-amber-800',
    decision_defavorable: 'bg-red-100 text-red-800',
    communication_motifs: 'bg-pink-100 text-pink-800',
    recours_preparation: 'bg-purple-100 text-purple-800',
    refere_mesures_utiles: 'bg-violet-100 text-violet-800',
    refere_suspension_rep: 'bg-fuchsia-100 text-fuchsia-800',
    gain_cause: 'bg-emerald-100 text-emerald-800',
    rejet: 'bg-red-200 text-red-900',
    decision_favorable: 'bg-green-200 text-green-900',
    // Anciens statuts pour compatibilité
    en_attente: 'bg-yellow-100 text-yellow-800',
    en_cours: 'bg-blue-100 text-blue-800',
    en_revision: 'bg-purple-100 text-purple-800',
    termine: 'bg-green-100 text-green-800',
    annule: 'bg-red-100 text-red-800',
  };
  return colors[statut] || 'bg-gray-100 text-gray-800';
};

export const getStatutLabel = (statut: string): string => {
  const labels: { [key: string]: string } = {
    recu: 'Reçu',
    accepte: 'Accepté',
    refuse: 'Refusé',
    en_attente_onboarding: 'En attente d\'onboarding (RDV)',
    en_cours_instruction: 'En cours d\'instruction (constitution dossier)',
    pieces_manquantes: 'Pièces manquantes (relance client)',
    dossier_complet: 'Dossier Complet',
    depose: 'Déposé',
    reception_confirmee: 'Réception confirmée',
    complement_demande: 'Complément demandé (avec date limite)',
    decision_defavorable: 'Décision défavorable',
    communication_motifs: 'Communication des Motifs',
    recours_preparation: 'Recours en préparation',
    refere_mesures_utiles: 'Référé Mesures Utiles',
    refere_suspension_rep: 'Référé suspension et REP',
    gain_cause: 'Gain de cause',
    rejet: 'Rejet',
    decision_favorable: 'Décision favorable',
    // Anciens statuts pour compatibilité
    en_attente: 'En attente',
    en_cours: 'En cours',
    en_revision: 'En révision',
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

