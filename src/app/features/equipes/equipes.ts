import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { ID } from 'appwrite';

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './equipes.html',
  styleUrls: ['./equipes.scss']
})
export class Equipes implements OnInit {

  public auth = inject(AuthService);
  public themeService = inject(ThemeService);
  private router = inject(Router);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_TEAMS = 'teams';
  private readonly COL_PROFILES = 'user_profiles';

  // Signaux pour les données
  teams = signal<any[]>([]);
  technicians = signal<any[]>([]); 
  loading = signal(true);
  showModal = signal(false);
  
  // Signaux pour l'UI (Les erreurs venaient d'ici !)
  expandedTeamId = signal<string | null>(null);
  isEditing = signal(false);
  editingId = signal<string | null>(null);

  newTeam = { name: '', members: [] as string[] };

  // Groupement alphabétique calculé pour le sélecteur
  groupedTechnicians = computed(() => {
    const groups: { letter: string, members: any[] }[] = [];
    const sorted = [...this.technicians()].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(t => {
      const letter = t.name.charAt(0).toUpperCase();
      let group = groups.find(g => g.letter === letter);
      if (!group) {
        group = { letter, members: [] };
        groups.push(group);
      }
      group.members.push(t);
    });
    return groups;
  });
  
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Ajoute cette fonction pour le scroll dans la modal
  scrollToLetter(letter: string) {
    const element = document.getElementById('letter-' + letter);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async ngOnInit() {
    this.themeService.initTheme();
    await this.loadTechnicians();
    await this.loadTeams();
  }

  async loadTechnicians() {
    try {
      const res = await this.auth.databases.listDocuments(this.DB_ID, this.COL_PROFILES);
      this.technicians.set(res.documents.map(d => ({ 
        email: d['email'], 
        name: d['firstname'] ? `${d['lastname']?.toUpperCase()} ${d['firstname']}` : d['email']
      })));
    } catch (e) { console.error("Erreur tech:", e); }
  }

  async loadTeams() {
    this.loading.set(true);
    try {
      const res = await this.auth.databases.listDocuments(this.DB_ID, this.COL_TEAMS);
      this.teams.set(res.documents.map(d => ({ id: d.$id, ...d })));
    } catch (e) { console.error("Erreur teams:", e); }
    finally { this.loading.set(false); }
  }

  // Fonctions de l'UI
  toggleExpand(id: string) {
    this.expandedTeamId.set(this.expandedTeamId() === id ? null : id);
  }

  toggleMember(email: string) {
    const current = [...this.newTeam.members];
    const idx = current.indexOf(email);
    idx > -1 ? current.splice(idx, 1) : current.push(email);
    this.newTeam.members = current;
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.newTeam = { name: '', members: [] };
    this.showModal.set(true);
  }

  openEditModal(team: any) {
    this.isEditing.set(true);
    this.editingId.set(team.id);
    this.newTeam = { name: team.name, members: [...team.members] };
    this.showModal.set(true);
  }

  async saveTeam() {
    if (!this.newTeam.name || this.newTeam.members.length === 0) return;
    this.loading.set(true);

    try {
      let teamId = this.editingId();
      
      if (this.isEditing() && teamId) {
        // Mode Edition
        await this.auth.databases.updateDocument(this.DB_ID, this.COL_TEAMS, teamId, {
          name: this.newTeam.name,
          members: this.newTeam.members
        });
      } else {
        // Mode Création
        const doc = await this.auth.databases.createDocument(this.DB_ID, this.COL_TEAMS, ID.unique(), {
          name: this.newTeam.name,
          members: this.newTeam.members
        });
        teamId = doc.$id;
      }

      // Optionnel : Lier les profils à la team
      await this.updateProfilesTeamLink(this.newTeam.members, teamId!);

      this.showModal.set(false);
      await this.loadTeams();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'enregistrement");
    } finally { this.loading.set(false); }
  }

  private async updateProfilesTeamLink(emails: string[], teamId: string) {
    await Promise.all(emails.map(async (email) => {
      try {
        await this.auth.databases.updateDocument(this.DB_ID, this.COL_PROFILES, this.auth.formatId(email), { teamId });
      } catch (e) { /* Profil peut-être inexistant */ }
    }));
  }

  async deleteTeam(team: any) {
    if (!confirm(`Supprimer l'équipe ${team.name} ?`)) return;
    try {
      await this.auth.databases.deleteDocument(this.DB_ID, this.COL_TEAMS, team.id);
      await this.loadTeams();
    } catch (e) { console.error(e); }
  }

  goBack() { this.router.navigate(['/parameters']); }
}