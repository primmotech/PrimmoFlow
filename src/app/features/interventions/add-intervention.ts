import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ID, Query } from 'appwrite';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { SafeUrlPipe } from '../../core/pipes/safe-url.pipe';

@Component({
  selector: 'app-add-intervention',
  standalone: true,
  imports: [CommonModule, FormsModule, SafeUrlPipe],
  templateUrl: './add-intervention.html',
  styleUrls: ['./add-intervention.scss']
})
export class AddInterventionComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);

  loading = signal(false);
  hasChanges = signal(false);
  isEditMode = signal(false);
  interventionId: string | null = null;
  technicians = signal<any[]>([]);
  tasks = signal<{ id: number, text: string }[]>([{ id: Date.now(), text: '' }]);

  // Gestion des photos (Tableaux simples)
  photosToUpload: File[] = [];
  existingPhotoIds: string[] = [];

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_ID = '69502be400074c6f43f5';

  data = {
    adresse: { numero: '', rue: '', ville: '' },
    mission: { description: '' },
    remarques: '',
    habitants: [{ nom: '', prenom: '', tel: '' }] as any[],
    proprietaire: { nom: '', prenom: '', tel: '' },
    assigned: '',
  };

  async ngOnInit() {
    this.themeService.initTheme();
    this.loadTechnicians();
    this.interventionId = this.route.snapshot.paramMap.get('id');

    if (this.interventionId) {
      this.isEditMode.set(true);
      await this.loadInterventionData(this.interventionId);
    } else {
      this.data.assigned = this.auth.userEmail() || '';
    }
  }

async loadInterventionData(id: string) {
  this.loading.set(true);
  try {
    const doc = await this.auth.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
    console.log("Document brut reçu d'Appwrite:", doc);

    // On crée un nouvel objet proprement pour déclencher la réactivité d'Angular
    const updatedData = {
      ...this.data, // On garde la structure initiale
      ...doc as any, // On injecte les données d'Appwrite
      // On parse chaque champ complexe en vérifiant s'il est déjà un objet ou une string
      adresse: typeof doc['adresse'] === 'string' ? JSON.parse(doc['adresse']) : doc['adresse'],
      habitants: typeof doc['habitants'] === 'string' ? JSON.parse(doc['habitants']) : doc['habitants'],
      mission: typeof doc['mission'] === 'string' ? JSON.parse(doc['mission']) : doc['mission'],
      proprietaire: typeof doc['proprietaire'] === 'string' ? JSON.parse(doc['proprietaire']) : doc['proprietaire']
    };

    // On assigne l'objet complet d'un coup
    this.data = updatedData;

    // GESTION DES PHOTOS : on les met dans le tableau dédié
    if (doc['photos']) {
      // Si c'est un Array Appwrite, c'est déjà un tableau. Si c'est stocké en string, on parse.
      this.existingPhotoIds = Array.isArray(doc['photos']) 
        ? doc['photos'] 
        : JSON.parse(doc['photos']);
    }

    // MISE À JOUR DES TÂCHES (UI)
    if (this.data.mission?.description) {
      const lines = this.data.mission.description.split('\n');
      this.tasks.set(lines.map((text: string, i: number) => ({ id: i, text })));
    }

    console.log("Données après parsing :", this.data);
    console.log("Photos détectées :", this.existingPhotoIds);

  } catch (e) {
    console.error("Erreur fatale lors du chargement Appwrite:", e);
    alert("Impossible de charger l'intervention.");
  } finally {
    this.loading.set(false);
  }
}

  async loadTechnicians() {
    try {
      const response = await this.auth.databases.listDocuments(this.DB_ID, 'user_profiles', [Query.limit(100)]);
      this.technicians.set(response.documents.map(d => ({
        email: d['email'],
        name: d['nickName'] || d['email']
      })));
    } catch (e) { console.error(e); }
  }

  // --- Photos ---
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.photosToUpload.push(...Array.from(input.files));
      this.onValueChange();
    }
  }

  removePhotoToUpload(index: number) {
    this.photosToUpload.splice(index, 1);
    this.onValueChange();
  }

  removeExistingPhoto(photoId: string) {
    if (confirm("Supprimer cette photo ?")) {
      this.existingPhotoIds = this.existingPhotoIds.filter(id => id !== photoId);
      this.onValueChange();
    }
  }



