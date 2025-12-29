import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { Query } from 'appwrite';

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

  missions = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.themeService.initTheme();
    this.fetchPaidMissions();
  }

  fetchPaidMissions() {
    const userEmail = this.authService.userEmail(); // On utilise le signal de ton AuthService
    if (!userEmail) return;

    this.loading.set(true);

    this.authService.databases.listDocuments(
      this.DB_ID,
      this.COL_INTERVENTIONS,
      [
        Query.equal('assigned', userEmail),
        Query.equal('status', 'PAID'),
        Query.orderDesc('completedAt'), // Nécessite un index
        Query.limit(100)
      ]
    ).then(response => {
      // Mapping pour parser les adresses/habitants si stockés en JSON
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
    this.router.navigate(['/dashboard']);
  }
}