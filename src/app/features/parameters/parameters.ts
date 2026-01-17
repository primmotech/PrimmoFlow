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

  // Palette de 20 couleurs pour les bordures et éléments personnalisés
  colorPalette: string[] = [
    '#49dd6b', '#1ddbe9ff', '#e74c3c', '#f1c40f', '#9b59b6', 
    '#1abc9c', '#e67e22', '#34495e', '#27ae60', '#2980b9',
    '#8e44ad', '#16a085', '#f39c12', '#d35400', '#c0392b',
    '#e90cb9ff', '#ff4757', '#2f3542', '#70a1ff', '#5352ed'
  ];

  /**
   * Computed : Surveille si des changements ont été faits par rapport à la base
   */
  isDirty = computed(() => {
    if (!this.userData()) return false;
    return JSON.stringify(this.userData()) !== this.initialDataSnapshot();
  });

  async ngOnInit() {
    this.themeService.initTheme();
    await this.loadInitialData();
  }

  /**
   * Applique la variable CSS au document pour l'aperçu immédiat
   */
  private applyCustomColor(color: string) {
    document.documentElement.style.setProperty('--user-custom-color', color);
  }
/**
   * Sélection d'une couleur dans la palette
   */
  selectColor(color: string) {
    const current = this.userData();
    if (current && this.authService.hasPerm('param_edit_theme')) {
      // 1. Mise à jour de l'objet local pour Appwrite
      this.userData.set({ ...current, customColor: color });
      
      // 2. Notification immédiate au ThemeService (pour le Dashboard)
      this.themeService.setUserColor(color); 
      
      // 3. Mise à jour visuelle locale
      this.onFieldChange();
    }
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
        const profile = {
          lastname: data['lastname'] || '',
          firstname: data['firstname'] || '',
          nickName: data['nickName'] || '',
              phone: data['phone'] || '',
          role: data['role'] || 'Utilisateur',
          gps: data['gps'] || 'maps',
          travelCost: Number(data['travelCost'] || 0),
          hourlyRate: Number(data['hourlyRate'] || 0),
          rounding: Number(data['rounding'] || 0),
          teamId: data['teamId'] || '',
          themePreference: data['themePreference'] || 'light',
          customColor: data['customColor'] || '#49dd6b' // Couleur par défaut si absente
        };

        this.userData.set(profile);
        this.themeService.setUserColor(profile.customColor);
        // Appliquer la couleur et le thème au chargement
        this.applyCustomColor(profile.customColor);
        const isDarkTheme = profile.themePreference === 'dark';
        if (isDarkTheme !== this.themeService.darkMode()) {
          this.themeService.toggleTheme();
        }

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
// Exemple de fonction appelée par ton input color ou ton bouton de sauvegarde
onColorChange(newColor: string) {
  this.themeService.setUserColor(newColor);
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

      this.initialDataSnapshot.set(JSON.stringify(this.userData()));
      this.authService.userNickName.set(this.userData().nickName);
      
    } catch (error) {
      console.error("Erreur sauvegarde profil Appwrite:", error);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Appelé à chaque modification d'un champ ou d'une couleur
   */
  onFieldChange() {
    const current = this.userData();
    if (current) {
      // Appliquer la couleur visuellement en temps réel
      this.applyCustomColor(current.customColor);

      this.userData.set({ 
        ...current,
        travelCost: Number(current.travelCost),
        hourlyRate: Number(current.hourlyRate),
        rounding: Number(current.rounding)
      });
    }
  }



  /**
   * Bascule le thème
   */
  toggleTheme() {
    const current = this.userData();
    if (current) {
      this.themeService.toggleTheme();
      const newPref = current.themePreference === 'light' ? 'dark' : 'light';
      this.userData.set({ ...current, themePreference: newPref });
    }
  }
}