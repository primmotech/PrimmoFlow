import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login';
import { DashboardComponent } from './features/dashboard/dashboard';
import { AddInterventionComponent } from './features/interventions/add-intervention';
import { DetailsInterventionComponent } from './features/interventions/details-intervention';
import { Planning } from './features/planning/planning';
import { ProfileComponent } from './features/profile/profile';
import { HistoryComponent } from './features/history/history.component';
import { InvoiceComponent } from './features/invoice/invoice.component';
import { CommandesComponent } from './features/commandes/commandes';
import { Equipes } from './features/equipes/equipes';
import { Parameters } from './features/parameters/parameters';
import { Whitelist } from './features/whitelist/whitelist';
import { CompletedInterventionsComponent } from './features/interventions/completed-interventions';
import { Roles } from './features/roles/roles'; 
import { permissionGuard } from './core/guards/permissions.guard';
import { Partage } from './features/partage/partage';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  
  // --- NAVIGATION DASHBOARD (dash_nav) ---
  { 
    path: 'add-intervention', 
    component: AddInterventionComponent,
    canActivate: [permissionGuard('dash_nav_add')] 
  },
  { 
    path: 'intervention/:id', 
    component: DetailsInterventionComponent,
    canActivate: [permissionGuard('dash_nav_details')] 
  },
  { 
    path: 'invoice/:id', 
    component: InvoiceComponent,
    canActivate: [permissionGuard('dash_nav_invoice')] 
  },
  { 
    path: 'commandes', 
    component: CommandesComponent,
    canActivate: [permissionGuard('dash_nav_orders')] 
  },
  { 
    path: 'completed-missions', 
    component: CompletedInterventionsComponent,
    canActivate: [permissionGuard('dash_nav_archives')] 
  },
  { 
    path: 'parameters', 
    component: Parameters,
    canActivate: [permissionGuard('dash_nav_params')] 
  },
    { 
    path: 'partage', 
    component: Partage,
    canActivate: [permissionGuard('dash_nav_params')] 
  },


  // --- ADMINISTRATION (param_panel) ---
  { 
    path: 'equipes', 
    component: Equipes,
    canActivate: [permissionGuard('param_panel_equipes')] 
  },
  { 
    path: 'roles', 
    component: Roles, 
    canActivate: [permissionGuard('param_panel_roles')] 
  },
  { 
    path: 'whitelist', 
    component: Whitelist, 
    canActivate: [permissionGuard('param_panel_whitelist')] 
  },

  // --- ROUTES TECHNIQUES / PROFIL ---
  { path: 'profile', component: ProfileComponent }, // À garder ou supprimer selon ton usage
  { path: 'planning/:id', component: Planning },
  { path: 'edit-intervention/:id', component: AddInterventionComponent },
  { path: 'history/:id', component: HistoryComponent },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];