import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; // Service Appwrite
import { ThemeService } from '../../core/services/theme';
import { ID, Query } from 'appwrite';

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './equipes.html',
  styleUrls: ['./equipes.scss']
})
export class Equipes implements OnInit {
  private router = inject(Router);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);

  // Configuration IDs Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_TEAMS = 'teams';
  private readonly COL_PROFILES = 'user_profiles';

  teams = signal<any[]>([]);
  technicians = signal<any[]>([]); 
  loading = signal(true);
  showModal = signal(false);

  newTeam = {
    name: '',
    leader: '', 
    members: [] as string[]
  };

  ngOnInit() {
    this.themeService.initTheme();
    this.loadTechnicians();
    this.loadTeams();
  }

  /**
   * Appwrite n'a pas de onSnapshot natif simple comme Firestore sans le SDK Realtime.
   * On utilise une récupération classique ici.
   */
  async loadTechnicians() {
    try {
      const response = await this.auth.databases.listDocuments(this.DB_ID, this.COL_PROFILES);
      this.technicians.set(response.documents.map(d => ({ 
        email: d['email'] || d.$id, 
        name: d['nickName'] || d.$id 
      })));
    } catch (e) {
      console.error("Erreur chargement techniciens:", e);
    }
  }

  async loadTeams() {
    try {
      const response = await this.auth.databases.listDocuments(this.DB_ID, this.COL_TEAMS);
      this.teams.set(response.documents.map(d => ({ id: d.$id, ...d })));
      this.loading.set(false);
    } catch (e) {
      console.error("Erreur chargement équipes:", e);
    }
  }

  getLeaderName(leaderEmail: string): string {
    const tech = this.technicians().find(t => t.email === leaderEmail);
    return tech ? tech.name : leaderEmail;
  }

  toggleMember(email: string) {
    const idx = this.newTeam.members.indexOf(email);
    if (idx > -1) this.newTeam.members.splice(idx, 1);
    else this.newTeam.members.push(email);
  }

// ... imports et setup identiques ...

  async createTeam() {
    if (!this.newTeam.name || !this.newTeam.leader) return;
    this.loading.set(true); // Feedback visuel pendant la création

    try {
      // 1. Créer l'équipe
      const teamDoc = await this.auth.databases.createDocument(
        this.DB_ID, 
        this.COL_TEAMS, 
        ID.unique(), 
        {
          name: this.newTeam.name,
          leader: this.newTeam.leader,
          members: this.newTeam.members,
          $createdAt: new Date().toISOString()
        }
      );

      // 2. Préparer les emails uniques
      const allEmails = [...new Set([...this.newTeam.members, this.newTeam.leader])];

      // 3. Exécuter les mises à jour de profils en parallèle (plus rapide)
      await Promise.all(allEmails.map(async (email) => {
        const docId = this.auth.formatId(email);
        const isLeader = email === this.newTeam.leader;
        
        const profileData = {
          teamId: teamDoc.$id,
          role: isLeader ? 'Responsable' : 'Technicien'
        };

        try {
          await this.auth.databases.updateDocument(this.DB_ID, this.COL_PROFILES, docId, profileData);
        } catch (e) {
          // Fallback création si le profil n'existe pas (ton code original est bon)
          await this.auth.databases.createDocument(this.DB_ID, this.COL_PROFILES, docId, {
            ...profileData,
            email: email,
            nickName: email.split('@')[0],
            themePreference: 'dark'
          });
        }
      }));

      this.showModal.set(false);
      this.newTeam = { name: '', leader: '', members: [] };
      await this.loadTeams(); 
    } catch (error) {
      console.error('Erreur création équipe:', error);
      alert("Erreur lors de la création.");
    } finally {
      this.loading.set(false);
    }
  }

  async deleteTeam(team: any) {
    if (!confirm(`Supprimer l'équipe ${team.name} ?`)) return;

    try {
      const allEmails = [...new Set([...(team.members || []), team.leader])];
      for (const email of allEmails) {
        try {
          const docId = this.auth.formatId(email);
          await this.auth.databases.updateDocument(this.DB_ID, this.COL_PROFILES, docId, { 
            teamId: '', // Appwrite n'aime pas null si l'attribut est requis, on met une chaîne vide
            role: 'Technicien' 
          });
        } catch (e) { }
      }

      await this.auth.databases.deleteDocument(this.DB_ID, this.COL_TEAMS, team.id);
      await this.loadTeams();
    } catch (error) {
      console.error('Erreur suppression équipe:', error);
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
}