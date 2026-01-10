import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Query } from 'appwrite';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';
import { InterventionCardComponent } from './intervention-card.component';
import { TaskModalComponent } from './task-modal.component';
import { DashboardFiltersComponent, Owner } from './dashboard-filters.component';
import { BottomNavComponent } from './bottom-nav';
import { AppHeaderComponent } from './app-header';

export interface Task { label: string; done: boolean; }

export interface Intervention {
  id: string;
  $id: string;
  status: string;
  adresse: { ville?: string; rue?: string; numero?: string; };
  mission: Task[];
  assigned: string;
  createdBy: string;
  owner: any[]; 
  habitants: any[];
  proprietaire: any;
  photos: string[];
  plannedAt?: string;
  totalFinal?: number;
  remarques?: string;
  $createdAt: string;
}

export type DashboardFilter = 'ALL' | 'WAITING' | 'PLANNED' | 'DONE';

export const STATUS_CONFIG: Record<string, { label: string, color: string, category: 'pending' | 'planned' | 'completed' }> = {
  'WAITING': { label: 'En attente', color: 'blue-card', category: 'pending' },
  'OPEN': { label: 'Ouvert', color: 'green-card', category: 'pending' },
  'STARTED': { label: 'En cours', color: 'green-card', category: 'planned' },
  'PAUSED': { label: 'En pause', color: 'yellow-card', category: 'planned' },
  'STOPPED': { label: 'Arrêté', color: 'red-card', category: 'planned' },
  'PLANNED': { label: 'Planifié', color: 'blue-card', category: 'planned' },
  'END': { label: 'Terminé', color: 'red-card', category: 'completed' },
  'BILLED': { label: 'Facturé', color: 'green-card', category: 'completed' }
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, BottomNavComponent, RouterModule, 
    InterventionCardComponent, TaskModalComponent, 
    DashboardFiltersComponent, AppHeaderComponent
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  public router = inject(Router);
public readonly STATUS_CONFIG = STATUS_CONFIG; // Doi

  interventions = signal<Intervention[]>([]);
  loading = signal(true);
  isOffline = signal(!navigator.onLine);
  activeFilter = signal<DashboardFilter>('ALL');
  selectedOwnerId = signal<string | null>(null);
  selectedIntervention = signal<Intervention | null>(null);
  pressedCardId = signal<string | null>(null);
  colleagueEmails = signal<string[]>([]);

  private unsubscribeRealtime: (() => void) | null = null;
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  // --- LOGIQUE FILTRAGE ET OWNERS ---
// --- COMPUTED : Extraction des owners uniques ---
owners = computed(() => {
  const list: Owner[] = [];
  const seen = new Set();
  
  this.interventions().forEach(inter => {
    // Dans ton cas, inter.owner est un tableau d'objets JSON
    inter.owner?.forEach(o => {
      // Comme il n'y a pas d'ID, on utilise l'email comme identifiant unique
      const uid = o.email;
      
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        list.push({ 
          id: uid, // On utilise l'email comme ID pour le filtrage
          firstName: o.prenom || '', 
          lastName: o.nom || '', 
          email: o.email || '' 
        });
      }
    });
  });
  return list;
});

