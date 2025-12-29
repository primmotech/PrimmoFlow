import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ID } from 'appwrite';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';
import imageCompression from 'browser-image-compression';

@Component({
  selector: 'app-details-intervention',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './details-intervention.html',
  styleUrls: ['./details-intervention.scss']
})
export class DetailsInterventionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public themeService = inject(ThemeService);
  public authService = inject(AuthService);

  // IDs de configuration Appwrite
  private DB_ID = '694eba69001c97d55121';
  private COLL_INTERVENTIONS = 'interventions';
  private BUCKET_PHOTOS = '69502be400074c6f43f5';

  // Signaux d'état
  intervention = signal<any>(null);
  loading = signal(true);
  uploading = signal(false);
  selectedPhoto = signal<string | null>(null);

  // Inputs
  itemName = signal('');
  itemPrice = signal<number | null>(null);
  orderName = signal('');
  manualHours = signal<number | null>(null);
  manualMinutes = signal<number | null>(null);

  // Paramètres Technicien
  hourlyRate = signal(28);
  travelFee = signal(12);
  rounding = signal(5);
  gps = signal('maps');

  // Chrono
  timerDisplay = signal('00:00:00');
  isRunning = signal(false);
  private timerInterval: any;
  public workSeconds = 0;
  public pauseSeconds = 0;
  public lastState: 'work' | 'pause' | 'idle' = 'idle';

  // --- LOGIQUE COMPUTED ---




