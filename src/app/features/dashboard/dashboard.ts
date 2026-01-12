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
import { DashboardService } from '../../core/services/dashboard.service';

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
  'BILLED': { label: 'Facturé', color: 'green-card', category: 'completed' },
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
  public readonly STATUS_CONFIG = STATUS_CONFIG;
  private dashService = inject(DashboardService);

  activeFilter = this.dashService.activeFilter;
  selectedOwnerId = this.dashService.selectedOwnerId;
  interventions = signal<Intervention[]>([]);
  loading = signal(true);
  isOffline = signal(!navigator.onLine);
  selectedIntervention = signal<Intervention | null>(null);
  colleagueEmails = signal<string[]>([]);

  private unsubscribeRealtime: (() => void) | null = null;
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  // --- LOGIQUE FILTRAGE ET OWNERS ---
  owners = computed(() => {
    const list: Owner[] = [];
    const seen = new Set();
    
    this.interventions().forEach(inter => {
      inter.owner?.forEach(o => {
        const uid = o.email;
        if (uid && !seen.has(uid)) {
          seen.add(uid);
          list.push({ 
            id: uid, 
            firstName: o.prenom || '', 
            lastName: o.nom || '', 
            email: o.email || '' 
          });
        }
      });
    });
    return list;
  });

  filteredInterventions = computed(() => {
    let list = this.interventions();
    const ownerId = this.selectedOwnerId();
    if (ownerId) {
      list = list.filter(i => i.owner?.some(o => o.email === ownerId));
    }
    return list;
  });

  pendingInterventions = computed(() => this.filteredInterventions().filter(i => STATUS_CONFIG[i.status]?.category === 'pending'));
  // Tri des interventions planifiées par date (la plus récente en haut)
plannedInterventions = computed(() => {
  return this.filteredInterventions()
    .filter(i => STATUS_CONFIG[i.status]?.category === 'planned')
    .sort((a, b) => {
      // On gère les cas où plannedAt pourrait être absent
      const dateA = a.plannedAt ? new Date(a.plannedAt).getTime() : 0;
      const dateB = b.plannedAt ? new Date(b.plannedAt).getTime() : 0;
      
      // Tri décroissant : le plus grand (récent) en premier
      return dateA - dateB;
    });
}); completedInterventions = computed(() => this.filteredInterventions().filter(i => STATUS_CONFIG[i.status]?.category === 'completed'));

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

  setFilter(f: DashboardFilter) { this.dashService.activeFilter.set(f); }
  setOwnerFilter(id: string | null) { this.dashService.selectedOwnerId.set(id); }

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

  subscribeToChanges() {
    this.unsubscribeRealtime = this.authService.client.subscribe(
      `databases.${this.DB_ID}.collections.${this.COL_INTERVENTIONS}.documents`,
      (response) => {
        const eventType = response.events[0];
        const payload = response.payload as any;

        if (eventType.includes('create')) {
          const newInter = this.sanitizeIntervention(payload);
          this.interventions.update(list => [newInter, ...list]);
        } 
        else if (eventType.includes('update')) {
          const updatedInter = this.sanitizeIntervention(payload);
          this.interventions.update(list => 
            list.map(i => i.id === updatedInter.id ? updatedInter : i)
          );
        } 
        else if (eventType.includes('delete')) {
          this.interventions.update(list => 
            list.filter(i => i.id !== payload.$id)
          );
        }
      }
    );
  }

  // --- MÉTHODES DE NAVIGATION ET ACTIONS ---

  goToAdd() { this.router.navigate(['/add-intervention']); }

makeCall(phone: string) {
  if (phone) {
    // La fenêtre de confirmation s'ouvre d'abord
    const confirmCall = confirm(`Voulez-vous appeler le ${phone} ?`);
    
    // Si l'utilisateur clique sur OK (true), on lance l'appel
    if (confirmCall) {
      window.location.href = `tel:${phone}`;
    }
  } else {
    console.warn("Numéro non disponible");
  }
}

  goToDetails(inter: any) {
    this.router.navigate(['/intervention-details', inter.id], { state: { data: inter } });
  }

  goToPlanning(inter: any, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate(['/planning', inter.id], { state: { data: inter } });
  }

  goToEdit(inter: any, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate(['/edit-intervention', inter.id], { state: { data: inter } });
  }

  goToInvoice(inter: any, event?: Event) {
    if (event) event.stopPropagation();
    this.router.navigate(['/invoice', inter.id], { state: { data: inter } });
  }

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
  async deleteIntervention(id: string) {
  // DOUBLE SÉCURITÉ : Même si quelqu'un arrive à déclencher la fonction (via la console par ex)
  if (!this.authService.hasPerm('dash_act_delete')) {
    alert("Vous n'avez pas l'autorisation de supprimer.");
    return;
  }

  try {
    await this.authService.databases.deleteDocument(
      this.DB_ID, 
      this.COL_INTERVENTIONS, 
      id
    );
  } catch (error) {
    console.error("Erreur :", error);
  }
}
}