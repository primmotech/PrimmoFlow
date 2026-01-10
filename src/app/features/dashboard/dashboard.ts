import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Query } from 'appwrite';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';
import { InterventionCardComponent } from './intervention-card.component';
import { TaskModalComponent } from './task-modal.component';
import { DashboardFiltersComponent } from './dashboard-filters.component';

export interface Task {
  label: string;
  done: boolean;
}

export interface Intervention {
  id: string;
  $id: string;
  status: string;
  adresse: {
    ville?: string;
    rue?: string;
    numero?: string;
  };
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
  'WAITING': { label: 'En attente', color: 'blue-card',   category: 'pending' },
  'OPEN':    { label: 'Ouvert',     color: 'green-card',  category: 'pending' },
  'STARTED': { label: 'En cours',   color: 'green-card',  category: 'planned' },
  'PAUSED':  { label: 'En pause',   color: 'yellow-card', category: 'planned' },
  'STOPPED': { label: 'Arrêté',     color: 'red-card',    category: 'planned' },
  'PLANNED': { label: 'Planifié',   color: 'blue-card',   category: 'planned' },
  'END':     { label: 'Terminé',    color: 'red-card',    category: 'completed' },
  'BILLED':  { label: 'Facturé',    color: 'green-card',  category: 'completed' }
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
 imports: [CommonModule, RouterModule, InterventionCardComponent,TaskModalComponent,DashboardFiltersComponent], // <-- Ajouté ici
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  public router = inject(Router);

  // --- SIGNALS ---
  interventions = signal<Intervention[]>([]);
  loading = signal(true);
  isOffline = signal(!navigator.onLine);
  selectedIntervention = signal<Intervention | null>(null);
  colleagueEmails = signal<string[]>([]);
  pressedCardId = signal<string | null>(null);
  
  // NOUVEAU : Signal de filtrage
  activeFilter = signal<DashboardFilter>('ALL');

  private unsubscribeRealtime: (() => void) | null = null;
  private onlineHandler = () => this.isOffline.set(!navigator.onLine);
  private longPressTimeout: any;
  public isLongPressing = false;

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_ID = '69502be400074c6f43f5';

  // --- COMPUTED FILTRÉS ---
  pendingInterventions = computed(() => 
    this.interventions().filter(i => STATUS_CONFIG[i.status]?.category === 'pending')
  );

  plannedInterventions = computed(() => 
    this.interventions().filter(i => STATUS_CONFIG[i.status]?.category === 'planned')
  );

  completedInterventions = computed(() => 
    this.interventions().filter(i => STATUS_CONFIG[i.status]?.category === 'completed')
  );

