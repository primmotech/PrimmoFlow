import { Component, inject, OnInit, signal, computed } from '@angular/core'; // Ajoute computed ici
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { Query } from 'appwrite';
import { Location } from '@angular/common';

@Component({
  selector: 'app-completed-interventions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './completed-interventions.html',
  styleUrls: ['./completed-interventions.scss']
})
export class CompletedInterventionsComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  public themeService = inject(ThemeService);

  private DB_ID = '694eba69001c97d55121';
  private COL_INTERVENTIONS = 'interventions';
   private location = inject(Location);

  missions = signal<any[]>([]);
  loading = signal(true);

  // --- LE CORRECTIF : On calcule le total dès que 'missions' change ---
  totalRevenu = computed(() => {
    return this.missions().reduce((acc, m) => {
      // On utilise totalFinal ou totalAmount selon ton champ Appwrite
      return acc + (Number(m.totalFinal) || 0);
    }, 0);
  });

  ngOnInit() {
    this.themeService.initTheme();
    this.fetchPaidMissions();
  }

  fetchPaidMissions() {
    const userEmail = this.authService.userEmail();
    if (!userEmail) return;

    this.loading.set(true);

    this.authService.databases.listDocuments(
      this.DB_ID,
      this.COL_INTERVENTIONS,
      [
        Query.equal('assigned', userEmail),
        Query.equal('status', 'PAID'),
        Query.orderDesc('completedAt'),
        Query.limit(100)
      ]
    ).then(response => {
      const parsedMissions = response.documents.map(doc => {
        let adresse = doc['adresse'];
        let habitants = doc['habitants'];

        try { if (typeof adresse === 'string') adresse = JSON.parse(adresse); } catch(e){}
        try { if (typeof habitants === 'string') habitants = JSON.parse(habitants); } catch(e){}

        return { ...doc, adresse, habitants };
      });

      this.missions.set(parsedMissions);
      this.loading.set(false);
    }).catch(err => {
      console.error("Erreur Appwrite Archives :", err);
      this.loading.set(false);
    });
  }

  viewInvoice(id: string) {
    this.router.navigate(['/invoice', id]);
  }
goBack() {
  this.location.back();
}
  async deleteMission(event: Event, missionId: string) {
    event.stopPropagation(); // Empêche d'ouvrir la facture en cliquant sur le bouton

    if (confirm('Voulez-vous vraiment supprimer cette archive ? (Cette action est irréversible)')) {
      try {
        await this.authService.databases.deleteDocument(
          this.DB_ID,
          this.COL_INTERVENTIONS,
          missionId
        );
        
        // Mise à jour locale du signal pour faire disparaître la carte et recalculer le total
        this.missions.set(this.missions().filter(m => m.$id !== missionId));
        
      } catch (err) {
        console.error("Erreur lors de la suppression :", err);
        alert("Erreur lors de la suppression de l'archive.");
      }
    }
  }
}