// --- LOGIQUE FILTRAGE ---
filteredInterventions = computed(() => {
  let list = this.interventions();
  const ownerId = this.selectedOwnerId(); // C'est l'email ici

  if (ownerId) {
    // On cherche si l'un des owners de l'intervention a cet email
    list = list.filter(i => i.owner?.some(o => o.email === ownerId));
  }
  return list;
});

  pendingInterventions = computed(() => this.filteredInterventions().filter(i => STATUS_CONFIG[i.status]?.category === 'pending'));
  plannedInterventions = computed(() => this.filteredInterventions().filter(i => STATUS_CONFIG[i.status]?.category === 'planned'));
  completedInterventions = computed(() => this.filteredInterventions().filter(i => STATUS_CONFIG[i.status]?.category === 'completed'));

  showPending = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'WAITING');
  showPlanned = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'PLANNED');
  showCompleted = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'DONE');

  ngOnInit() {
    this.themeService.initTheme();
    window.addEventListener('online', () => this.isOffline.set(false));
    window.addEventListener('offline', () => this.isOffline.set(true));
    this.initDashboard();
  }

  ngOnDestroy() { if (this.unsubscribeRealtime) this.unsubscribeRealtime(); }

  setFilter(f: DashboardFilter) { this.activeFilter.set(f); }
  setOwnerFilter(id: string | null) { this.selectedOwnerId.set(id); }

  async initDashboard() {
    this.loading.set(true);
    await this.authService.checkSession();
    const email = this.authService.userEmail();
    if (email) {
      await this.loadInterventions(email);
      this.subscribeToChanges();
    }
    this.loading.set(false);
  }

  async loadInterventions(userEmail: string) {
    try {
      let queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
      if (!this.authService.hasPerm('dash_view_all')) {
        const shares = await this.authService.databases.listDocuments(this.DB_ID, 'shares', [Query.contains('allowed_emails', [userEmail])]);
        const emails = shares.documents.map(doc => doc['user_email']);
        this.colleagueEmails.set(emails);
        queries.push(Query.or([Query.equal('assigned', userEmail), Query.equal('createdBy', userEmail), ...emails.map(e => Query.equal('createdBy', e))]));
      }
      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_INTERVENTIONS, queries);
      this.interventions.set(response.documents.map(d => this.sanitizeIntervention(d)));
    } catch (e) { console.error(e); }
  }

  private sanitizeIntervention(payload: any): Intervention {
    const adr = typeof payload.adresse === 'string' ? JSON.parse(payload.adresse) : payload.adresse;
    const mission = typeof payload.mission === 'string' ? JSON.parse(payload.mission) : payload.mission;
    const owners = Array.isArray(payload.owner) ? payload.owner.map((o:any) => typeof o === 'string' ? JSON.parse(o) : o) : [];
    
    return {
      ...payload,
      id: payload.$id,
      adresse: adr,
      mission: mission?.tasks || [],
      owner: owners,
      photos: payload.photos || []
    };
  }

  subscribeToChanges() { /* Ta logique Realtime existante */ }
  goToAdd() { this.router.navigate(['/add-intervention']); }
  // ... autres méthodes de navigation ...
  // Dans dashboard.ts
makeCall(phone: string) {
  if (phone) {
    window.location.href = `tel:${phone}`;
  }
}
// --- MÉTHODES DE NAVIGATION ET ACTIONS ---

goToDetails(id: string) {
  this.router.navigate(['/intervention-details', id]);
}

goToPlanning(inter: any, event?: Event) {
  if (event) event.stopPropagation();
  this.router.navigate(['/planning', inter.id]);
}

goToEdit(id: string) {
  this.router.navigate(['/edit-intervention', id]);
}

goToInvoice(id: string) {
  this.router.navigate(['/invoice', id]);
}

// --- GESTION DES TÂCHES ET MODALE ---

openTasks(inter: any, event?: Event) {
  if (event) event.stopPropagation();
  this.selectedIntervention.set(inter);
}

  async markAsPaid(intervention: Intervention, event: Event) {
    event.stopPropagation();
    if (confirm(`Confirmer le paiement reçu ?`)) {
      try {
        await this.authService.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, intervention.id, { 
          status: 'PAID', paidAt: new Date().toISOString() 
        });
      } catch (error) { console.error(error); }
    }
  }


// --- LOGIQUE DE "LONG PRESS" (POUR LES ANIMATIONS) ---

onPressStart(inter: any) {
  this.pressedCardId.set(inter.id);
}

onPressEnd() {
  this.pressedCardId.set(null);
}

// --- MÉTHODE APPEL (SI BESOIN) ---


}