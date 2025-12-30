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

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'dashboard', component: DashboardComponent },
  
  // Routes protégées par permissions
  { 
    path: 'whitelist', 
    component: Whitelist, 
    canActivate: [permissionGuard('adm_whitelist')] 
  },
  { 
    path: 'roles', 
    component: Roles, 
    canActivate: [permissionGuard('adm_roles')] 
  },
  { 
    path: 'parameters', 
    component: Parameters,
  },
  
  // Routes Missions / Interventions
  { path: 'planning/:id', component: Planning },
  { path: 'add-intervention', component: AddInterventionComponent },
  { path: 'edit-intervention/:id', component: AddInterventionComponent },
  { path: 'intervention/:id', component: DetailsInterventionComponent },
  { path: 'history/:id', component: HistoryComponent },
  { path: 'invoice/:id', component: InvoiceComponent },
  { path: 'commandes', component: CommandesComponent },
  { path: 'equipes', component: Equipes },
  { 
    path: 'completed-missions', 
    component: CompletedInterventionsComponent 
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' } // Redirection de sécurité
];