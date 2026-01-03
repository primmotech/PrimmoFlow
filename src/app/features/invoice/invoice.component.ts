import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { NotificationModalComponent } from '../notification-modal/notification-modal.component';
import { NotificationService } from '../../core/services/notification.service';

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
      if (id) { this.fetchIntervention(id); }
    });
  }

  grandTotal = computed(() => {
    const i = this.intervention();
    if (!i) return 0;
    const t = (i.timeSessions || []).reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
    const m = (i.materials || []).reduce((acc: number, m: any) => acc + (Number(m.price) || 0), 0);
    return t + m + (Number(i.travelCost) || 0);
  });

  creatorEmail = computed(() => this.intervention()?.createdByEmail || '');

  async updateSingleField(fieldName: string, newValue: any) {
    let price = Number(parseFloat(newValue).toFixed(2));
    if (isNaN(price)) return;
    this.savingId.set(fieldName);
    try {
      await this.authService.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, this.intervention().id, { [fieldName]: price });
      this.intervention.update(p => ({ ...p, [fieldName]: price }));
      setTimeout(() => this.savingId.set(null), 800);
    } catch (e) { this.savingId.set(null); }
  }

  async updateItemPrice(arrayName: 'timeSessions' | 'materials', itemId: string, newPrice: any) {
    let price = Number(parseFloat(newPrice).toFixed(2));
    if (isNaN(price)) return;
    this.savingId.set(itemId);
    const curr = this.intervention();
    const updated = curr[arrayName].map((i: any) => i.id === itemId ? { ...i, price } : i).map((i: any) => JSON.stringify(i));
    try {
      await this.authService.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, curr.id, { [arrayName]: updated });
      await this.fetchIntervention(curr.id);
      setTimeout(() => this.savingId.set(null), 800);
    } catch (e) { this.savingId.set(null); }
  }

  async fetchIntervention(id: string) {
    try {
      const doc = await this.authService.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
      const mission = this.parseSafe(doc['mission']);
      const rawHab = this.parseSafe(doc['habitants']);
      this.intervention.set({
        ...doc,
        id: doc.$id,
        proprietaire: this.parseSafe(doc['proprietaire']),
        habitants: Array.isArray(rawHab) ? rawHab : (rawHab ? [rawHab] : []),
        adresse: this.parseSafe(doc['adresse']),
        timeSessions: this.parseArraySafe(doc['timeSessions']).map(s => ({...s, price: Number(Number(s.price).toFixed(2))})),
        materials: this.parseArraySafe(doc['materials']).map(m => ({...m, price: Number(Number(m.price).toFixed(2))})),
        travelCost: Number(Number(doc['travelCost'] || 0).toFixed(2)),
        tasks: mission?.tasks || []
      });
      this.loading.set(false);
    } catch (e) { this.loading.set(false); }
  }

  private parseSafe(d: any) { try { return typeof d === 'string' ? JSON.parse(d) : d; } catch { return d; } }
  private parseArraySafe(d: any[]) { return (d || []).map(i => this.parseSafe(i)); }
  sendNotification() { this.showNotificationModal.set(true); }
  goBack() { this.router.navigate(['/dashboard']); }
  // À ajouter dans votre classe
travelLabel = computed(() => {
  const count = this.intervention()?.travelCount || 0;
  return count > 1 ? `Déplacements (${count})` : 'Déplacement';
  
});
// À ajouter après ton computed travelLabel
assignedName = computed(() => this.intervention()?.assigned || 'le technicien');

// N'oublie pas d'injecter le service dans le constructor ou via inject()
private notificationService = inject(NotificationService);


async handleNotificationConfirmation(confirmed: boolean) {
  if (confirmed) {
    const intervention = this.intervention();
    const email = intervention?.createdBy;
    const technician = this.assignedName();
    const total = this.grandTotal();
    const city = intervention?.adresse?.ville || 'Intervention';

    try {
      // 1. Envoi de l'email
      await this.notificationService.sendPaymentNotification(technician, email, total, city);
      
      // 2. Mise à jour en base de données
      await this.authService.databases.updateDocument(
        this.DB_ID, 
        this.COL_INTERVENTIONS, 
        intervention.id, 
        { status: "BILLED" }
      );

      // 3. MISE À JOUR DU SIGNAL (Pour le direct update)
      this.intervention.update(curr => ({
        ...curr,
        status: "BILLED"
      }));
      
      console.log("Notification envoyée et interface mise à jour !");
    } catch (error) {
      console.error("Erreur :", error);
    }
  }
  this.showNotificationModal.set(false);
}
}