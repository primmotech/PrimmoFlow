import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Query } from 'appwrite';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  public router = inject(Router); 

  interventions = signal<any[]>([]);
  loading = signal(true);
  isOffline = signal(!navigator.onLine);
  selectedIntervention = signal<any>(null);

  private unsubscribeRealtime: (() => void) | null = null;
  private onlineHandler = () => this.isOffline.set(!navigator.onLine);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_ID = '69502be400074c6f43f5';

  private longPressTimeout: any;
  public isLongPressing = false;

  pendingInterventions = computed(() => 
    this.interventions().filter(i => i.status === 'OPEN' || i.status === 'WAITING')
  );

  plannedInterventions = computed(() => 
    this.interventions().filter(i => ['PLANNED', 'STOPPED', 'PAUSED', 'STARTED'].includes(i.status))
  );

  completedInterventions = computed(() => 
    this.interventions().filter(i => i.status === 'END' || i.status === 'BILLED')
  );

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
  }

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
    const activeStatuses = ['OPEN', 'WAITING', 'PLANNED', 'STOPPED', 'PAUSED', 'STARTED', 'END', 'BILLED'];
    try {
      this.loading.set(true);
      let queries = [
        Query.equal('status', activeStatuses),
        Query.orderDesc('$createdAt'),
        Query.limit(100)
      ];

      if (!this.authService.hasPerm('dash_view_all')) {
        const profile = await this.authService.loadUserProfile(userEmail);
        const userTeamId = profile?.['teamId'];

        if (this.authService.userRole() === 'Responsable' && userTeamId) {
          const members = await this.authService.databases.listDocuments(this.DB_ID, 'user_profiles', [Query.equal('teamId', userTeamId)]);
          const memberEmails = members.documents.map(d => d['email']);
          queries.push(Query.or([
            Query.equal('assigned', memberEmails), 
            Query.equal('createdBy', userEmail)
          ]));
        } else {
          queries.push(Query.or([
            Query.equal('assigned', userEmail), 
            Query.equal('createdBy', userEmail)
          ]));
        }
      }

      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_INTERVENTIONS, queries);
      const sanitizedDocs = response.documents.map(d => this.sanitizeIntervention(d));
      this.interventions.set(sanitizedDocs);
    } catch (error) {
      console.error("Erreur chargement Dashboard:", error);
    } finally {
      this.loading.set(false);
    }
  }

  onPressStart(inter: any) {
    if (this.authService.hasPerm('dash_act_delete')) {
      this.longPressTimeout = setTimeout(() => {
        this.isLongPressing = true;
        this.confirmDeletion(inter);
      }, 800);
    }
  }

  onPressEnd() {
    if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
    // On ne reset pas isLongPressing ici car handleCardClick en a besoin pour bloquer le clic simple
    setTimeout(() => this.isLongPressing = false, 100);
  }

  private async confirmDeletion(inter: any) {
    const city = inter.adresse?.ville || 'cette intervention';
    if (confirm(`⚠️ SUPPRESSION DÉFINITIVE\n\nSouhaitez-vous vraiment supprimer l'intervention à ${city} ?`)) {
      try {
        await this.authService.databases.deleteDocument(this.DB_ID, this.COL_INTERVENTIONS, inter.id);
      } catch (error) {
        console.error("Erreur suppression:", error);
      }
    }
  }

  handleCardClick(inter: any, type: 'details' | 'invoice') {
    if (this.isLongPressing) return;

    if (type === 'details') {
      // Si c'est une fiche en attente, le clic amène au planning, sinon aux détails
      if (inter.status === 'OPEN' || inter.status === 'WAITING') {
        if (this.authService.hasPerm('dash_act_plan')) {
          this.goToPlanning(inter, { stopPropagation: () => {} } as Event);
        }
      } else if (this.authService.hasPerm('dash_nav_details')) {
        this.goToDetails(inter.id);
      }
    } else {
      this.handleCompletedClick(inter);
    }
  }

  handleCompletedClick(inter: any) {
    if (inter.status === 'BILLED') {
      if (this.authService.hasPerm('dash_nav_billed')) {
        this.markAsPaid(inter, { stopPropagation: () => {} } as Event);
      }
    } else {
      if (this.authService.hasPerm('dash_nav_invoice')) {
        this.goToInvoice(inter.id);
      }
    }
  }

  async markAsPaid(intervention: any, event: Event) {
    event.stopPropagation();
    if (confirm(`Confirmer le paiement reçu ?`)) {
      try {
        await this.authService.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, intervention.id, { 
          status: 'PAID', paidAt: new Date().toISOString() 
        });
        this.interventions.update(prev => prev.filter(i => i.id !== intervention.id));
      } catch (error) { console.error(error); }
    }
  }

  goToEdit(id: string) { this.router.navigate(['/edit-intervention', id]); }
  goToDetails(id: string) { if (id) this.router.navigate(['/intervention', id]); }
  goToPlanning(intervention: any, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/planning', intervention.id], { state: { data: intervention } });
  }
  goToInvoice(id: string) { if (id) this.router.navigate(['/invoice', id]); }
  goToCompletedMissions() { this.router.navigate(['/completed-missions']); }
  goToAdd() { this.router.navigate(['/add-intervention']); }

  openTasks(inter: any, event: Event) {
    event.stopPropagation();
    const tasks = Array.isArray(inter.mission) ? inter.mission : [];
    this.selectedIntervention.set({ ...inter, mission: tasks });
  }

  closeTasks() { this.selectedIntervention.set(null); }

  subscribeToChanges() {
    this.unsubscribeRealtime = this.authService.client.subscribe(
      `databases.${this.DB_ID}.collections.${this.COL_INTERVENTIONS}.documents`, 
      response => {
        const payload = response.payload as any;
        if (response.events[0].includes('.update')) {
          const cleanData = this.sanitizeIntervention(payload);
          this.interventions.update(list => list.map(i => i.id === payload.$id ? cleanData : i));
        } else if (response.events[0].includes('.create') || response.events[0].includes('.delete')) {
          this.loadInterventions(this.authService.userEmail()!);
        }
      }
    );
  }

  private sanitizeIntervention(payload: any) {
    let missionData = payload['mission'];
    if (typeof missionData === 'string') {
      try { missionData = JSON.parse(missionData); } catch (e) { missionData = null; }
    }
    return {
      ...payload,
      id: payload.$id,
      adresse: typeof payload['adresse'] === 'string' ? JSON.parse(payload['adresse']) : payload['adresse'],
      habitants: typeof payload['habitants'] === 'string' ? JSON.parse(payload['habitants']) : payload['habitants'],
      proprietaire: typeof payload['proprietaire'] === 'string' ? JSON.parse(payload['proprietaire']) : payload['proprietaire'],
      mission: missionData?.tasks || [], 
      photos: Array.isArray(payload['photos']) ? payload['photos'] : []
    };
  }

  getStatusClass(status: string): string {
    const classes: any = { 'WAITING': 'waiting-card', 'OPEN': 'waiting-card', 'PAUSED': 'paused-card', 'STARTED': 'started-card', 'BILLED': 'billed-card', 'END': 'completed-card' };
    return classes[status] || '';
  }

  parseJson(jsonString: any) {
    if (!jsonString) return { url: '' };
    if (typeof jsonString === 'object') return jsonString;
    try { return JSON.parse(jsonString); } catch (e) { return { url: this.getFileView(jsonString) }; }
  }

  getFileView(fileId: string) {
    return this.authService.storage.getFileView(this.BUCKET_ID, fileId);
  }
}