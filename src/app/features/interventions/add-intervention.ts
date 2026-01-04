import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ID, Query } from 'appwrite';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { SafeUrlPipe } from '../../core/pipes/safe-url.pipe';
import { PhoneFormatDirective } from '../../core/directives/phone-format.directive';

@Component({
  selector: 'app-add-intervention',
  standalone: true,
  imports: [CommonModule, FormsModule,  PhoneFormatDirective],
  templateUrl: './add-intervention.html',
  styleUrls: ['./add-intervention.scss']
})
export class AddInterventionComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);

  // État de l'UI
  loading = signal(false);
  uploading = signal(false);
  hasChanges = signal(false);
  isEditMode = signal(false);
  interventionId: string | null = null;
  
  // Données techniques
  technicians = signal<any[]>([]);
  detectedCountries = signal<Record<string, string>>({});
  phonesValid = signal<Record<string, boolean>>({});

  // Configuration Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';
  private readonly BUCKET_ID = '69502be400074c6f43f5';

  // Structure du formulaire
  tasks = signal<{ id: number, text: string, done: boolean }[]>([
    { id: Date.now(), text: '', done: false }
  ]);

  data = {
    adresse: { numero: '', rue: '', ville: '' },
    mission: { tasks: [] as any[] },
    remarques: '',
    habitants: [{ nom: '', prenom: '', tel: '' }] as any[],
    proprietaire: { nom: '', prenom: '', tel: '' },
    assigned: '',
    photos: [] as string[] // Tableau de JSON stringifiés {id, url}
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

  // --- CHARGEMENT DES DONNÉES ---

  async loadInterventionData(id: string) {
    this.loading.set(true);
    try {
      const doc = await this.auth.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
      
      this.data = {
        ...this.data,
        ...doc as any,
        adresse: this.parseJson(doc['adresse']),
        habitants: this.parseJson(doc['habitants']),
        mission: this.parseJson(doc['mission']),
        proprietaire: this.parseJson(doc['proprietaire']),
        photos: Array.isArray(doc['photos']) ? doc['photos'] : []
      };

      // Initialisation des tâches pour l'UI
      if (this.data.mission?.tasks) {
        this.tasks.set(this.data.mission.tasks.map((t: any, i: number) => ({
          id: i,
          text: t.label,
          done: t.done || false
        })));
      }
    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      this.loading.set(false);
    }
  }

  async loadTechnicians() {
    try {
      const response = await this.auth.databases.listDocuments(
        this.DB_ID, 'user_profiles', 
        [Query.limit(100), Query.equal('assignable', true)]
      );
      this.technicians.set(response.documents.map(d => ({
        email: d['email'],
        name: d['nickName'] || d['email']
      })));
    } catch (e) { console.error(e); }
  }

  // --- GESTION DES PHOTOS (UPLOAD IMMÉDIAT) ---

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.uploading.set(true);
    try {
      const compressedFile = await this.compressImage(file);
      const photoId = ID.unique();
      
      // Upload Storage
      await this.auth.storage.createFile(this.BUCKET_ID, photoId, compressedFile);
      
      // Construction de l'objet photo cohérent avec l'écran Détails
      const finalUrl = this.auth.storage.getFileView(this.BUCKET_ID, photoId).toString();
      const photoData = JSON.stringify({ id: photoId, url: finalUrl });
      
      this.data.photos = [...(this.data.photos || []), photoData];
      this.onValueChange();
    } catch (e) {
      alert("Erreur upload photo");
    } finally {
      this.uploading.set(false);
      event.target.value = '';
    }
  }

  async removePhoto(pStr: string) {
    const photoObj = this.parseJson(pStr);
    if (!confirm("Supprimer cette photo ?")) return;

    try {
      this.data.photos = this.data.photos.filter(p => p !== pStr);
      await this.auth.storage.deleteFile(this.BUCKET_ID, photoObj.id);
      this.onValueChange();
    } catch (e) { console.warn("Fichier storage déjà supprimé"); }
  }

  // --- ACTIONS FORMULAIRE ---

  async save() {
    if (!this.isFormValid()) return;
    this.loading.set(true);

    try {
      // Préparation des tâches au format objet
      const structuredTasks = this.tasks()
        .filter(t => t.text.trim() !== '')
        .map(t => ({
          label: t.text.trim(),
          done: t.done || false
        }));

      const payload = {
        ...this.data,
        adresse: JSON.stringify(this.data.adresse),
        mission: JSON.stringify({ tasks: structuredTasks }),
        habitants: JSON.stringify(this.data.habitants),
        proprietaire: JSON.stringify(this.data.proprietaire),
        photos: this.data.photos,
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
      alert("Erreur lors de l'enregistrement.");
    } finally {
      this.loading.set(false);
    }
  }

  // --- UTILS & UI ---

  onValueChange() { if (!this.hasChanges()) this.hasChanges.set(true); }

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

  addHabitant() { this.data.habitants.push({ nom: '', prenom: '', tel: '' }); this.onValueChange(); }
  
  removeHabitant(index: number) { 
    if (this.data.habitants.length > 1) { 
      this.data.habitants.splice(index, 1); 
      this.onValueChange(); 
    } 
  }

  copyToProprietaire(index: number = 0) {
    const h = this.data.habitants[index];
    if (h) {
      this.data.proprietaire = { ...h };
      this.onValueChange();
    }
  }

  isHabitantComplete(h: any) { return h && h.nom?.trim() !== '' && h.tel?.trim() !== ''; }

  isFormValid() {
    const firstTask = this.tasks()[0];
    const habitantValid = this.isHabitantComplete(this.data.habitants[0]) && this.phonesValid()['0'];
    return this.data.adresse.rue && this.data.assigned !== '' && firstTask?.text.trim() !== '' && habitantValid;
  }

  parseJson(data: any): any {
    if (typeof data !== 'string') return data;
    try { return JSON.parse(data); } catch { return data; }
  }

  onCountryFound(event: any, key: string) { this.detectedCountries.update(p => ({ ...p, [key]: event.name })); }
  setPhoneValidity(v: any, key: string) { this.phonesValid.update(p => ({ ...p, [key]: !!v })); }
  scrollToInput(e: any) { setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
  goBack() { this.router.navigate(['/dashboard']); }

  private async compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e: any) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const max = 1200;
          if (width > height && width > max) { height *= max / width; width = max; }
          else if (height > max) { width *= max / height; height = max; }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(new File([blob!], `${Date.now()}.jpg`, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.7);
        };
      };
    });
  }
}