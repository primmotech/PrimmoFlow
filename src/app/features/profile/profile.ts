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
  roundingOptions: number[] = Array.from({ length: 13 }, (_, i) => i * 5); // 0 à 60 par pas de 5
  themeOptions = [
    { label: 'Clair', value: 'light' }, 
    { label: 'Sombre', value: 'dark' }
  ];

  constructor() {
    /**
     * Surveille le signal currentUser.
     * Si l'utilisateur est chargé et que userData est vide, on charge le profil.
     */
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.email && !this.userData()) {
        this.loadProfile(user.email);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {}

  /**
   * Récupère les données depuis Firestore (user_profiles)
   */
  async loadProfile(email: string) {
    try {
      const profileData = await this.authService.getUserProfile(email);
      
      // Valeurs par défaut si le profil est incomplet
      const defaultData = {
        nickName: this.authService.userNickName() || email.split('@')[0],
        lastname: '',
        firstname: '',
        phone: '',
        travelCost: 12,
        hourlyRate: 28,
        gps: 'maps',
        rounding: 15,
        themePreference: 'dark'
      };

      const data = profileData ? { ...defaultData, ...profileData } : defaultData;
      
      this.userData.set(structuredClone(data));
      // On stocke une version stringifiée pour comparer facilement les changements
      this.initialUserData = JSON.stringify(data);
      
      // Applique le thème stocké
      this.themeService.initTheme(data.themePreference);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
    }
  }

  /**
   * Détecte si des modifications ont été apportées au formulaire
   */
  onFieldChange() {
    const current = this.userData();
    if (!current) return;

    // Mise à jour visuelle du thème en temps réel lors du changement de toggle/select
    const activeTheme = this.themeService.darkMode() ? 'dark' : 'light';
    if (current.themePreference !== activeTheme) {
      this.themeService.setThemePreference(current.themePreference);
    }

    // Comparaison avec l'état initial
    const hasChanged = JSON.stringify(current) !== this.initialUserData;
    this.isDirty.set(hasChanged);
  }

  /**
   * Sauvegarde les données dans Firestore et met à jour les signaux globaux
   */
  async saveProfile() {
    const currentData = this.userData();
    const email = this.authService.userEmail();

    if (currentData && email) {
      this.saving.set(true);
      try {
        // 1. Mise à jour Firestore (via AuthService qui mettra aussi à jour le signal nickName)
        await this.authService.updateUserProfile(email, currentData);
        
        // 2. On fige le nouvel état comme état de référence
        this.initialUserData = JSON.stringify(currentData);
        this.isDirty.set(false);
        
        console.log('Profil mis à jour avec succès');
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