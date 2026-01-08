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

  // --- FILTRES COMPUTED ---
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

    // 1. Préparation des requêtes de base (Statuts + Tri)
    let queries = [
      Query.equal('status', activeStatuses),
      Query.orderDesc('$createdAt'),
      Query.limit(100)
    ];

    // 2. CONDITION : Si l'utilisateur n'a PAS le droit de tout voir, on applique les restrictions
    if (!this.authService.hasPerm('dash_view_all')) {
      
      // On cherche les partages
      const sharesResponse = await this.authService.databases.listDocuments(
        this.DB_ID,
        'shares',
        [Query.contains('allowed_emails', [userEmail])]
      );

      const authorizedEmails = [
        userEmail, 
        ...sharesResponse.documents.map(doc => doc['user_email'])
      ];

      // On restreint la vue à (Moi + Partages)
      queries.push(
        Query.or([
          Query.equal('assigned', authorizedEmails),
          Query.equal('createdBy', authorizedEmails)
        ])
      );
    } 
    // Sinon (si dash_view_all est vrai), on ne rajoute aucun filtre d'email 
    // et Appwrite renverra tous les documents de la collection.

    // 3. Exécution
    const response = await this.authService.databases.listDocuments(
      this.DB_ID, 
      this.COL_INTERVENTIONS, 
      queries
    );

    const sanitizedDocs = response.documents.map(d => this.sanitizeIntervention(d));
    this.interventions.set(sanitizedDocs);

  } catch (error) {
    console.error("Erreur chargement Dashboard:", error);
  } finally {
    this.loading.set(false);
  }
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

  // --- NAVIGATION & ACTIONS ---
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
  

  closeTasks() { this.selectedIntervention.set(null); }

  // --- REALTIME ---
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

  // --- DATA MAPPING (SANITIZATION) ---
  private sanitizeIntervention(payload: any) {
    const rawOwner = payload['owner'];
    let parsedOwner = [];

    if (Array.isArray(rawOwner)) {
      parsedOwner = rawOwner.map(item => typeof item === 'string' ? JSON.parse(item) : item);
    }

    const missionData = typeof payload['mission'] === 'string' 
      ? JSON.parse(payload['mission']) 
      : payload['mission'];

    return {
      ...payload,
      id: payload.$id,
      adresse: typeof payload['adresse'] === 'string' ? JSON.parse(payload['adresse']) : payload['adresse'],
      owner: parsedOwner, 
      habitants: typeof payload['habitants'] === 'string' ? JSON.parse(payload['habitants']) : payload['habitants'],
      proprietaire: typeof payload['proprietaire'] === 'string' ? JSON.parse(payload['proprietaire']) : payload['proprietaire'],
      mission: missionData?.tasks || [], 
      photos: Array.isArray(payload['photos']) ? payload['photos'] : []
    };
  }

  // --- STYLE HELPERS (MISE À JOUR COULEURS) ---
  getStatusClass(status: string): string {
    const classes: any = { 
      'WAITING': 'blue-card', 
      'OPEN': 'green-card', 
      'STARTED': 'green-card',
      'PAUSED': 'yellow-card', 
      'STOPPED': 'red-card', 
      'END': 'red-card',
      'BILLED': 'green-card' 
    };
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




handleCardClick(inter: any, type: 'details' | 'invoice') {
  // Si le timer est allé au bout (800ms), on bloque le clic simple
  if (this.isLongPressing) return;
  
  // Sinon, on exécute le clic normalement
  if (type === 'details') {
    if (inter.status === 'OPEN' || inter.status === 'WAITING') {
      this.goToPlanning(inter, { stopPropagation: () => {} } as Event);
    } else {
      this.goToDetails(inter.id);
    }
  } else {
    this.handleCompletedClick(inter);
  }
}
// Ajoute cette propriété en haut de ta classe
pressedCardId = signal<string | null>(null);

onPressStart(inter: any) {
  this.isLongPressing = false;
  this.pressedCardId.set(inter.id); // On mémorise quelle carte est pressée

  if (this.authService.hasPerm('dash_act_delete')) {
    this.longPressTimeout = setTimeout(() => {
      this.isLongPressing = true;
      this.confirmDeletion(inter);
    }, 800);
  }
}

onPressEnd() {
  if (this.longPressTimeout) clearTimeout(this.longPressTimeout);
  // On attend un tout petit peu avant de reset l'ID pour laisser le clic passer
  setTimeout(() => {
    this.pressedCardId.set(null);
    this.isLongPressing = false;
  }, 50);
}

openTasks(inter: any, event: Event) {
  event.preventDefault();
  event.stopPropagation();
  
  // Si on est en train de supprimer (long press), on n'ouvre pas la modale
  if (this.isLongPressing) return;

  console.log("Ouverture des tâches pour :", inter.id); // Pour débugger
  const tasks = Array.isArray(inter.mission) ? inter.mission : [];
  this.selectedIntervention.set({ ...inter, mission: tasks });
}

}