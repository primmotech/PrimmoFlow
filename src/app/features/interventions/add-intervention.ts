import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ID, Query } from 'appwrite';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { PhoneFormatDirective } from '../../core/directives/phone-format.directive';
import { ImageService } from '../../core/services/image.service';

@Component({
  selector: 'app-add-intervention',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneFormatDirective],
  templateUrl: './add-intervention.html',
  styleUrls: ['./add-intervention.scss']
})
export class AddInterventionComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);
  private imageService = inject(ImageService);

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
  touchedPhones = signal<Record<string, boolean>>({});

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
    photos: [] as string[],
    owner: [] as string[],
    createdBy: '', 
    status: 'OPEN'
  };

  // Validation réactive via Signal
  isFormValid = computed(() => {
    const allHabitantsValid = this.data.habitants.every((h, index) => 
      this.isHabitantComplete(h, index)
    );
    const addressValid = !!this.data.adresse.rue && !!this.data.adresse.ville;
    const taskValid = this.tasks().length > 0 && this.tasks()[0].text.trim() !== '';
        const technicianValid = !!this.data.assigned && this.data.assigned !== '';
    const proprioValid = !this.data.proprietaire.tel || this.phonesValid()['proprio'];

    return allHabitantsValid && addressValid && taskValid && technicianValid && proprioValid;
  });




  // Fonctions de synchronisation de profil fusionnées
  async fetchAndSetOwnerProfile(email: string) {
    if (!email) return;
    try {
      const response = await this.auth.databases.listDocuments(
        this.DB_ID,
        'user_profiles',
        [Query.equal('email', email), Query.limit(1)]
      );

      if (response.documents.length > 0) {
        const profile = response.documents[0];
        const ownerInfo = {
          prenom: profile['firstname'] || '', 
          nom: profile['lastname'] || '',    
          tel: profile['phone'] || '',
          email: email
        };
        this.data.owner = [JSON.stringify(ownerInfo)];
      }
    } catch (e) {
      console.error("Erreur profil owner:", e);
    }
  }

  async onAdminUserChange(newEmail: string) {
    this.onValueChange();
    // Met à jour dynamiquement le owner quand l'admin change le créateur
    await this.fetchAndSetOwnerProfile(newEmail);
  }











  async loadInterventionData(id: string) {
    this.loading.set(true);
    try {
      const doc = await this.auth.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
      
      const habitants = this.parseJson(doc['habitants']);
      const proprio = this.parseJson(doc['proprietaire']);
      const missionData = this.parseJson(doc['mission']);

      this.data = {
        ...this.data,
        ...doc as any,
        createdBy: doc['createdBy'], // On récupère l'auteur réel
  status: doc['status'],       // On récupère le statut réel
        adresse: this.parseJson(doc['adresse']),
        habitants: habitants,
        mission: missionData,
        proprietaire: proprio,
        photos: Array.isArray(doc['photos']) ? doc['photos'] : [],
        owner: Array.isArray(doc['owner']) ? doc['owner'] : []
      };

      // Initialisation des tâches dans le signal
      if (missionData && missionData.tasks) {
        this.tasks.set(missionData.tasks.map((t: any, i: number) => ({
          id: i,
          text: t.label,
          done: t.done
        })));
      }

      // Initialisation de la validité des téléphones chargés
      const initialValids: Record<string, boolean> = {};
      habitants.forEach((h: any, i: number) => {
        if (h.tel) initialValids[i.toString()] = true; 
      });
      if (proprio.tel) initialValids['proprio'] = true;
      this.phonesValid.set(initialValids);

      // Reset du flag "hasChanges" car le chargement initial n'est pas une modification
      setTimeout(() => this.hasChanges.set(false), 200);

    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      this.loading.set(false);
    }
  }

  async removePhoto(pStr: string) {
    const photoObj = this.parseJson(pStr);
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      this.data.photos = this.data.photos.filter(p => p !== pStr);
      await this.auth.storage.deleteFile(this.BUCKET_ID, photoObj.id);
      this.onValueChange();
    } catch (e) { console.warn("Déjà supprimé du storage"); }
  }

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

  addHabitant() { 
    this.data.habitants.push({ nom: '', prenom: '', tel: '' }); 
    this.onValueChange(); 
  }
  async save() {
  if (!this.isFormValid()) return;
  this.loading.set(true);

  try {
    const structuredTasks = this.tasks()
      .filter(t => t.text.trim() !== '')
      .map(t => ({ label: t.text.trim(), done: t.done || false }));

    // Préparation du payload de base
    const payload = {
      adresse: JSON.stringify(this.data.adresse),
      mission: JSON.stringify({ tasks: structuredTasks }),
      habitants: JSON.stringify(this.data.habitants || []),
      proprietaire: JSON.stringify(this.data.proprietaire),
      remarques: this.data.remarques || '',
      assigned: this.data.assigned,
      // On utilise la valeur du formulaire ou l'utilisateur actuel par défaut
      createdBy: this.data.createdBy || this.auth.userEmail(),
      status: this.data.status || 'OPEN',
      photos: this.data.photos || [],
      owner: this.data.owner || []
    };

    if (this.isEditMode() && this.interventionId) {
      // MODE EDITION
      await this.auth.databases.updateDocument(this.DB_ID, this.COL_INTERVENTIONS, this.interventionId, payload);
    } else {
      // MODE CREATION : L'admin peut choisir l'auteur original
      const createPayload = {
        ...payload,
        $createdAt: new Date().toISOString()
      };
      await this.auth.databases.createDocument(this.DB_ID, this.COL_INTERVENTIONS, ID.unique(), createPayload);
    }

    this.hasChanges.set(false);
    this.router.navigate(['/dashboard']);
  } catch (e) {
    console.error("Save Error:", e);
    alert("Erreur lors de l'enregistrement.");
  } finally {
    this.loading.set(false);
  }
}

  removeHabitant(index: number) { 
    if (this.data.habitants.length > 1) { 
      this.data.habitants.splice(index, 1); 
      this.onValueChange(); 
    } 
  }

  isHabitantComplete(h: any, index: number): boolean { 
    const textOk = h && h.nom?.trim() !== '' && h.tel?.trim() !== '';
    const phoneOk = !!this.phonesValid()[index.toString()];
    return textOk && phoneOk; 
  }


  parseJson(data: any): any {
    if (typeof data !== 'string') return data;
    try { return JSON.parse(data); } catch { return data; }
  }

  onCountryFound(e: any, key: string) { this.detectedCountries.update(p => ({ ...p, [key]: e.name })); }
  setPhoneValidity(v: any, key: string) { 
    this.phonesValid.update(p => ({ ...p, [key]: !!v })); 
  }
  
  scrollToInput(e: any, key: string) {
    this.touchedPhones.update(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

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
          let width = img.width, height = img.height, max = 1200;
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


async onFileSelected(event: any) {
  const file = event.target.files[0];
  if (!file || !this.imageService.isValid(file)) {
    alert("Fichier invalide (Max 10MB, JPG/PNG/WebP)");
    return;
  }

  this.uploading.set(true);
  try {
    // Utilisation du nouveau service multi-threadé
    const compressedFile = await this.imageService.compress(file);
    
    const photoId = ID.unique();
    await this.auth.storage.createFile(this.BUCKET_ID, photoId, compressedFile);
    
    const finalUrl = this.auth.storage.getFileView(this.BUCKET_ID, photoId).toString();
    const photoData = JSON.stringify({ id: photoId, url: finalUrl });
    
    this.data.photos = [...(this.data.photos || []), photoData];
    this.onValueChange();
  } catch (e) {
    alert("Erreur lors de la compression ou de l'upload");
  } finally {
    this.uploading.set(false);
    event.target.value = '';
  }
}


// --- OPTIMISATION DU COPY TO PROPRIETAIRE ---
copyToProprietaire(index: number = 0) {
  const h = this.data.habitants[index];
  if (h && this.isHabitantComplete(h, index)) {
    // Utilisation du spread pour casser la référence objet
    this.data.proprietaire = { ...h };
    
    // On synchronise les états de validation pour le numéro de téléphone
    const sourceKey = index.toString();
    this.phonesValid.update(p => ({ ...p, 'proprio': p[sourceKey] }));
    this.detectedCountries.update(c => ({ ...c, 'proprio': c[sourceKey] }));
    
    this.onValueChange();
  }
}

async ngOnInit() {
  this.themeService.initTheme();
  this.loadTechnicians();
  this.interventionId = this.route.snapshot.paramMap.get('id');

  if (this.interventionId) {
    this.isEditMode.set(true);
    await this.loadInterventionData(this.interventionId);
  } else {
    // --- VALEUR PAR DEFAUT EN DUR ICI ---
    this.data.assigned = 'john.derkinderen@gmail.com'; // <--- Remplace par l'email voulu
    
    this.data.status = 'OPEN';
    this.data.createdBy = this.auth.userEmail() ?? '';
    await this.fetchAndSetOwnerProfile(this.data.createdBy);
  }
}

// Vérifie que ta fonction loadTechnicians ressemble bien à ceci 
// pour avoir les noms disponibles :
async loadTechnicians() {
  try {
    const response = await this.auth.databases.listDocuments(
      this.DB_ID,
      'user_profiles',
      [Query.limit(100), Query.orderAsc('firstname')]
    );

    const list = response.documents.map(doc => ({
      // On prépare le nom complet pour l'affichage
      name: (doc['firstname'] && doc['lastname']) 
            ? `${doc['firstname']} ${doc['lastname']}` 
            : doc['email'],
      email: doc['email']
    }));

    this.technicians.set(list);
  } catch (e) {
    console.error("Erreur technicians:", e);
  }
}
}