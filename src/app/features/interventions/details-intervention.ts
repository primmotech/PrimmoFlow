import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ID } from 'appwrite';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';
import { ImageService } from '../../core/services/image.service';

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
  public imageService = inject(ImageService);

  protected readonly JSON = JSON;

  // Configuration Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COLL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_PHOTOS = '69502be400074c6f43f5';

  // État de l'UI
  intervention = signal<any>(null);
  loading = signal(true);
  uploading = signal(false);
  selectedPhoto = signal<string | null>(null);

  // Saisies formulaires
  itemName = signal('');
  itemPrice = signal<number | null>(null);
  orderName = signal('');
  manualHours = signal<number | null>(null);
  manualMinutes = signal<number | null>(null);
pauseDisplay = signal('00:00:00');

  // Paramètres techniques
  hourlyRate = signal(28);
  travelFee = signal(12);
  rounding = signal(5);
  gps = signal('maps');

  // Chronomètre
  startTime = signal<string | null>(null);
  timerDisplay = signal('00:00:00');
  isRunning = signal(false);
  private timerInterval: any;
  public workSeconds = 0;
  public pauseSeconds = 0;
  public lastState: 'work' | 'pause' | 'idle' = 'idle';

  // --- LOGIQUE RÉACTIVE ---

  missionTasks = computed(() => {
    const item = this.intervention();
    if (!item || !item.mission) return [];
    const parsedMission = this.parseJson(item.mission);
    return parsedMission?.tasks || [];
  });

  canAddMaterial = computed(() => {
    return this.itemName().trim().length > 0 && this.itemPrice() !== null;
  });

  displayedOrders = computed(() => {
    const orders = (this.intervention()?.orders || []).map((o: any) => this.parseJson(o));
    return orders.filter((o: any) => o.status !== 'COMMANDÉ');
  });

  displayedMaterials = computed(() => {
    return (this.intervention()?.materials || []).map((m: any) => this.parseJson(m));
  });

  ngOnInit() {
    this.themeService.initTheme();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchData(id);

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
      let doc = await this.authService.databases.getDocument(this.DB_ID, this.COLL_INTERVENTIONS, id);
      doc = this.recoverTimerState(doc);
      this.intervention.set(doc);

      if (doc['startTime'] && (doc['status'] === 'STARTED' || doc['status'] === 'PAUSED')) {
        this.startTime.set(doc['startTime']);
        this.isRunning.set(true);
        this.startDisplayLoop();
      }

      this.loading.set(false);

      this.authService.client.subscribe(
        `databases.${this.DB_ID}.collections.${this.COLL_INTERVENTIONS}.documents.${id}`,
        response => {
          const updatedDoc = this.recoverTimerState(response.payload);
          this.intervention.set(updatedDoc);
        }
      );
    } catch (error) {
      console.error("Erreur fetchData:", error);
    }
  }

  // --- GESTION DU TEMPS (OFFLINE / ONLINE) ---

  private async syncTimerState(data: any) {
    const docId = this.intervention()?.$id;
    if (!docId) return;

    localStorage.setItem(`timer_${docId}`, JSON.stringify({
      ...data,
      updatedAt: new Date().getTime()
    }));

    try {
      await this.updateIntervention(data);
    } catch (e) {
      console.warn("Offline sync failed");
    }
  }

  private recoverTimerState(doc: any) {
    const localDataRaw = localStorage.getItem(`timer_${doc.$id}`);
    if (localDataRaw) {
      const local = JSON.parse(localDataRaw);
      const remoteUpdate = new Date(doc['$updatedAt']).getTime();
      if (local.updatedAt > remoteUpdate) {
        return { ...doc, ...local };
      }
    }
    return doc;
  }

  async playTimer() {
    const currentInter = this.intervention();
    const now = new Date();

    if (currentInter?.['status'] === 'PAUSED' && currentInter?.['pauseStartTime']) {
      const pStart = new Date(currentInter['pauseStartTime']).getTime();
      const pDuration = Math.floor((now.getTime() - pStart) / 1000);
      const newTotalPause = (currentInter['totalPauseSeconds'] || 0) + pDuration;
      
      await this.syncTimerState({
        status: 'STARTED',
        pauseStartTime: null,
        totalPauseSeconds: newTotalPause
      });
    } 
    else if (!currentInter?.['startTime']) {
      await this.syncTimerState({
        status: 'STARTED',
        startTime: now.toISOString(),
        totalPauseSeconds: 0
      });
      this.startTime.set(now.toISOString());
    } else {
      await this.syncTimerState({ status: 'STARTED' });
    }

    this.isRunning.set(true);
    this.startDisplayLoop();
  }

  async pauseTimer() {
    const now = new Date().toISOString();
    await this.syncTimerState({
      status: 'PAUSED',
      pauseStartTime: now
    });
    this.lastState = 'pause';
  }

