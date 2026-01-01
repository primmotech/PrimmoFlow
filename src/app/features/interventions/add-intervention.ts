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
  
  // Structure simplifiée : on initialise avec une tâche vide
  tasks = signal<{ id: number, text: string, done: boolean }[]>([
    { id: Date.now(), text: '', done: false }
  ]);

  photosToUpload: File[] = [];
  existingPhotoIds: string[] = [];

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_ID = '69502be400074c6f43f5';

  data = {
    adresse: { numero: '', rue: '', ville: '' },
    mission: { tasks: [] as any[] }, // On ne garde que le tableau
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
      
      const parsedMission = typeof doc['mission'] === 'string' ? JSON.parse(doc['mission']) : doc['mission'];

      this.data = {
        ...this.data,
        ...doc as any,
        adresse: typeof doc['adresse'] === 'string' ? JSON.parse(doc['adresse']) : doc['adresse'],
        habitants: typeof doc['habitants'] === 'string' ? JSON.parse(doc['habitants']) : doc['habitants'],
        mission: parsedMission,
        proprietaire: typeof doc['proprietaire'] === 'string' ? JSON.parse(doc['proprietaire']) : doc['proprietaire']
      };

      if (doc['photos']) {
        this.existingPhotoIds = Array.isArray(doc['photos']) ? doc['photos'] : JSON.parse(doc['photos']);
      }

      // --- LECTURE DU FORMAT UNIQUE (OBJETS) ---
      if (this.data.mission?.tasks) {
        this.tasks.set(this.data.mission.tasks.map((t: any, i: number) => ({
          id: i,
          text: t.label,
          done: t.done || false
        })));
      }

    } catch (e) {
      console.error("Erreur chargement:", e);
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

  // --- Gestion Tâches UI ---
  addTask() { 
    this.tasks.update(t => [...t, { id: Date.now(), text: '', done: false }]); 
    this.onValueChange(); 
  }
  
  removeTask(index: number) { 
    this.tasks.update(t => t.filter((_, i) => i !== index)); 
    this.onValueChange(); 
  }
  
  updateTask(index: number, value: string) {
    this.onValueChange();
    this.tasks.update(t => { 
      const newTasks = [...t];
      newTasks[index] = { ...newTasks[index], text: value };
      return newTasks;
    });
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
    return this.auth.storage.getFileView(this.BUCKET_ID, photoId).toString();
  }

  onValueChange() { if (!this.hasChanges()) this.hasChanges.set(true); }

  copyToProprietaire(index: number = 0) {
    const habitant = this.data.habitants[index];
    if (habitant) {
      this.data.proprietaire = { ...habitant };
      this.onValueChange();
    }
  }

  addHabitant() { this.data.habitants.push({ nom: '', prenom: '', tel: '' }); this.onValueChange(); }
  removeHabitant(index: number) { if (this.data.habitants.length > 1) { this.data.habitants.splice(index, 1); this.onValueChange(); } }

  isHabitantComplete(h: any) { return h && h.nom?.trim() !== '' && h.tel?.trim() !== ''; }
  
  isFormValid() {
    const firstTask = this.tasks()[0];
    return this.data.adresse.rue && 
           this.data.assigned !== '' && 
           firstTask && firstTask.text.trim() !== '' && 
           this.isHabitantComplete(this.data.habitants[0]);
  }

  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          }, 'image/jpeg', 0.7);
        };
      };
    });
  }

  async save() {
    if (!this.isFormValid()) return;
    this.loading.set(true);

    try {
      const uploadedPhotoIds: string[] = [];
      for (const photoFile of this.photosToUpload) {
        const compressedFile = await this.compressImage(photoFile);
        const file = await this.auth.storage.createFile(this.BUCKET_ID, ID.unique(), compressedFile);
        uploadedPhotoIds.push(file.$id);
      }

      const finalPhotoIds = [...this.existingPhotoIds, ...uploadedPhotoIds];

      // --- SAUVEGARDE FORMAT UNIQUE ---
      const structuredTasks = this.tasks()
        .map(t => t.text.trim())
        .filter(t => t !== '')
        .map(text => {
          const existingTask = this.data.mission?.tasks?.find((oldT: any) => oldT.label === text);
          return {
            label: text,
            done: existingTask ? existingTask.done : false
          };
        });

      const payload = {
        ...this.data,
        adresse: JSON.stringify(this.data.adresse),
        mission: JSON.stringify({
          tasks: structuredTasks
        }),
        habitants: JSON.stringify(this.data.habitants),
        proprietaire: JSON.stringify(this.data.proprietaire),
        photos: finalPhotoIds,
        $updatedAt: new Date().toISOString()
      };

      if (this.isEditMode() && this.interventionId) {
        await this.auth.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, this.interventionId, payload);
      } else {
        const createPayload = {
          ...payload,
          createdBy: this.auth.userEmail(),
          status: 'OPEN',
          $createdAt: new Date().toISOString()
        };
        await this.auth.databases.createDocument(this.DB_ID, this.COL_INTERVENTIONS, ID.unique(), createPayload);
      }

      this.hasChanges.set(false);
      this.router.navigate(['/dashboard']);

    } catch (e) {
      console.error("Erreur sauvegarde:", e);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      this.loading.set(false);
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
}