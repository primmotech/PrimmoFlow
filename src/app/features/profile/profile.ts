import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit {
  public authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);

  // Signaux pour l'état de l'interface
  userData = signal<any>(null);
  isDirty = signal(false);
  saving = signal(false);
  
  // Données de référence pour la comparaison (isDirty)
  private initialUserData: string = "";

  // Options de configuration
  roundingOptions: number[] = Array.from({ length: 13 }, (_, i) => i * 5);
  
  // Palette de 20 couleurs pour les bordures et textes spécifiques
  colorPalette: string[] = [
    '#49dd6b', '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', 
    '#1abc9c', '#e67e22', '#34495e', '#27ae60', '#2980b9',
    '#8e44ad', '#16a085', '#f39c12', '#d35400', '#c0392b',
    '#7f8c8d', '#ff4757', '#2f3542', '#70a1ff', '#5352ed'
  ];

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.email && !this.userData()) {
        this.loadProfile(user.email);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {}

  /**
   * Applique la variable CSS pour l'aperçu immédiat
   */
  private applyCustomColor(color: string) {
    document.documentElement.style.setProperty('--user-custom-color', color);
  }

  async loadProfile(email: string) {
    try {
      const profileData = await this.authService.getUserProfile(email);
      
      const defaultData = {
        nickName: this.authService.userNickName() || email.split('@')[0],
        lastname: '',
        firstname: '',
        customColor: '#49dd6b', // Vert par défaut
        phone: '',
        travelCost: 12,
        hourlyRate: 28,
        gps: 'maps',
        rounding: 15,
        themePreference: 'dark'
      };

      const data = profileData ? { ...defaultData, ...profileData } : defaultData;
      
      this.userData.set(structuredClone(data));
      this.initialUserData = JSON.stringify(data);
      
      // Applique les préférences visuelles au chargement
      this.themeService.initTheme(data.themePreference);
      this.applyCustomColor(data.customColor);

    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  }

  onFieldChange() {
    const current = this.userData();
    if (!current) return;

    // 1. Mise à jour visuelle du thème en temps réel
    const activeTheme = this.themeService.darkMode() ? 'dark' : 'light';
    if (current.themePreference !== activeTheme) {
      this.themeService.setThemePreference(current.themePreference);
    }

    // 2. Mise à jour visuelle de la couleur personnalisée en temps réel (aperçu)
    this.applyCustomColor(current.customColor);

    // 3. Comparaison avec l'état initial
    const hasChanged = JSON.stringify(current) !== this.initialUserData;
    this.isDirty.set(hasChanged);
  }

  async saveProfile() {
    const currentData = this.userData();
    const email = this.authService.userEmail();

    if (currentData && email) {
      this.saving.set(true);
      try {
        // Envoie toutes les données (incluant customColor) à Appwrite
        await this.authService.updateUserProfile(email, currentData);
        
        this.initialUserData = JSON.stringify(currentData);
        this.isDirty.set(false);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde :', error);
      } finally {
        this.saving.set(false);
      }
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}