  // Visibilité des sections
  showPending = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'WAITING');
  showPlanned = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'PLANNED');
  showCompleted = computed(() => this.activeFilter() === 'ALL' || this.activeFilter() === 'DONE');

  ngOnInit() {
    this.themeService.initTheme();
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.onlineHandler);
    this.initDashboard();
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.onlineHandler);
    if (this.unsubscribeRealtime) this.unsubscribeRealtime();
    if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
  }

  setFilter(f: DashboardFilter) { this.activeFilter.set(f); }

  async initDashboard() {
    this.loading.set(true);
    await this.authService.checkSession();
    const email = this.authService.userEmail();
    if (email) {
      await this.loadInterventions(email);
      this.subscribeToChanges();
    } else {
      this.loading.set(false);
    }
  }

  async loadInterventions(userEmail: string) {
    const activeStatuses = Object.keys(STATUS_CONFIG);
    try {
      this.loading.set(true);
      let queries = [Query.equal('status', activeStatuses), Query.orderDesc('$createdAt'), Query.limit(100)];

      if (!this.authService.hasPerm('dash_view_all')) {
        const sharesResponse = await this.authService.databases.listDocuments(this.DB_ID, 'shares', [Query.contains('allowed_emails', [userEmail])]);
        const emails = sharesResponse.documents.map(doc => doc['user_email']);
        this.colleagueEmails.set(emails);
        const orConditions = [Query.equal('assigned', [userEmail]), Query.equal('createdBy', [userEmail])];
        if (emails.length > 0) orConditions.push(Query.equal('createdBy', emails));
        queries.push(Query.or(orConditions));
      }

      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_INTERVENTIONS, queries);
      this.interventions.set(response.documents.map(d => this.sanitizeIntervention(d)));
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  subscribeToChanges() {
    this.unsubscribeRealtime = this.authService.client.subscribe(
      `databases.${this.DB_ID}.collections.${this.COL_INTERVENTIONS}.documents`, 
      response => {
        const payload = response.payload as any;
        const userEmail = this.authService.userEmail();
        if (!userEmail) return;

        const shares = this.colleagueEmails();
        const canSeeAll = this.authService.hasPerm('dash_view_all');
        const activeStatuses = Object.keys(STATUS_CONFIG);

        const isMine = payload.assigned === userEmail || payload.createdBy === userEmail;
        const isColleagueCreation = shares.includes(payload.createdBy);

        if (canSeeAll || isMine || isColleagueCreation) {
          const event = response.events[0];
          const cleanData = this.sanitizeIntervention(payload);

          if (event.includes('.create') && activeStatuses.includes(payload.status)) {
            this.interventions.update(list => [cleanData, ...list]);
          } 
          else if (event.includes('.update')) {
            if (!activeStatuses.includes(payload.status)) {
              this.interventions.update(list => list.filter(i => i.id !== payload.$id));
            } else {
              this.interventions.update(list => list.map(i => i.id === payload.$id ? cleanData : i));
            }
          } 
          else if (event.includes('.delete')) {
            this.interventions.update(list => list.filter(i => i.id !== payload.$id));
          }
        }
      }
    );
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

  private async confirmDeletion(inter: Intervention) {
    if (confirm(`⚠️ Supprimer l'intervention à ${inter.adresse?.ville} ?`)) {
      try {
        if ('vibrate' in navigator) navigator.vibrate(50);
        await this.authService.databases.deleteDocument(this.DB_ID, this.COL_INTERVENTIONS, inter.id);
      } catch (error) { console.error(error); }
    }
  }

  handleCardClick(inter: Intervention, type: 'details' | 'invoice') {
    if (this.isLongPressing) return;
    
    if (type === 'details') {
      if (inter.status === 'OPEN' || inter.status === 'WAITING') {
        if (this.authService.hasPerm('dash_act_plan')) {
          this.goToPlanning(inter);
        } else if (this.authService.hasPerm('dash_nav_details')) {
          this.goToDetails(inter.id);
        }
      } else {
        if (this.authService.hasPerm('dash_nav_details')) this.goToDetails(inter.id);
      }
    } else {
      this.handleCompletedClick(inter);
    }
  }

  handleCompletedClick(inter: Intervention) {
    if (inter.status === 'BILLED') {
      if (this.authService.hasPerm('dash_nav_billed')) this.markAsPaid(inter, { stopPropagation: () => {} } as Event);
    } else {
      if (this.authService.hasPerm('dash_nav_invoice')) this.goToInvoice(inter.id);
    }
  }

  goToEdit(id: string) { this.router.navigate(['/edit-intervention', id]); }
  goToDetails(id: string) { this.router.navigate(['/intervention', id]); }

  goToPlanning(intervention: Intervention, event?: Event) {
    if (event) {
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }
    if (this.authService.hasPerm('dash_act_plan')) {
      this.router.navigate(['/planning', intervention.id], { state: { data: intervention } });
    }
  }

  goToInvoice(id: string) { this.router.navigate(['/invoice', id]); }
  goToCompletedMissions() { this.router.navigate(['/completed-missions']); }
  goToAdd() { this.router.navigate(['/add-intervention']); }

  onPressStart(inter: Intervention) {
    this.isLongPressing = false;
    this.pressedCardId.set(inter.id);
    if (this.authService.hasPerm('dash_act_delete')) {
      this.longPressTimeout = setTimeout(() => {
        this.isLongPressing = true;
        this.confirmDeletion(inter);
      }, 800);
    }
  }

  onPressEnd() {
    if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
    setTimeout(() => { this.pressedCardId.set(null); this.isLongPressing = false; }, 50);
  }

  openTasks(inter: Intervention, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.authService.hasPerm('dash_act_tasks')) return;
    this.selectedIntervention.set(inter);
  }
  closeTasks() { this.selectedIntervention.set(null); }

  private sanitizeIntervention(payload: any): Intervention {
    const hasViewContacts = this.authService.hasPerm('dash_view_contacts');
    const hasViewPrices = this.authService.hasPerm('dash_view_prices');

    const adr = typeof payload['adresse'] === 'string' ? JSON.parse(payload['adresse']) : payload['adresse'];
    const missionData = typeof payload['mission'] === 'string' ? JSON.parse(payload['mission']) : payload['mission'];
    const tasks = (missionData?.tasks || []).map((t: any) => ({
      label: t.label,
      done: t.done || t.completed || false
    }));

    const rawOwner = payload['owner'];
    const owner = hasViewContacts ? (Array.isArray(rawOwner) ? rawOwner.map(o => typeof o === 'string' ? JSON.parse(o) : o) : []) : [];
    
    const rawHabitants = payload['habitants'];
    let habitants = hasViewContacts ? (Array.isArray(rawHabitants) ? rawHabitants.map(h => typeof h === 'string' ? JSON.parse(h) : h) : 
                        (typeof rawHabitants === 'string' ? JSON.parse(rawHabitants) : [])) : [];

    return {
      ...payload,
      id: payload.$id,
      adresse: adr,
      owner: owner, 
      habitants: Array.isArray(habitants) ? habitants : [habitants],
      proprietaire: hasViewContacts ? (typeof payload['proprietaire'] === 'string' ? JSON.parse(payload['proprietaire']) : payload['proprietaire']) : null,
      mission: tasks, 
      photos: Array.isArray(payload['photos']) ? payload['photos'] : [],
      totalFinal: hasViewPrices ? (payload['totalFinal'] || 0) : 0,
      plannedAt: payload['plannedAt'] || null,
      remarques: payload['remarques'] || ''
    };
  }

  getStatusClass(status: string): string { return STATUS_CONFIG[status]?.color || ''; }
  getStatusLabel(status: string): string { return STATUS_CONFIG[status]?.label || status; }

  parseJson(jsonString: any) {
    if (!jsonString) return { url: '' };
    if (typeof jsonString === 'object') return jsonString;
    try { return JSON.parse(jsonString); } catch (e) { 
      return { url: this.authService.storage.getFileView(this.BUCKET_ID, jsonString) }; 
    }
  }
}