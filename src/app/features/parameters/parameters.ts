import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; // Utilise ton nouveau service Appwrite
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

  // IDs Appwrite (à vérifier dans ta console)
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
   * CHARGEMENT : Lecture du profil dans Appwrite
   */
  async loadInitialData() {
    const email = this.authService.userEmail();
    if (!email) {
      this.loading.set(false);
      return;
    }

    try {
      // Utilisation du formatId pour matcher l'ID du document
      const docId = this.authService.formatId(email);
      
      const data = await this.authService.databases.getDocument(
        this.DB_ID, 
        this.COL_PROFILES, 
        docId
      );

      if (data) {
        // Mapping propre des données Appwrite vers notre objet local
        const profile = {
          lastname: data['lastname'] || '',
          firstname: data['firstname'] || '',
          nickName: data['nickName'] || '',
          phone: data['phone'] || '',
          role: data['role'] || 'Technicien',
          gps: data['gps'] || 'maps',
          travelCost: Number(data['travelCost'] || 0),
          hourlyRate: Number(data['hourlyRate'] || 0),
          rounding: Number(data['rounding'] || 0),
          teamId: data['teamId'] || ''
        };

        this.userData.set(profile);
        
        // On attend que le signal soit propagé pour figer l'état initial
        setTimeout(() => {
          this.initialDataSnapshot.set(JSON.stringify(this.userData()));
        }, 50);

        if (profile.teamId) {
          await this.loadTeamName(profile.teamId);
        }
      }
    } catch (error) {
      console.error("Erreur lors de la lecture du profil Appwrite :", error);
      // Si 404 : Le document n'existe pas encore pour cet ID
      // Si 401/403 : Problème de permissions dans l'onglet Settings
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
   * SAUVEGARDE : Mise à jour du document
   */
  async saveProfile() {
    const email = this.authService.userEmail();
    if (!email || !this.isDirty() || this.saving()) return;

    this.saving.set(true);
    try {
      const docId = this.authService.formatId(email);
      
      const updatedData = {
        ...this.userData(),
        updatedAt: new Date().toISOString() // Appwrite préfère l'ISO String pour les dates
      };

      // Update dans Appwrite
      await this.authService.databases.updateDocument(
        this.DB_ID, 
        this.COL_PROFILES, 
        docId, 
        updatedData
      );

      // Rafraîchir le snapshot pour désactiver le bouton Save
      this.initialDataSnapshot.set(JSON.stringify(this.userData()));

      // Mettre à jour le signal global pour le Header
      this.authService.userNickName.set(this.userData().nickName);
      
      console.log("Profil Appwrite mis à jour avec succès ✅");
    } catch (error) {
      console.error("Erreur sauvegarde profil Appwrite:", error);
      alert("Erreur lors de la sauvegarde. Vérifiez les permissions de la collection.");
    } finally {
      this.saving.set(false);
    }
  }

  onFieldChange() {
    const current = this.userData();
    if (current) {
      current.travelCost = Number(current.travelCost);
      current.hourlyRate = Number(current.hourlyRate);
      current.rounding = Number(current.rounding);
      this.userData.set({ ...current });
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}