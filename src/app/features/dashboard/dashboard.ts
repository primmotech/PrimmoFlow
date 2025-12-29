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

  // Souscriptions
  private unsubscribeRealtime: (() => void) | null = null;
  private onlineHandler = () => this.isOffline.set(!navigator.onLine);

  // Constantes Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  // --- FILTRAGE RÉACTIF (COMPUTED) ---
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
    // On s'assure que la session et le profil sont chargés
    await this.authService.checkSession();
    const email = this.authService.userEmail();

    if (email) {
      await this.loadInterventions(email);
      this.subscribeToChanges();
    } else {
      this.loading.set(false);
    }
  }



 

  // --- ACTIONS ---
  async markAsPaid(intervention: any, event: Event) {
    event.stopPropagation();
    if (confirm(`Confirmer le paiement pour ${intervention.habitants?.[0]?.nom || 'ce client'} ?`)) {
      try {
        await this.authService.databases.updateDocument(
          this.DB_ID, 
          this.COL_INTERVENTIONS, 
          intervention.id, 
          { 
            status: 'PAID',
            paidAt: new Date().toISOString()
          }
        );
        // Suppression locale immédiate pour fluidité UI
        this.interventions.update(prev => prev.filter(i => i.id !== intervention.id));
      } catch (error) {
        console.error("Erreur paiement:", error);
      }
    }
  }

  // --- NAVIGATION (GOTOOXXX) ---
  goToAdd() { this.router.navigate(['/add-intervention']); }
  goToEdit(id: string) { this.router.navigate(['/edit-intervention', id]); }
  goToDetails(id: string) { if (id) this.router.navigate(['/intervention', id]); }
  goToHistory(id: string) { if (id) this.router.navigate(['/history', id]); }
  goToInvoice(id: string) { if (id) this.router.navigate(['/invoice', id]); }
  goToProfile() { this.router.navigate(['/profile']); }
  goToCompletedMissions() { this.router.navigate(['/completed-missions']); }

  goToPlanning(intervention: any, event: Event) {
    event.stopPropagation();
    const normalizedIntervention = {
      ...intervention,
      adresse: intervention.adresse || { ville: '', rue: '', numero: '' }
    };
    this.router.navigate(['/planning', intervention.id], { 
      state: { data: normalizedIntervention } 
    });
  }

  // --- STYLE HELPERS ---
  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'WAITING': 'waiting-card', 'OPEN': 'waiting-card',
      'PAUSED': 'paused-card', 'STOPPED': 'stopped-card',
      'STARTED': 'started-card', 'BILLED': 'billed-card',
      'END': 'completed-card'
    };
    return classes[status] || '';
  }
  // ... (imports et début de classe identiques)

  async loadInterventions(userEmail: string) {
    const activeStatuses = ['OPEN', 'WAITING', 'PLANNED', 'STOPPED', 'PAUSED', 'STARTED', 'END', 'BILLED'];

    try {
      this.loading.set(true);
      let queries = [
        Query.equal('status', activeStatuses),
        Query.orderDesc('$createdAt'),
        Query.limit(100)
      ];

      // Filtrage selon les droits (Admin vs Leader vs Tech)
      if (!this.authService.hasPerm('miss_view_all')) {
        const profile = await this.authService.loadUserProfile(userEmail);
        const userTeamId = profile?.['teamId'];
        const userRole = this.authService.userRole();

        if (userRole === 'Responsable' && userTeamId) {
          const members = await this.authService.databases.listDocuments(this.DB_ID, 'user_profiles', [Query.equal('teamId', userTeamId)]);
          const memberEmails = members.documents.map(d => d['email']);
          queries.push(Query.or([Query.equal('assigned', memberEmails), Query.equal('createdBy', userEmail)]));
        } else {
          queries.push(Query.or([Query.equal('assigned', userEmail), Query.equal('createdBy', userEmail)]));
        }
      }

      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_INTERVENTIONS, queries);

      // --- LE FIX ICI : Mapping UNIQUE et complet ---
      const sanitizedDocs = response.documents.map(d => ({
        ...d,
        id: d.$id,
        adresse: typeof d['adresse'] === 'string' ? JSON.parse(d['adresse']) : d['adresse'],
        habitants: typeof d['habitants'] === 'string' ? JSON.parse(d['habitants']) : d['habitants'],
        mission: typeof d['mission'] === 'string' ? JSON.parse(d['mission']) : d['mission']
      }));

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
        const eventType = response.events[0];

        if (eventType.includes('.update')) {
          // --- FIX REALTIME : Parser aussi le payload entrant ---
          const sanitizedPayload = {
            ...payload,
            id: payload.$id,
            adresse: typeof payload['adresse'] === 'string' ? JSON.parse(payload['adresse']) : payload['adresse'],
            habitants: typeof payload['habitants'] === 'string' ? JSON.parse(payload['habitants']) : payload['habitants']
          };

          this.interventions.update(list => 
            list.map(i => i.id === payload.$id ? sanitizedPayload : i)
          );
        } else if (eventType.includes('.create') || eventType.includes('.delete')) {
          this.loadInterventions(this.authService.userEmail()!);
        }
      }
    );
  }

// ... (Reste des fonctions goToXXX et markAsPaid identiques)
}