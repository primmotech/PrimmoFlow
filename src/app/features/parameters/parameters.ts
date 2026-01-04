import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-parameters',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './parameters.html',
  styleUrls: ['./parameters.scss']
})
export class Parameters implements OnInit {
  // Injections
  public authService = inject(AuthService);
  public themeService = inject(ThemeService);

  // IDs Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_PROFILES = 'user_profiles';
  private readonly COL_TEAMS = 'teams';

  // État des données
  userData = signal<any>(null);
  initialDataSnapshot = signal<string>(''); 
  
  // État de l'UI
  saving = signal(false);
  loading = signal(true);
  teamName = signal<string>('Non assigné');
  roundingOptions = [0, 5, 10, 15, 30];

  /**
   * Computed : Surveille si des changements ont été faits par rapport à la base
   * Le bouton de sauvegarde utilisera ce signal pour passer au vert (.dirty)
   */
  isDirty = computed(() => {
    if (!this.userData()) return false;
    return JSON.stringify(this.userData()) !== this.initialDataSnapshot();
  });

  async ngOnInit() {
    // Initialise le thème visuel au démarrage
    this.themeService.initTheme();
    await this.loadInitialData();
  }

  /**
   * CHARGEMENT : Lecture du profil dans Appwrite
   */
  async loadInitialData() {
    const email = this.authService.userEmail();
    if (!email) {
      this.loading.set(false);
      return;
    }

    try {
      const docId = this.authService.formatId(email);
      
      const data = await this.authService.databases.getDocument(
        this.DB_ID, 
        this.COL_PROFILES, 
        docId
      );

      if (data) {
        // On inclut themePreference pour le lier à la DB
        const profile = {
          lastname: data['lastname'] || '',
          firstname: data['firstname'] || '',
          nickName: data['nickName'] || '',
          phone: data['phone'] || '',
          role: data['role'] || 'Aucun',
          gps: data['gps'] || 'maps',
          travelCost: Number(data['travelCost'] || 0),
          hourlyRate: Number(data['hourlyRate'] || 0),
          rounding: Number(data['rounding'] || 0),
          teamId: data['teamId'] || '',
          themePreference: data['themePreference'] || 'light' 
        };

        this.userData.set(profile);
        
        // --- Synchronisation du thème visuel avec la préférence DB ---
        const isDarkTheme = profile.themePreference === 'dark';
        if (isDarkTheme !== this.themeService.darkMode()) {
          this.themeService.toggleTheme();
        }

        // Fige l'état initial pour la comparaison (isDirty)
        setTimeout(() => {
          this.initialDataSnapshot.set(JSON.stringify(this.userData()));
        }, 50);

        if (profile.teamId) {
          await this.loadTeamName(profile.teamId);
        }
      }
    } catch (error) {
      console.error("Erreur lors de la lecture du profil Appwrite :", error);
    } finally {
      this.loading.set(false);
    }
  }

  async loadTeamName(teamId: string) {
    try {
      const teamSnap = await this.authService.databases.getDocument(this.DB_ID, this.COL_TEAMS, teamId);
      this.teamName.set(teamSnap['name']);
    } catch (e) {
      this.teamName.set(teamId);
    }
  }

  /**
   * SAUVEGARDE : Mise à jour du document dans Appwrite
   */
  async saveProfile() {
    const email = this.authService.userEmail();
    if (!email || !this.isDirty() || this.saving()) return;

    this.saving.set(true);
    try {
      const docId = this.authService.formatId(email);
      
      const updatedData = {
        ...this.userData(),
        updatedAt: new Date().toISOString()
      };

      await this.authService.databases.updateDocument(
        this.DB_ID, 
        this.COL_PROFILES, 
        docId, 
        updatedData
      );

      // Réinitialise l'état "Dirty" car les données sont maintenant synchronisées
      this.initialDataSnapshot.set(JSON.stringify(this.userData()));

      // Met à jour le nickname global (utilisé dans le header)
      this.authService.userNickName.set(this.userData().nickName);
      
      //console.log("Profil Appwrite mis à jour avec succès ✅");
    } catch (error) {
      console.error("Erreur sauvegarde profil Appwrite:", error);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Appelé à chaque modification d'un champ input pour forcer la mise à jour du signal
   */
  onFieldChange() {
    const current = this.userData();
    if (current) {
      this.userData.set({ 
        ...current,
        travelCost: Number(current.travelCost),
        hourlyRate: Number(current.hourlyRate),
        rounding: Number(current.rounding)
      });
    }
  }

  /**
   * Change le thème visuellement ET met à jour le signal userData
   * pour activer le bouton de sauvegarde.
   */
  toggleTheme() {
    const current = this.userData();
    if (current) {
      // 1. Bascule l'apparence visuelle via le service
      this.themeService.toggleTheme();

      // 2. Met à jour la valeur dans le signal pour le futur saveProfile()
      const newPref = current.themePreference === 'light' ? 'dark' : 'light';
      this.userData.set({ ...current, themePreference: newPref });
    }
  }
}