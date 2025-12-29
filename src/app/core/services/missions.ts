import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Query } from 'appwrite';

@Injectable({ providedIn: 'root' })
export class MissionStore {
  private auth = inject(AuthService);

  // Signal global consommé par le Planning
  public allPlannedMissions = signal<any[]>([]);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  constructor() {
    this.initSync();
  }

  /**
   * Nettoyage des données Appwrite (JSON string -> Object)
   */
  private sanitize(doc: any) {
    return {
      ...doc,
      id: doc.$id,
      // Conversion des strings JSON en objets pour le template HTML
      adresse: typeof doc.adresse === 'string' ? JSON.parse(doc.adresse) : doc.adresse,
      habitants: typeof doc.habitants === 'string' ? JSON.parse(doc.habitants) : doc.habitants,
      mission: typeof doc.mission === 'string' ? JSON.parse(doc.mission) : doc.mission,
      // Conversion des dates
      plannedAt: doc.plannedAt ? new Date(doc.plannedAt) : null,
      createdAt: doc.createdAt ? new Date(doc.createdAt) : null
    };
  }

  /**
   * Chargement initial et écoute en temps réel
   */
  private async initSync() {
    // 1. Chargement initial (équivalent du premier Snapshot)
    try {
      const res = await this.auth.databases.listDocuments(
        this.DB_ID,
        this.COL_INTERVENTIONS,
        [Query.limit(100)]
      );
      const cleanMissions = res.documents.map(d => this.sanitize(d));
      this.allPlannedMissions.set(cleanMissions);
    } catch (e) {
      console.error("Initial load error:", e);
    }

    // 2. Realtime Appwrite
    this.auth.client.subscribe(
      `databases.${this.DB_ID}.collections.${this.COL_INTERVENTIONS}.documents`,
      (response) => {
        const payload = response.payload as any;
        const eventType = response.events[0];

        if (eventType.includes('.update') || eventType.includes('.create')) {
          const cleanDoc = this.sanitize(payload);
          this.allPlannedMissions.update(list => {
            const filtered = list.filter(m => m.id !== cleanDoc.id);
            return [...filtered, cleanDoc];
          });
        } else if (eventType.includes('.delete')) {
          this.allPlannedMissions.update(list => list.filter(m => m.id !== payload.$id));
        }
      }
    );
  }

  /**
   * Mise à jour d'une mission (ex: depuis le planning)
   */
  async saveMission(updatedData: any) {
    if (!updatedData.id) return;

    try {
      // On prépare les données pour Appwrite (objets -> strings)
      const payload = {
        ...updatedData,
        adresse: JSON.stringify(updatedData.adresse),
        habitants: JSON.stringify(updatedData.habitants),
        mission: JSON.stringify(updatedData.mission),
        updatedAt: new Date().toISOString()
      };
      
      // On retire l'ID du corps de l'update pour Appwrite
      delete (payload as any).id;
      delete (payload as any).$id;
      delete (payload as any).$collectionId;
      delete (payload as any).$databaseId;

      await this.auth.databases.updateDocument(
        this.DB_ID,
        this.COL_INTERVENTIONS,
        updatedData.id,
        payload
      );
      
      console.log("Mission updated in Appwrite:", updatedData.id);
    } catch (error) {
      console.error("Error updating mission:", error);
    }
  }
}