export interface Permission {
  id: string;
  label: string;
}

export interface PageStructure {
  key: string;
  label: string;
  perms: Permission[];
}

export const PERMISSION_STRUCTURE: PageStructure[] = [
  {
    key: 'dash_view',
    label: 'Dashboard : Visibilité',
    perms: [
      { id: 'dash_view_all', label: 'Voir toutes les fiches (Vue Globale)' },
      { id: 'dash_view_contacts', label: 'Voir les coordonnées (Tél/Habitants)' },
      { id: 'dash_view_prices', label: 'Voir les montants financiers (€)' }
    ]
  },
  {
    key: 'dash_actions',
    label: 'Dashboard : Actions',
    perms: [
      { id: 'dash_act_edit', label: 'Modifier une fiche (Bouton Crayon)' },
      { id: 'dash_act_tasks', label: 'Voir les Tâches et Photos' },
      { id: 'dash_act_plan', label: 'Planifier/Modifier date et heure' },
      { id: 'dash_act_delete', label: 'Supprimer une fiche (Clic long)' }
    ]
  },
  {
    key: 'dash_nav',
    label: 'Dashboard : Navigation',
    perms: [
      { id: 'dash_nav_add', label: 'Ajouter une intervention (Bouton +)' },
      { id: 'dash_view_addAdmin', label: 'Voir la partie admin du bouton +' },
      { id: 'dash_nav_details', label: 'Accès Suivi Terrain (Détails)' },
      { id: 'dash_nav_invoice', label: 'Accès Facturation' },
      { id: 'dash_nav_billed', label: 'Marquer comme payé' },
      { id: 'dash_nav_orders', label: 'Accès Menu Commandes' },
      { id: 'dash_nav_archives', label: 'Accès Menu Archives' },
      { id: 'dash_nav_params', label: 'Accès Menu Paramètres et Partages' }
    ]
  },
  {
    key: 'param_view',
    label: 'Paramètres : Visibilité des champs',
    perms: [
      { id: 'param_view_costs', label: 'Voir Déplacement, Taux et Arrondi' }
    ]
  },
  {
    key: 'param_edit',
    label: 'Paramètres : Droit de modification',
    perms: [
      { id: 'param_edit_name', label: 'Modifier Nom / Prénom' },
      { id: 'param_edit_nickname', label: 'Modifier le Surnom' },
      { id: 'param_edit_phone', label: 'Modifier le Téléphone' },
      { id: 'param_edit_gps', label: 'Modifier le GPS par défaut' },
      { id: 'param_edit_costs', label: 'Modifier Déplacement / Taux / Arrondi' },
      { id: 'param_edit_theme', label: 'Modifier l\'Apparence (Mode Sombre)' }
    ]
  },
  {
    key: 'param_panel',
    label: 'Paramètres : Administration Système',
    perms: [
      { id: 'param_panel_equipes', label: 'Gérer les Équipes' },
      { id: 'param_panel_roles', label: 'Gérer les Rôles et Droits' },
      { id: 'param_panel_whitelist', label: 'Gérer la Whitelist (Accès Email)' }
    ]
  }
];