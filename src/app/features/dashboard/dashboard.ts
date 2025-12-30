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
  // Services
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);
  private router = inject(Router);

  // States
  interventions = signal<any[]>([]);
  loading = signal(true);
  isOffline = signal(!navigator.onLine);
  selectedIntervention = signal<any>(null); // Pour la modale

  // Souscriptions
  private unsubscribeRealtime: (() => void) | null = null;
  private onlineHandler = () => this.isOffline.set(!navigator.onLine);

  // Constantes Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
    private readonly BUCKET_ID = '69502be400074c6f43f5';

  // --- FILTRAGE RÉACTIF ---
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

      if (!this.authService.hasPerm('miss_view_all')) {
        const profile = await this.authService.loadUserProfile(userEmail);
        const userTeamId = profile?.['teamId'];
        if (this.authService.userRole() === 'Responsable' && userTeamId) {
          const members = await this.authService.databases.listDocuments(this.DB_ID, 'user_profiles', [Query.equal('teamId', userTeamId)]);
          const memberEmails = members.documents.map(d => d['email']);
          queries.push(Query.or([Query.equal('assigned', memberEmails), Query.equal('createdBy', userEmail)]));
        } else {
          queries.push(Query.or([Query.equal('assigned', userEmail), Query.equal('createdBy', userEmail)]));
        }
      }

      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_INTERVENTIONS, queries);
      const sanitizedDocs = response.documents.map(d => this.sanitizeIntervention(d));
      this.interventions.set(sanitizedDocs);
    } catch (error) {
      console.error("Erreur Appwrite Load:", error);
    } finally {
      this.loading.set(false);
    }
  }

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



  closeTasks() {
    this.selectedIntervention.set(null);
  }

  // --- ACTIONS & NAVIGATION ---
  async markAsPaid(intervention: any, event: Event) {
    event.stopPropagation();
    if (confirm(`Confirmer le paiement ?`)) {
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

  getStatusClass(status: string): string {
    const classes: any = { 'WAITING': 'waiting-card', 'OPEN': 'waiting-card', 'PAUSED': 'paused-card', 'STARTED': 'started-card', 'BILLED': 'billed-card', 'END': 'completed-card' };
    return classes[status] || '';
  }
  // --- MÉTHODES DE NAVIGATION MANQUANTES ---
  goToAdd() { 
    this.router.navigate(['/add-intervention']); 
  }

  goToProfile() { 
    this.router.navigate(['/profile']); 
  }

  goToHistory(id: string) { 
    if (id) this.router.navigate(['/history', id]); 
  }
  private sanitizeIntervention(payload: any) {
  let missionData = payload['mission'];

  if (typeof missionData === 'string') {
    try {
      missionData = JSON.parse(missionData);
    } catch (e) {
      // SI CE N'EST PAS DU JSON : 
      // On découpe la chaîne par les sauts de ligne pour créer un vrai tableau
      missionData = missionData ? missionData.split('\n').map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];
    }
  }

  return {
    ...payload,
    id: payload.$id,
    adresse: typeof payload['adresse'] === 'string' ? JSON.parse(payload['adresse']) : payload['adresse'],
    habitants: typeof payload['habitants'] === 'string' ? JSON.parse(payload['habitants']) : payload['habitants'],
    // On s'assure que mission est toujours un tableau propre
    mission: Array.isArray(missionData) ? missionData : (missionData ? [missionData] : [])
  };
}
openTasks(inter: any, event: Event) {
  event.stopPropagation();
  
  const missionData = inter.mission;
  let finalTasks: string[] = [];

  // 1. On transforme tout en tableau pour simplifier le traitement
  const dataArray = Array.isArray(missionData) ? missionData : [missionData];

  dataArray.forEach(item => {
    if (!item) return;

    let textToSplit = '';

    // CAS DE VOTRE IMAGE : C'est un objet { description: "..." }
    if (typeof item === 'object') {
      textToSplit = item.description || item.label || JSON.stringify(item);
    } 
    // CAS CLASSIQUE : C'est une string "tache1\ntache2"
    else {
      textToSplit = item.toString();
    }

    // 2. On découpe par le saut de ligne (\n)
    if (textToSplit.includes('\n')) {
      finalTasks.push(...textToSplit.split('\n'));
    } else {
      finalTasks.push(textToSplit);
    }
  });

  // 3. Nettoyage final
  const cleanedTasks = finalTasks
    .map(t => t.trim())
    .filter(t => t.length > 0);

  this.selectedIntervention.set({
    ...inter,
    mission: cleanedTasks
  });
}




getFileView(fileId: string) {
  // .getFileView renvoie l'URL de l'image originale
  return this.authService.storage.getFileView(this.BUCKET_ID, fileId);
}
}