import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ID, Query } from 'appwrite'; // Import Appwrite
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-add-intervention',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-intervention.html',
  styleUrls: ['./add-intervention.scss']
})
export class AddInterventionComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public auth = inject(AuthService); // Utilise ton AuthService fusionné
  public themeService = inject(ThemeService);

  loading = signal(false);
  activeStep = signal<number>(1);
  hasChanges = signal(false);
  isEditMode = signal(false);
  interventionId: string | null = null;
  technicians = signal<any[]>([]);

  tasks = signal<{id: number, text: string}[]>([{ id: Date.now(), text: '' }]);

  // IDs de ta configuration Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  data = {
    adresse: { numero: '', rue: '', ville: '' },
    mission: { description: '' },
    remarques: '',
    habitants: [ { nom: '', prenom: '', tel: '' } ],
    proprietaire: { nom: '', prenom: '', tel: '' },
    assigned: '',
  };

  async ngOnInit() {
    this.loadTechnicians();
    
    this.interventionId = this.route.snapshot.paramMap.get('id');
    
    if (this.interventionId) {
      this.isEditMode.set(true);
      await this.loadInterventionData(this.interventionId);
    } else {
      // On utilise le signal du nouvel AuthService
      this.data.assigned = this.auth.userEmail() || '';
    }
  }

  // --- Chargement Appwrite ---
  async loadInterventionData(id: string) {
    this.loading.set(true);
    try {
      const doc = await this.auth.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
      
      // On parse les objets stockés en JSON String dans Appwrite
      this.data = { 
        ...this.data, 
        ...doc as any,
        adresse: typeof doc['adresse'] === 'string' ? JSON.parse(doc['adresse']) : doc['adresse'],
        habitants: typeof doc['habitants'] === 'string' ? JSON.parse(doc['habitants']) : doc['habitants'],
        mission: typeof doc['mission'] === 'string' ? JSON.parse(doc['mission']) : doc['mission'],
        proprietaire: typeof doc['proprietaire'] === 'string' ? JSON.parse(doc['proprietaire']) : doc['proprietaire']
      };
      
      if (this.data.mission?.description) {
        const lines = this.data.mission.description.split('\n');
        this.tasks.set(lines.map((text: string, i: number) => ({ id: i, text })));
      }
    } catch (e) {
      console.error("Erreur chargement Appwrite:", e);
    } finally {
      this.loading.set(false);
    }
  }

  async loadTechnicians() {
    try {
      // On récupère les profils pour peupler la liste des techniciens
      const response = await this.auth.databases.listDocuments(this.DB_ID, 'user_profiles', [
        Query.limit(100)
      ]);
      this.technicians.set(response.documents.map(d => ({ 
        email: d['email'], 
        name: d['nickName'] || d['email'] 
      })));
    } catch (e) {
      console.error("Erreur techniciens:", e);
    }
  }

  // --- Gestion des tâches (Identique) ---
  onValueChange() { if (!this.hasChanges()) this.hasChanges.set(true); }

  addTask() {
    this.tasks.update(t => [...t, { id: Date.now(), text: '' }]);
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
    if (this.data.habitants.length < 2) {
      this.data.habitants.push({ nom: '', prenom: '', tel: '' });
      this.onValueChange();
    }
  }

  removeHabitant(index: number) {
    if (this.data.habitants.length > 1) {
      this.data.habitants.splice(index, 1);
      this.onValueChange();
    }
  }

  // --- Validations ---
  isAddrValid() {
    const a = this.data.adresse;
    return a.numero && a.rue && a.ville;
  }

  isHabitantComplete(h: any): boolean {
    return h && h.nom?.trim() !== '' && h.tel?.trim() !== '';
  }

  isFormValid() {
    return this.isAddrValid() && 
           this.data.assigned !== '' && 
           this.tasks().length > 0 && this.tasks()[0].text.trim() !== '' && 
           this.isHabitantComplete(this.data.habitants[0]);
  }

  // --- SAUVEGARDE APPWRITE ---
  async save() {
    if (!this.isFormValid()) return;
    this.loading.set(true);

    this.data.mission.description = this.tasks()
      .map(t => t.text.trim())
      .filter(t => t.length > 0)
      .join('\n');

    // Préparation pour Appwrite : Stringifier les objets complexes
    const payload = {
      ...this.data,
      adresse: JSON.stringify(this.data.adresse),
      mission: JSON.stringify(this.data.mission),
      habitants: JSON.stringify(this.data.habitants),
      proprietaire: JSON.stringify(this.data.proprietaire),
      $updatedAt: new Date().toISOString()
    };

    try {
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
      console.error("Erreur sauvegarde Appwrite:", e);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      this.loading.set(false);
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
  // Méthode pour copier un habitant vers le propriétaire
copyToProprietaire(index: number = 0) {
  const habitant = this.data.habitants[index];
  if (habitant) {
    this.data.proprietaire = {
      nom: habitant.nom,
      prenom: habitant.prenom,
      tel: habitant.tel
    };
    this.onValueChange();
  }
}
}