import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { NotificationModalComponent } from '../notification-modal/notification-modal.component';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, NotificationModalComponent],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss']
})
export class InvoiceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);

  private DB_ID = '694eba69001c97d55121';
  private COL_INTERVENTIONS = 'interventions';

  intervention = signal<any>(null);
  loading = signal(true);
  showNotificationModal = signal(false);
  savingId = signal<string | null>(null);

  ngOnInit() {
    this.themeService.initTheme();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchIntervention(id);
      } else {
        this.loading.set(false);
      }
    });
  }

 async fetchIntervention(id: string) {
  try {
    const doc = await this.authService.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
    
    // Parsing des données JSON
    const parsed = {
      ...doc,
      id: doc.$id,
      habitants: this.parseSafe(doc['habitants']),
      adresse: this.parseSafe(doc['adresse']),
      timeSessions: this.parseArraySafe(doc['timeSessions']),
      materials: this.parseArraySafe(doc['materials']) // <--- Modifié ici
    };
    
    this.intervention.set(parsed);
    this.loading.set(false);
  } catch (error) {
    console.error('Erreur Appwrite:', error);
    this.loading.set(false);
  }
}
  // --- CALCULS (Adaptés aux signaux) ---
  totalTime = computed(() => {
    const sessions = this.intervention()?.timeSessions || [];
    return sessions.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
  });

  totalMaterials = computed(() => {
    const materials = this.intervention()?.materials || [];
    return materials.reduce((acc: number, m: any) => acc + (Number(m.price) || 0), 0);
  });

  totalTravel = computed(() => Number(this.intervention()?.travelCost) || 0);

  grandTotal = computed(() => this.totalTime() + this.totalMaterials() + this.totalTravel());

  creatorEmail = computed(() => this.intervention()?.createdByEmail || 'Email non disponible');

  // --- ACTIONS D'ÉDITION ---

  async updateSingleField(fieldName: string, newValue: string) {
    let price = parseFloat(newValue);
    if (isNaN(price)) return;
    this.savingId.set(fieldName);

    try {
      await this.authService.databases.updateDocument(
        this.DB_ID, 
        this.COL_INTERVENTIONS, 
        this.intervention().id, 
        { [fieldName]: price }
      );
      setTimeout(() => this.savingId.set(null), 1200);
    } catch (error) {
      this.savingId.set(null);
      alert("Erreur de sauvegarde.");
    }
  }

async updateItemPrice(arrayName: 'timeSessions' | 'materials', itemId: string, newPrice: string) {
  let price = parseFloat(newPrice);
  if (isNaN(price)) return;
  this.savingId.set(itemId);

  const currentInter = this.intervention();
  if (!currentInter) return;

  // Puisque le nom en DB est le même que le nom de l'array, on l'utilise direct
  const updatedArray = currentInter[arrayName].map((item: any) => 
    item.id === itemId ? { ...item, price: price } : item
  ).map((item: any) => JSON.stringify(item));

  try {
    await this.authService.databases.updateDocument(
      this.DB_ID, 
      this.COL_INTERVENTIONS, 
      currentInter.id, 
      { [arrayName]: updatedArray } // <--- Utilise 'materials' ou 'timeSessions'
    );
    
    // Rafraîchir pour recalculer les computed (totaux)
    await this.fetchIntervention(currentInter.id);
    setTimeout(() => this.savingId.set(null), 1200);
  } catch (error) {
    console.error('Erreur update:', error);
    this.savingId.set(null);
    alert("Erreur de sauvegarde.");
  }
}

  // --- NOTIFICATION ---
  sendNotification() { this.showNotificationModal.set(true); }

  async handleNotificationConfirmation(sendEmail: boolean) {
    if (sendEmail) {
      try {
        await this.authService.databases.updateDocument(
          this.DB_ID, 
          this.COL_INTERVENTIONS, 
          this.intervention().id, 
          { status: 'BILLED', billedAt: new Date().toISOString() }
        );
      } catch (e) { console.error(e); }
    }
    this.showNotificationModal.set(false);
  }

  // --- HELPERS ---
  private parseSafe(data: any) {
    try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return data; }
  }
  private parseArraySafe(data: any[]) {
    if (!data) return [];
    return data.map(item => this.parseSafe(item));
  }

  goBack() { this.router.navigate(['/dashboard']); }
}