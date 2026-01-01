import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { Router } from '@angular/router';
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
  public auth = inject(AuthService);
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

  // Filtrage des missions pour le calendrier
  allPlannedMissions = computed(() => {
    const all = this.missionStore.allPlannedMissions();
    return Array.isArray(all) ? all.filter((m: any) =>
      ['PLANNED', 'STOPPED', 'PAUSED', 'STARTED'].includes(m.status)
    ) : [];
  });

  constructor() {
    const stateData = history.state?.data;
    if (stateData) {
      const data = { ...stateData };
      // Désérialisation propre au chargement initial
      data.adresse = this.safeParse(data.adresse, { ville: '', rue: '', numero: '' });
      data.habitants = this.safeParse(data.habitants, []);
      data.mission = this.processMissionTasks(data.mission);
      this.targetIntervention.set(data);
    }
  }

  ngOnInit() {
    this.theme.initTheme();
  }

  private safeParse(data: any, fallback: any) {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return fallback;
      }
    }
    return data || fallback;
  }

  /**
   * Récupère et formate les missions pour un jour donné
   */
  getMissionsForDay(date: Date | null): any[] {
    const missions = this.allPlannedMissions();
    if (!date || !missions) return [];

    const targetDateStr = date.toDateString();

    return missions.map((m: any) => {
      const adr = this.safeParse(m.adresse, {});
      const habs = this.safeParse(m.habitants, []);

      return {
        ...m,
        displayHeure: m.scheduledTime || '--:--',
        displayVille: adr?.ville || 'Ville inconnue',
        displayRue: adr?.rue || '',
        displayNumero: adr?.numero || '',
        displayHabitant: habs.length > 0 ? habs[0].nom : 'Client'
      };
    }).filter((m: any) => {
      if (!m.plannedAt) return false;
      const mDate = new Date(m.plannedAt);
      return !isNaN(mDate.getTime()) && mDate.toDateString() === targetDateStr;
    });
  }

  /**
   * Charge une mission depuis la liste pour modification
   */
  loadMissionToEdit(mission: any) {
    this.isSubmissionComplete.set(false);

    // On force le parsing des données complexes de la DB
    const cleanedMission = {
      ...mission,
      adresse: this.safeParse(mission.adresse, {}),
      habitants: this.safeParse(mission.habitants, []),
      mission: this.processMissionTasks(mission.mission)
    };

    this.targetIntervention.set(cleanedMission);
    this.selectedHabitantIndex.set(0); // Reset sur le premier habitant

    const mDate = new Date(mission.plannedAt);
    if (!isNaN(mDate.getTime())) {
      this.selectedDate.set(mDate);
      this.viewDate.set(mDate); // Centre le calendrier sur le mois de la mission
    }

    if (mission.scheduledTime?.includes(':')) {
      const [h, m] = mission.scheduledTime.split(':').map(Number);
      this.selectedHour.set(h);
      this.selectedMinute.set(m);
      this.updateFormattedTime();
    }
  }

  /**
   * Change l'habitant affiché dans le header (cycle)
   */
  switchHabitant() {
    const intervention = this.targetIntervention();
    if (intervention?.habitants && intervention.habitants.length > 0) {
      this.selectedHabitantIndex.update(current => 
        (current + 1) % intervention.habitants.length
      );
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

  // --- Gestion du DatePicker / Horloge ---

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

  selectDate(date: Date | null) {
    if (date && !this.isPast(date)) this.selectedDate.set(date);
  }

  isPast(date: Date | null): boolean {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isSelected(date: Date | null) {
    return date?.toDateString() === this.selectedDate().toDateString();
  }

  isToday(date: Date | null) {
    return date?.toDateString() === new Date().toDateString();
  }

  changeMonth(delta: number) {
    const next = new Date(this.viewDate());
    next.setMonth(next.getMonth() + delta);
    this.viewDate.set(next);
  }

  cancelTimeSelection() {
    this.showTimePicker.set(false);
    this.pickingMinutes.set(false);
  }

  confirmPlanning() {
    this.showTimePicker.set(true);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

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

  private processMissionTasks(missionData: any): any[] {
    if (!missionData) return [];
    if (Array.isArray(missionData)) {
      return missionData.map(item => {
        if (typeof item === 'object' && item !== null) return item;
        return { label: String(item).trim(), done: false };
      }).filter(item => item.label.length > 0);
    }
    if (typeof missionData === 'string') {
      return missionData
        .split(/\n|,|;/)
        .map(t => ({ label: t.trim(), done: false }))
        .filter(t => t.label.length > 0);
    }
    return [];
  }
}