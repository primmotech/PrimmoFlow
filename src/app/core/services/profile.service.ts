import { inject, Injectable, signal, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { ID } from 'appwrite';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private authService = inject(AuthService);
  
  // IDs de configuration
  private DB_ID = '694eba69001c97d55121';
  private COL_PROFILES = 'user_profiles';

  // Signal pour suivre le profil actuel
  currentUserProfile = signal<any>(null);

  constructor() {
    // On réagit dès que le signal userEmail de l'AuthService change
    effect(() => {
      const email = this.authService.userEmail();
      if (email) {
        this.checkAndCreateProfile(email);
      } else {
        this.currentUserProfile.set(null);
      }
    }, { allowSignalWrites: true });
  }

  async checkAndCreateProfile(email: string) {
    try {
      // On utilise formatId ou l'email directement si c'est ton ID de document
      // Si tu as utilisé formatId(email) pour créer le document :
      const documentId = email.replace(/[@.]/g, '_'); 

      try {
        const profile = await this.authService.databases.getDocument(
          this.DB_ID,
          this.COL_PROFILES,
          documentId
        );
        this.currentUserProfile.set(profile);
      } catch (error: any) {
        // Si le document n'existe pas (Erreur 404), on le crée
        if (error.code === 404) {
          const newProfile = {
            email: email,
            displayName: email.split('@')[0], // Nom par défaut basé sur l'email
            role: 'Aucun',
            createdAt: new Date().toISOString()
          };

          await this.authService.databases.createDocument(
            this.DB_ID,
            this.COL_PROFILES,
            documentId,
            newProfile
          );
          this.currentUserProfile.set(newProfile);
        } else {
          console.error("Erreur récupération profil:", error);
        }
      }
    } catch (err) {
      console.error("Erreur globale profil:", err);
    }
  }

  // Permet à l'admin de changer le rôle
  async updateRole(email: string, newRole: string) {
    const documentId = email.replace(/[@.]/g, '_');
    try {
      await this.authService.databases.updateDocument(
        this.DB_ID,
        this.COL_PROFILES,
        documentId,
        { role: newRole }
      );
    } catch (error) {
      console.error("Erreur mise à jour rôle:", error);
      throw error;
    }
  }
}