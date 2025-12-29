import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { Router } from '@angular/router';
// Remplacement Firestore par Appwrite
import { ID } from 'appwrite'; 
import { ThemeService } from '../../core/services/theme';
import { MissionStore } from '../../core/services/missions';
import { AuthService } from '../../core/services/auth.service';

registerLocaleData(localeFr);

@Component({
  selector: 'app-planning',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planning.html',
  styleUrl: './planning.scss'
})
export class Planning implements OnInit {
  private router = inject(Router);
  public auth = inject(AuthService); // Ton service centralisé Appwrite
  public theme = inject(ThemeService);
  private missionStore = inject(MissionStore); 
  
  Math = Math;
  targetIntervention = signal<any>(null);
  selectedDate = signal<Date>(new Date());
  viewDate = signal<Date>(new Date()); 
  selectedTime = signal<string>('08:00');
  selectedHabitantIndex = signal<number>(0);
  
  showTimePicker = signal<boolean>(false);
  pickingMinutes = signal<boolean>(false);
  selectedHour = signal<number>(8);
  selectedMinute = signal<number>(0);
  isSubmitting = signal<boolean>(false);
  isSubmissionComplete = signal<boolean>(false);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  allPlannedMissions = computed(() => {
    const all = this.missionStore.allPlannedMissions(); 
    return Array.isArray(all) ? all.filter((m: any) => 
      ['PLANNED', 'STOPPED', 'PAUSED', 'STARTED'].includes(m.status)
    ) : [];
  });

  constructor() {
    const stateData = history.state?.data;
    if (stateData) {
      // On s'assure que les données sont désérialisées (au cas où elles viennent d'Appwrite)
      const data = { ...stateData };
      const adresse = typeof data.adresse === 'string' ? JSON.parse(data.adresse) : (data.adresse || {});
      const habitants = typeof data.habitants === 'string' ? JSON.parse(data.habitants) : (data.habitants || []);
      
      data.adresse = {
        ville: adresse.ville || '',
        rue: adresse.rue || '',
        numero: adresse.numero || ''
      };
      data.habitants = habitants;
      this.targetIntervention.set(data);
    }
  }

  ngOnInit() {
    this.theme.initTheme();
  }

  getMissionsForDay(date: Date | null): any[] {
    const missions = this.allPlannedMissions();
    if (!date || !missions) return [];
    
    const targetDateStr = date.toDateString();
    
    return missions.map((m: any) => {
      // Désérialisation pour l'affichage si c'est du string
      const adr = typeof m.adresse === 'string' ? JSON.parse(m.adresse) : m.adresse;
      const habs = typeof m.habitants === 'string' ? JSON.parse(m.habitants) : m.habitants;

      return {
        ...m,
        displayHeure: m.scheduledTime || '--:--', 
        displayVille: adr?.ville || 'Ville inconnue',
        displayRue: adr?.rue || '',
        displayNumero: adr?.numero || '',
        displayHabitant: habs ? habs[0]?.nom : 'Client'
      };
    }).filter((m: any) => {
      const rawDate = m.plannedAt;
      if (!rawDate) return false;
      const mDate = new Date(rawDate);
      return !isNaN(mDate.getTime()) && mDate.toDateString() === targetDateStr;
    });
  }

  loadMissionToEdit(mission: any) {
    this.isSubmissionComplete.set(false);
    this.targetIntervention.set(mission);

    const mDate = new Date(mission.plannedAt);
    this.selectedDate.set(mDate);
    
    if (mission.scheduledTime?.includes(':')) {
      const [h, m] = mission.scheduledTime.split(':').map(Number);
      this.selectedHour.set(h);
      this.selectedMinute.set(m);
      this.updateFormattedTime();
    }
  }

  async finalValidation() {
    this.showTimePicker.set(false);
    await this.submitToDatabase();
  }

  async submitToDatabase() {
    if (this.isSubmitting()) return;
    const current = this.targetIntervention();
    if (!current?.id) return;

    this.isSubmitting.set(true);
    try {
      const finalDate = new Date(this.selectedDate());
      finalDate.setHours(this.selectedHour(), this.selectedMinute(), 0);

      // Préparation payload Appwrite (On garde la cohérence JSON string si nécessaire)
      await this.auth.databases.updateDocument(
        this.DB_ID, 
        this.COL_INTERVENTIONS, 
        current.id, 
        {
          status: 'PLANNED',
          plannedAt: finalDate.toISOString(),
          scheduledTime: this.selectedTime(),
          $updatedAt: new Date().toISOString()
        }
      );

      this.isSubmissionComplete.set(true);
    } catch (e) {
      console.error("Appwrite Update Error:", e);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // --- LOGIQUE UI (Identique) ---
  updateClock(event: MouseEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left - 140; 
    const y = event.clientY - rect.top - 140;
    const dist = Math.sqrt(x * x + y * y);
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;

    if (!this.pickingMinutes()) {
      let hour = Math.round(angle / 30) % 12;
      if (hour === 0) hour = 12;
      if (dist < 95) hour = (hour === 12) ? 0 : hour + 12;
      this.selectedHour.set(hour);
      setTimeout(() => this.pickingMinutes.set(true), 300);
    } else {
      let rawMin = Math.round(angle / 6) % 60;
      let snappedMin = Math.round(rawMin / 5) * 5;
      if (snappedMin === 60) snappedMin = 0;
      this.selectedMinute.set(snappedMin);
    }
    this.updateFormattedTime();
  }

  updateFormattedTime() {
    const h = this.selectedHour().toString().padStart(2, '0');
    const m = this.selectedMinute().toString().padStart(2, '0');
    this.selectedTime.set(`${h}:${m}`);
  }

  selectDate(date: Date | null) { if (date && !this.isPast(date)) this.selectedDate.set(date); }
  isPast(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return date < today;
  }
  isSelected(date: Date | null) { return date?.toDateString() === this.selectedDate().toDateString(); }
  isToday(date: Date | null) { return date?.toDateString() === new Date().toDateString(); }
  changeMonth(delta: number) {
    const next = new Date(this.viewDate());
    next.setMonth(next.getMonth() + delta);
    this.viewDate.set(next);
  }
  switchHabitant() {
    const intervention = this.targetIntervention();
    if (intervention?.habitants) {
      this.selectedHabitantIndex.update(current => (current + 1) % intervention.habitants.length);
    }
  }
  cancelTimeSelection() { this.showTimePicker.set(false); this.pickingMinutes.set(false); }
  confirmPlanning() { this.showTimePicker.set(true); }
  goBack() { this.router.navigate(['/dashboard']); }

  daysInMonth = computed(() => {
    const date = this.viewDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const calendar = [];
    for (let i = 0; i < offset; i++) calendar.push(null);
    for (let i = 1; i <= days; i++) calendar.push(new Date(year, month, i));
    return calendar;
  });
}