private startDisplayLoop() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const inter = this.intervention();
      if (!inter?.['startTime']) return;

      const start = new Date(inter['startTime']).getTime();
      const now = new Date().getTime();
      
      let totalElapsed = Math.floor((now - start) / 1000);
      let cumulativePause = Number(inter['totalPauseSeconds'] || 0);
      let currentPauseSession = 0;

      // Si on est en pause, on calcule la durée de la pause en cours
      if (inter['status'] === 'PAUSED' && inter['pauseStartTime']) {
        const pStart = new Date(inter['pauseStartTime']).getTime();
        currentPauseSession = Math.floor((now - pStart) / 1000);
      }

      this.pauseSeconds = cumulativePause + currentPauseSession;
      this.workSeconds = Math.max(0, totalElapsed - this.pauseSeconds);

      // Mise à jour des deux signaux d'affichage
      this.timerDisplay.set(this.formatDuration(this.workSeconds, true));
      this.pauseDisplay.set(this.formatDuration(this.pauseSeconds, true));
    }, 1000);
  }

  async stopAndSaveTimer() {
    const inter = this.intervention();
    if (!inter?.['startTime']) return;

    this.isRunning.set(false);
    clearInterval(this.timerInterval);

    await this.addTimeSession(this.workSeconds, this.pauseSeconds);
    
    await this.syncTimerState({ 
      startTime: null, 
      pauseStartTime: null,
      totalPauseSeconds: 0,
      status: 'STOPPED' 
    });

    localStorage.removeItem(`timer_${inter.$id}`);
    this.startTime.set(null);
    this.workSeconds = 0;
    this.pauseSeconds = 0;
    this.timerDisplay.set('00:00:00');
  }

  // --- ACTIONS DOCUMENT ---

  private async updateIntervention(data: any) {
    const docId = this.intervention()?.$id;
    if (!docId) return;
    return await this.authService.databases.updateDocument(this.DB_ID, this.COLL_INTERVENTIONS, docId, data);
  }

  async updateStatus(status: string) {
    await this.updateIntervention({ status });
  }

  // --- TÂCHES & MISSIONS ---

  async toggleMissionTask(index: number) {
    const current = this.intervention();
    if (!current) return;
    const missionData = this.parseJson(current.mission);
    if (missionData.tasks?.[index]) {
      missionData.tasks[index].done = !missionData.tasks[index].done;
      await this.updateIntervention({ mission: JSON.stringify(missionData) });
    }
  }

  // --- MATÉRIAUX & COMMANDES ---

  async addMaterial() {
    if (!this.itemName() || this.itemPrice() === null) return;
    const current = this.intervention()?.materials || [];
    const newMat = { id: Date.now().toString(), description: this.itemName(), price: this.itemPrice() };
    await this.updateIntervention({ materials: [...current, JSON.stringify(newMat)] });
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
    await this.updateIntervention({ orders: [...current, JSON.stringify(newOrder)] });
    this.orderName.set('');
  }

  async removeOrder(order: any) {
    const updated = this.intervention().orders.filter((o: any) => o !== order);
    await this.updateIntervention({ orders: updated });
  }

  async toggleTaskStatus(taskToToggle: any) {
    const currentOrdersRaw = this.intervention()?.orders || [];
    const updatedOrders = currentOrdersRaw.map((oStr: string) => {
      const o = this.parseJson(oStr);
      if (o.id === taskToToggle.id) {
        o.status = (o.status === 'TERMINÉ') ? 'A commander' : 'TERMINÉ';
      }
      return JSON.stringify(o);
    });
    await this.updateIntervention({ orders: updatedOrders });
  }

  // --- SESSIONS DE TEMPS ---

  async addTimeSession(workSec: number, pauseSec: number) {
    const currentSessions = this.intervention()?.timeSessions || [];
    const roundingSec = this.rounding() * 60;
    const roundedWorkSec = roundingSec > 0 ? Math.ceil(workSec / roundingSec) * roundingSec : workSec;

    const newSession = {
      id: Date.now().toString(),
      workDuration: this.formatDuration(roundedWorkSec, true),
      pauseDuration: this.formatDuration(pauseSec, true),
      price: (roundedWorkSec / 3600) * this.hourlyRate(),
      date: new Date().toISOString()
    };

    await this.updateIntervention({
      timeSessions: [...currentSessions, JSON.stringify(newSession)]
    });
  }

  async removeSession(session: any) {
    const updated = this.intervention().timeSessions.filter((s: any) => s !== session);
    await this.updateIntervention({ timeSessions: updated });
  }

  async addManualSession() {
    const rawSec = ((this.manualHours() || 0) * 3600) + ((this.manualMinutes() || 0) * 60);
    if (rawSec > 0) {
      const roundingSec = this.rounding() * 60;
      const roundedSec = roundingSec > 0 ? Math.ceil(rawSec / roundingSec) * roundingSec : rawSec;
      await this.addTimeSession(roundedSec, 0);
      this.manualHours.set(null); 
      this.manualMinutes.set(null);
    }
  }

  // --- PHOTOS ---

  async uploadPhoto(event: any) {
    const file = event.target.files[0];
    if (!file || !this.imageService.isValid(file)) return;
    this.uploading.set(true);
    try {
      const compressedFile = await this.imageService.compress(file);
      const photoId = ID.unique();
      await this.authService.storage.createFile(this.BUCKET_PHOTOS, photoId, compressedFile);
      const finalUrl = this.authService.storage.getFileView(this.BUCKET_PHOTOS, photoId).toString();
      const currentPhotos = this.intervention()?.photos || [];
      const photoData = JSON.stringify({ id: photoId, url: finalUrl, full: finalUrl });
      await this.updateIntervention({ photos: [...currentPhotos, photoData] });
    } catch (e) {
      alert("Erreur photo.");
    } finally {
      this.uploading.set(false);
      event.target.value = '';
    }
  }

  async removePhoto(photo: any) {
    const photoObj = this.parseJson(photo);
    const updated = this.intervention().photos.filter((p: any) => p !== photo);
    try { await this.authService.storage.deleteFile(this.BUCKET_PHOTOS, photoObj.id); } catch (e) {}
    await this.updateIntervention({ photos: updated });
  }

  // --- CALCULS & NAVIGATION ---

  getBreakdown() {
    const inter = this.intervention();
    if (!inter) return { mat: 0, time: 0, travel: 0 };
    const sessions = (inter.timeSessions || []).map((s: any) => this.parseJson(s));
    const totalSessionsPrice = sessions.reduce((acc: number, s: any) => acc + (Number(s.price) || 0), 0);
    const roundingSec = this.rounding() * 60;
    const liveWorkSec = roundingSec > 0 ? Math.ceil(this.workSeconds / roundingSec) * roundingSec : this.workSeconds;
    const livePrice = (liveWorkSec / 3600) * this.hourlyRate();
    const totalMat = this.displayedMaterials().reduce((acc: number, m: any) => acc + (Number(m.price) || 0), 0);
    const totalTravel = (inter.travelCount || 0) * this.travelFee();
    return { mat: totalMat, time: totalSessionsPrice + livePrice, travel: totalTravel };
  }

  calculateTotal() {
    const b = this.getBreakdown();
    return b.mat + b.time + b.travel;
  }

  async updateTravel(inc: number) {
    const currentCount = this.intervention()?.travelCount || 0;
    const newCount = Math.max(0, currentCount + inc);
    await this.updateIntervention({ travelCount: newCount, travelCost: newCount * this.travelFee() });
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
    } catch (e) { console.error(e); }
  }

  async pauseAndRequestVisit() {
    if (this.isRunning() || !window.confirm("Placer cette mission en attente ?")) return;
    try {
      await this.updateIntervention({ status: 'WAITING', $updatedAt: new Date().toISOString() });
      this.goBack();
    } catch (e) { alert("Erreur."); }
  }

  openGPS() {
    const rawAddr = this.intervention()?.adresse;
    if (!rawAddr) return;
    const addr = this.parseJson(rawAddr);
    const queryText = `${addr.ville || ''}, ${addr.rue || ''} ${addr.numero || ''}`.trim();
    const query = encodeURIComponent(queryText);
    let url = '';
    switch (this.gps()) {
      case 'waze': url = `https://waze.com/ul?q=${query}&navigate=yes`; break;
      case 'iphone': url = `maps://maps.apple.com/?q=${query}`; break;
      default: url = `https://www.google.com/maps/search/?api=1&query=${query}`; break;
    }
    window.open(url, '_blank');
  }

  // --- UTILS ---
  parseJson(data: any) {
    if (typeof data !== 'string') return data;
    try { return JSON.parse(data); } catch { return data; }
  }

  formatDuration(t: number, s = false): string {
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const sec = (t % 60).toString().padStart(2, '0');
    return s ? `${h}:${m}:${sec}` : `${h}:${m}`;
  }

  openLightbox(url: string) { this.selectedPhoto.set(url); }
  closeLightbox() { this.selectedPhoto.set(null); }
  goBack() { this.router.navigate(['/dashboard']); }
}