displayedOrders = computed(() => {
    // On parse chaque commande avant de filtrer
    const orders = (this.intervention()?.orders || []).map((o: any) => this.parseJson(o));
    return orders.filter((o: any) => o.status !== 'COMMANDÉ');
  });

  displayedMaterials = computed(() => {
    // 1. On parse les matériaux réels
    const materials = (this.intervention()?.materials || [])
      .map((m: any) => ({ ...this.parseJson(m), isFromOrder: false }));
    
    // 2. On parse les commandes pour extraire celles qui sont transformées en matériel
    const orderedItems = (this.intervention()?.orders || [])
      .map((o: any) => this.parseJson(o))
      .filter((o: any) => o.status === 'COMMANDÉ')
      .map((o: any) => ({ id: o.id, description: o.name, price: o.price || 0, isFromOrder: true }));
    
    return [...materials, ...orderedItems];
  });

  ngOnInit() {
    this.themeService.initTheme();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.fetchData(id);
    }

    const email = this.authService.userEmail();
    if (email) {
      this.authService.getUserProfile(email).then(profile => {
        if (profile) {
          this.hourlyRate.set(profile.hourlyRate || 28);
          this.travelFee.set(profile.travelCost || 12);
          this.rounding.set(profile.rounding || 15);
          this.gps.set(profile.gps || 'maps');
        }
      });
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async fetchData(id: string) {
    try {
      const doc = await this.authService.databases.getDocument(this.DB_ID, this.COLL_INTERVENTIONS, id);
      this.intervention.set(doc);
      this.loading.set(false);

      this.authService.client.subscribe(
        `databases.${this.DB_ID}.collections.${this.COLL_INTERVENTIONS}.documents.${id}`,
        response => {
          this.intervention.set(response.payload);
        }
      );
    } catch (error) {
      console.error("Erreur fetchData:", error);
    }
  }

  // --- LOGIQUE DE MISE À JOUR CENTRALISÉE ---

  private async updateIntervention(data: any) {
    const docId = this.intervention()?.$id;
    if (!docId) return;
    return await this.authService.databases.updateDocument(this.DB_ID, this.COLL_INTERVENTIONS, docId, data);
  }

  // --- GESTION DU TEMPS ---

  playTimer() {
    this.isRunning.set(true);
    this.lastState = 'work';
    this.updateStatus('STARTED');
    if (!this.timerInterval) {
      this.timerInterval = setInterval(() => {
        if (this.lastState === 'work') this.workSeconds++;
        else this.pauseSeconds++;
        this.timerDisplay.set(this.formatDuration(this.workSeconds + this.pauseSeconds, true));
      }, 1000);
    }
  }

  pauseTimer() {
    this.lastState = 'pause';
    this.updateStatus('PAUSED');
  }

  async stopAndSaveTimer() {
    if (this.workSeconds === 0 && this.pauseSeconds === 0) return;
    this.isRunning.set(false);
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    await this.addTimeSession(this.workSeconds, this.pauseSeconds);
    await this.updateStatus('STOPPED');
    this.workSeconds = 0; 
    this.pauseSeconds = 0;
    this.lastState = 'idle';
    this.timerDisplay.set('00:00:00');
  }



  async removeSession(session: any) {
    const updated = this.intervention().timeSessions.filter((s: any) => s !== session);
    await this.updateIntervention({ timeSessions: updated });
  }

async addManualSession() {
    // 1. Calcul des secondes brutes saisies
    const rawSec = ((this.manualHours() || 0) * 3600) + ((this.manualMinutes() || 0) * 60);
    
    if (rawSec > 0) {
      // 2. Application de l'arrondi
      const roundingSec = this.rounding() * 60;
      const roundedSec = roundingSec > 0 
        ? Math.ceil(rawSec / roundingSec) * roundingSec 
        : rawSec;

      // 3. Enregistrement (addTimeSession gère déjà le stockage JSON)
      await this.addTimeSession(roundedSec, 0);

      // 4. Reset des inputs
      this.manualHours.set(null); 
      this.manualMinutes.set(null);
    }
  }

  async updateStatus(status: string) {
    await this.updateIntervention({ status });
  }

  // --- MATÉRIAUX & COMMANDES ---

  async addMaterial() {
    if (!this.itemName() || this.itemPrice() === null) return;
    const current = this.intervention()?.materials || [];
    const newMat = { 
      id: Date.now().toString(), 
      description: this.itemName(), 
      price: this.itemPrice() 
    };
    
    await this.updateIntervention({
      materials: [...current, JSON.stringify(newMat)]
    });
    this.itemName.set(''); 
    this.itemPrice.set(null);
  }

  async removeMaterial(mat: any) {
    const updated = this.intervention().materials.filter((m: any) => m !== mat);
    await this.updateIntervention({ materials: updated });
  }

  async addOrder() {
    if (!this.orderName()) return;
    const current = this.intervention().orders || [];
    const newOrder = { id: Date.now().toString(), name: this.orderName(), status: 'A commander' };
    
    await this.updateIntervention({
      orders: [...current, JSON.stringify(newOrder)]
    });
    this.orderName.set('');
  }

  async removeOrder(order: any) {
    const updated = this.intervention().orders.filter((o: any) => o !== order);
    await this.updateIntervention({ orders: updated });
  }

  // --- PHOTOS ---

async uploadPhoto(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  // Active le loader visuel sur le bouton
  this.uploading.set(true);

  try {
    // 1. Compression de l'image (max 1Mo) pour optimiser le stockage
    const options = { 
      maxSizeMB: 1, 
      maxWidthOrHeight: 1280, 
      useWebWorker: true 
    };
    const compressedBlob = await imageCompression(file, options);
    
    // 2. Conversion en objet File (indispensable pour le payload Appwrite)
    const compressedFile = new File([compressedBlob], file.name, { type: file.type });

    // 3. Upload vers le Storage Appwrite
    const photoId = ID.unique();
    await this.authService.storage.createFile(
      this.BUCKET_PHOTOS, 
      photoId, 
      compressedFile
    );

    // 4. Récupération de l'URL via getFileView (plus fiable que Preview sur certaines instances)
    const finalUrl = this.authService.storage.getFileView(this.BUCKET_PHOTOS, photoId).toString();

    // 5. Mise à jour du document dans la Database
    const currentPhotos = this.intervention()?.photos || [];
    
    // On prépare l'objet JSON à stocker dans le tableau 'photos'
    const photoData = JSON.stringify({ 
      id: photoId, 
      url: finalUrl, // URL pour la miniature de la grille
      full: finalUrl  // URL pour l'affichage plein écran
    });

    await this.updateIntervention({
      photos: [...currentPhotos, photoData]
    });

    console.log("Photo ajoutée avec succès :", photoId);

  } catch (e) {
    console.error("Erreur lors de l'upload :", e);
    alert("Impossible d'envoyer la photo. Vérifiez votre connexion.");
  } finally {
    // Désactive le loader et réinitialise l'input file
    this.uploading.set(false);
    event.target.value = '';
  }
}

  async removePhoto(photo: any) {
    const photoObj = typeof photo === 'string' ? JSON.parse(photo) : photo;
    const updated = this.intervention().photos.filter((p: any) => p !== photo);
    
    try {
      await this.authService.storage.deleteFile(this.BUCKET_PHOTOS, photoObj.id);
    } catch (e) {
      console.error("Fichier Storage déjà absent ou erreur");
    }
    await this.updateIntervention({ photos: updated });
  }

  // --- CALCULS & ACTIONS FINALES ---

updateTravel(inc: number) {
  const currentCount = this.intervention()?.travelCount || 0;
  const newCount = Math.max(0, currentCount + inc);
  const newCost = newCount * this.travelFee(); // Calcul du coût financier

  this.updateIntervention({ 
    travelCount: newCount,
    travelCost: newCost // On met à jour les deux en même temps
  });
}

  calculateTotal() {
    const b = this.getBreakdown();
    return b.mat + b.time + b.travel;
  }

getBreakdown() {
    const inter = this.intervention();
    if (!inter) return { mat: 0, time: 0, travel: 0 };
    
    // Calcul Temps
    const roundingSec = this.rounding() * 60;
    const liveWorkSec = roundingSec > 0 ? Math.ceil(this.workSeconds / roundingSec) * roundingSec : this.workSeconds;
    const sessions = inter.timeSessions?.map((s: any) => this.parseJson(s)) || [];
    const totalSessionsPrice = sessions.reduce((acc: number, s: any) => acc + (s.price || 0), 0);
    const livePrice = (liveWorkSec / 3600) * this.hourlyRate();

    // Calcul Matériel (Basé sur le computed déjà parsé ci-dessus)
    const mats = this.displayedMaterials();
    const totalMat = mats.reduce((acc: number, m: any) => acc + (Number(m.price) || 0), 0);

    return {
      mat: totalMat,
      time: totalSessionsPrice + livePrice,
      travel: (inter.travelCount || 0) * this.travelFee()
    };
  }

async pauseAndRequestVisit() {
  // Le bouton étant disabled dans le HTML si isRunning(), 
  // cette sécurité est juste une barrière logicielle supplémentaire.
  if (this.isRunning()) return;

  if (!window.confirm("Placer cette mission en attente de revisite ?")) return;

  try {
    // Mise à jour vers le statut WAITING
    await this.updateIntervention({
      status: 'WAITING',
      $updatedAt: new Date().toISOString()
    });

    // Retour à la liste des missions
    this.goBack();
    
  } catch (e) {
    console.error("Erreur lors de la mise en attente:", e);
    alert("Erreur technique : impossible de changer le statut.");
  }
}

  async finishIntervention() {
    if (this.isRunning()) await this.stopAndSaveTimer();
    const b = this.getBreakdown();
    try {
      await this.updateIntervention({
        status: 'END',
        completedAt: new Date().toISOString(),
        travelCost: b.travel,
        totalFinal: (b.mat + b.time + b.travel)
      });
      this.router.navigate(['/dashboard']);
    } catch (e) {
      console.error(e);
    }
  }

  // --- UTILS ---

  formatDuration(t: number, s = false): string {
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const sec = (t % 60).toString().padStart(2, '0');
    return s ? `${h}:${m}:${sec}` : `${h}:${m}`;
  }

// Dans details-intervention.ts
openGPS() {
  const rawAddr = this.intervention()?.adresse;
  if (!rawAddr) return;

  // On parse l'adresse si c'est une string
  const addr = typeof rawAddr === 'string' ? JSON.parse(rawAddr) : rawAddr;
  
  const q = encodeURIComponent(`${addr.numero} ${addr.rue}, ${addr.ville}`);
  const url = this.gps() === 'waze' ? `https://waze.com/ul?q=${q}` : 
              this.gps() === 'iphone' ? `http://maps.apple.com/?q=${q}` : 
              `https://www.google.com/maps/search/?api=1&query=${q}`;
  window.open(url, '_blank');
}

  openLightbox(url: string) { this.selectedPhoto.set(url); }
  closeLightbox() { this.selectedPhoto.set(null); }
  goBack() { this.router.navigate(['/dashboard']); }
// Dans ton details-intervention.ts

// Helper pour le template HTML
parseJson(data: any): any {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}
async addTimeSession(workSec: number, pauseSec: number) {
    const currentSessions = this.intervention()?.timeSessions || [];
    
    // APPLICATION DE L'ARRONDI
    const roundingSec = this.rounding() * 60;
    const roundedWorkSec = roundingSec > 0 
      ? Math.ceil(workSec / roundingSec) * roundingSec 
      : workSec;

    const newSession = {
      id: Date.now().toString(),
      workDuration: this.formatDuration(roundedWorkSec, true), // On stocke la durée arrondie
      pauseDuration: this.formatDuration(pauseSec, true),
      price: (roundedWorkSec / 3600) * this.hourlyRate(), // Prix basé sur l'arrondi
      date: new Date().toISOString()
    };

    await this.updateIntervention({
      timeSessions: [...currentSessions, JSON.stringify(newSession)]
    });
  }
}