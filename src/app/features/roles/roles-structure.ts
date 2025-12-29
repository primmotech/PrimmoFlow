// src/app/features/admin/roles-structure.ts

export const PERMISSION_STRUCTURE = [
  {
    key: 'missions',
    label: 'Gestion des Missions',
    icon: 'assignment',
    perms: [
      { 
        id: 'miss_view', 
        label: 'Consulter ses missions (Tech)', 
        target: 'src/app/features/dashboard/dashboard.ts' 
      },
      { 
        id: 'miss_view_all', 
        label: 'Voir TOUTES les missions (Admin/Modo)', 
        target: 'src/app/features/dashboard/dashboard.ts' 
      },
      { 
        id: 'miss_edit', 
        label: 'Créer / Modifier une mission', 
        target: 'src/app/features/interventions/add-intervention.ts' 
      },
      { 
        id: 'miss_assign', 
        label: 'Assigner des techniciens / Planning', 
        target: 'src/app/features/planning/planning.ts' 
      }
    ]
  },
  {
    key: 'intervention',
    label: 'Sur le terrain (Détails)',
    icon: 'build',
    perms: [
      { 
        id: 'int_work', 
        label: 'Utiliser le Timer et GPS', 
        target: 'src/app/features/interventions/details-intervention.html' 
      },
      { 
        id: 'int_logistics', 
        label: 'Gérer Matériel, Photos et Commandes', 
        target: 'src/app/features/interventions/details-intervention.ts' 
      },
      { 
        id: 'int_edit_history', 
        label: 'Supprimer historique (Saisies)', 
        target: 'src/app/features/interventions/details-intervention.html' 
      },
      { 
        id: 'int_finish', 
        label: 'Clôturer l\'intervention (Passer en END)', 
        target: 'src/app/features/interventions/details-intervention.ts' 
      }
    ]
  },
  {
    key: 'finance',
    label: 'Finance & Facturation',
    icon: 'payments',
    perms: [
      { 
        id: 'fin_view_prices', 
        label: 'Voir les prix et totaux', 
        target: 'src/app/features/dashboard/dashboard.html' 
      },
      { 
        id: 'fin_mark_paid', 
        label: 'Encaisser / Marquer comme PAYÉ', 
        target: 'src/app/features/dashboard/dashboard.ts' 
      }
    ]
  },
  {
    key: 'admin',
    label: 'Administration Système',
    icon: 'settings',
    perms: [
      { 
        id: 'adm_whitelist', 
        label: 'Gérer les accès (Whitelist)', 
        target: 'src/app/features/admin/whitelist.ts' 
      },
      { 
        id: 'adm_roles', 
        label: 'Gérer les Rôles et Permissions', 
        target: 'src/app/features/admin/roles.ts' 
      }
    ]
  }
];