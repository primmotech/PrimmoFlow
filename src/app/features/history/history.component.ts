import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AppwriteService } from '../../core/services/appwrite.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private appwrite = inject(AppwriteService);
  protected authService = inject(AuthService);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_INTERVENTIONS = 'interventions';

  interventionId = signal<string | null>(null);
  intervention = signal<any>(null); // C'est notre "currentInter"
  newComment = signal('');
  selectedReceiver = signal('');
  loading = signal(true);
  availableContacts = signal<{name: string, role: string}[]>([]);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.interventionId.set(id);
    if (id) await this.loadIntervention(id);
  }

  async loadIntervention(id: string) {
    this.loading.set(true);
    try {
      const doc = await this.appwrite.databases.getDocument(this.DB_ID, this.COL_INTERVENTIONS, id);
      
      // 1. Nettoyage des données JSON
      doc['adresse'] = typeof doc['adresse'] === 'string' ? JSON.parse(doc['adresse']) : doc['adresse'];
      doc['calls'] = typeof doc['calls'] === 'string' ? JSON.parse(doc['calls'] || '[]') : (doc['calls'] || []);

      // 2. Extraction du Propriétaire (Marie-paul)
      const contacts = [];
      let propData = doc['proprietaire'];
      if (typeof propData === 'string') {
        try { propData = JSON.parse(propData); } catch(e) { propData = null; }
      }
      const prop = Array.isArray(propData) ? propData[0] : propData; 

      if (prop) {
        const fullName = `${prop.prenom || ''} ${prop.nom || ''}`.trim();
        contacts.push({ name: fullName || 'Propriétaire', role: 'Propriétaire' });
      }

      // 3. Extraction des Habitants
      let habsRaw = doc['habitants'];
      if (typeof habsRaw === 'string') {
        try { habsRaw = JSON.parse(habsRaw); } catch(e) { habsRaw = []; }
      }
      if (Array.isArray(habsRaw)) {
        habsRaw.forEach((h: any) => {
          contacts.push({ name: `${h.prenom || ''} ${h.nom || ''}`.trim(), role: 'Habitant' });
        });
      }

      this.availableContacts.set(contacts);
      this.intervention.set(doc); // On stocke l'objet complet ici
    } catch (e) {
      console.error("Erreur chargement:", e);
    } finally {
      this.loading.set(false);
    }
  }

async addCallLog() {
  // On retire le check strict sur le commentaire
  const comment = this.newComment().trim() || 'Appel effectué'; // Fallback si vide
  const receiver = this.selectedReceiver();
  const currentInter = this.intervention();

  if (!currentInter) return; // Seule l'intervention est obligatoire

  const user = this.authService.userNickName();
  const displayName = user || 'Technicien';

  const newEntry = {
    caller: displayName, 
    receiver: receiver || 'Contact inconnu',
    timestamp: new Date().toISOString(),
    comment: comment
  };

    const currentCalls = Array.isArray(currentInter['calls']) ? currentInter['calls'] : [];
    const updatedCalls = [...currentCalls, newEntry];

    try {
      await this.appwrite.databases.updateDocument(
        this.DB_ID,
        this.COL_INTERVENTIONS,
        currentInter.$id, // Utilisation de l'ID stocké
        { calls: JSON.stringify(updatedCalls) }
      );
      
      this.intervention.update(prev => ({ ...prev, calls: updatedCalls }));
      this.newComment.set('');
      this.selectedReceiver.set('');
    } catch (e) {
      console.error("Erreur update:", e);
      alert("Erreur lors de l'enregistrement.");
    }
  }

  get sortedCalls() {
    return [...(this.intervention()?.['calls'] || [])].reverse();
  }
async deleteCallLog(index: number) {
  // On demande confirmation pour éviter les erreurs
  if (!confirm("Supprimer cette note d'appel ?")) return;

  const currentInter = this.intervention();
  if (!currentInter) return;

  // 1. On récupère les appels actuels
  let calls = [...(currentInter['calls'] || [])];
  
  // 2. On retire l'élément (Attention : comme on affiche en reverse, 
  // l'index du template doit correspondre à l'index réel du tableau)
  // On calcule l'index réel : (longueur - 1 - index_affiche)
  const realIndex = calls.length - 1 - index;
  calls.splice(realIndex, 1);

  try {
    // 3. Mise à jour dans Appwrite
    await this.appwrite.databases.updateDocument(
      this.DB_ID,
      this.COL_INTERVENTIONS,
      currentInter.$id,
      { calls: JSON.stringify(calls) }
    );

    // 4. Mise à jour locale du Signal
    this.intervention.update(prev => ({ ...prev, calls: [...calls] }));
  } catch (e) {
    console.error("Erreur suppression:", e);
    alert("Impossible de supprimer l'appel.");
  }
}
  goBack() {
    this.router.navigate(['/dashboard']);
  }
}