getPhotoPreviewUrl(photoId: string): string {
  // On utilise getFileView au lieu de getFilePreview
  // Cette méthode ne fait aucune transformation, donc elle n'est pas bloquée
  const url = this.auth.storage.getFileView(this.BUCKET_ID, photoId);
  return url.toString(); 
}

  // --- Logique Métier ---
  onValueChange() { if (!this.hasChanges()) this.hasChanges.set(true); }

  copyToProprietaire(index: number = 0) {
    const habitant = this.data.habitants[index];
    if (habitant) {
      this.data.proprietaire = { ...habitant };
      this.onValueChange();
    }
  }

  addTask() { this.tasks.update(t => [...t, { id: Date.now(), text: '' }]); this.onValueChange(); }
  removeTask(index: number) { this.tasks.update(t => t.filter((_, i) => i !== index)); this.onValueChange(); }
  updateTask(index: number, value: string) {
    this.onValueChange();
    this.tasks.update(t => { t[index].text = value; return [...t]; });
  }

  addHabitant() { this.data.habitants.push({ nom: '', prenom: '', tel: '' }); this.onValueChange(); }
  removeHabitant(index: number) { if (this.data.habitants.length > 1) { this.data.habitants.splice(index, 1); this.onValueChange(); } }

  isHabitantComplete(h: any) { return h && h.nom?.trim() !== '' && h.tel?.trim() !== ''; }
  isFormValid() {
    return this.data.adresse.rue && this.data.assigned !== '' && 
           this.tasks()[0].text.trim() !== '' && this.isHabitantComplete(this.data.habitants[0]);
  }

// --- MÉTHODE DE COMPRESSION (CÔTÉ CLIENT) ---
  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Largeur max pour conserver une bonne qualité
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          // Calcul des proportions
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              // On recrée le fichier compressé en JPEG
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          }, 'image/jpeg', 0.7); // 70% de qualité : le compromis idéal poids/rendu
        };
      };
    });
  }

  // --- MÉTHODE DE SAUVEGARDE COMPLÈTE ---
  async save() {
    if (!this.isFormValid()) return;
    this.loading.set(true);

    try {
      // 1. Upload des nouvelles photos avec compression préalable
      const uploadedPhotoIds: string[] = [];
      for (const photoFile of this.photosToUpload) {
        try {
          // Compression avant l'upload pour contourner les restrictions du plan Appwrite
          const compressedFile = await this.compressImage(photoFile);
          
          const file = await this.auth.storage.createFile(
            this.BUCKET_ID, 
            ID.unique(), 
            compressedFile
          );
          uploadedPhotoIds.push(file.$id);
        } catch (uploadError) {
          console.error("Erreur sur une photo précise:", uploadError);
          // Optionnel: On peut décider de continuer ou d'arrêter ici
        }
      }

      // 2. Fusion des tableaux d'IDs (existants + nouveaux)
      const finalPhotoIds = [...this.existingPhotoIds, ...uploadedPhotoIds];

      // 3. Préparation des données textuelles
      this.data.mission.description = this.tasks()
        .map(t => t.text.trim())
        .filter(t => t)
        .join('\n');

      // 4. Construction du Payload
      // Rappel : adresse, mission, habitants et proprietaire sont stockés en JSON string [cite: 2025-12-26]
      const payload = {
        ...this.data,
        adresse: JSON.stringify(this.data.adresse),
        mission: JSON.stringify(this.data.mission),
        habitants: JSON.stringify(this.data.habitants),
        proprietaire: JSON.stringify(this.data.proprietaire),
        photos: finalPhotoIds, // Array natif Appwrite (PAS de stringify ici)
        $updatedAt: new Date().toISOString()
      };

      // 5. Enregistrement en base de données
      if (this.isEditMode() && this.interventionId) {
        // Mode ÉDITION
        await this.auth.databases.updateDocument(
          this.DB_ID, 
          this.COL_INTERVENTIONS, 
          this.interventionId, 
          payload
        );
      } else {
        // Mode CRÉATION
        const createPayload = {
          ...payload,
          createdBy: this.auth.userEmail(),
          status: 'OPEN',
          $createdAt: new Date().toISOString()
        };
        await this.auth.databases.createDocument(
          this.DB_ID, 
          this.COL_INTERVENTIONS, 
          ID.unique(), 
          createPayload
        );
      }

      // 6. Finalisation
      this.hasChanges.set(false);
      this.router.navigate(['/dashboard']);

    } catch (e) {
      console.error("Erreur générale sauvegarde Appwrite:", e);
      alert("Une erreur est survenue lors de l'enregistrement de l'intervention.");
    } finally {
      this.loading.set(false);
    }
  }


  goBack() { this.router.navigate(['/dashboard']); }


}