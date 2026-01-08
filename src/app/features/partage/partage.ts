import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';

@Component({
  selector: 'app-partage',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './partage.html',
  styleUrls: ['./partage.scss']
})
export class Partage implements OnInit {
  public router = inject(Router);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);

  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_SHARES = 'shares'; 
  private readonly COL_PROFILES = 'user_profiles';

  allColleagues = signal<any[]>([]);
  allowedEmails = signal<string[]>([]);
  tempAllowedEmails = signal<string[]>([]);
  alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  loading = signal(true);

  // Détection du mode "Dirty"
  isDirty = computed(() => {
    const original = [...this.allowedEmails()].sort().join(',');
    const current = [...this.tempAllowedEmails()].sort().join(',');
    return original !== current;
  });

  // Groupement alphabétique
  groupedColleagues = computed(() => {
    const groups: { letter: string, members: any[] }[] = [];
    const sorted = [...this.allColleagues()].sort((a, b) => a.name.localeCompare(b.name));
    
    sorted.forEach(col => {
      const letter = col.name.charAt(0).toUpperCase();
      let group = groups.find(g => g.letter === letter);
      if (!group) {
        group = { letter, members: [] };
        groups.push(group);
      }
      group.members.push(col);
    });
    return groups;
  });

  async ngOnInit() {
    this.themeService.initTheme();
    await this.loadData();
  }



  scrollToLetter(letter: string) {
    const element = document.getElementById('letter-' + letter);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleTempPermission(email: string) {
    const current = [...this.tempAllowedEmails()];
    const idx = current.indexOf(email);
    idx > -1 ? current.splice(idx, 1) : current.push(email);
    this.tempAllowedEmails.set(current);
  }

  async saveChanges() {
    this.loading.set(true);
    const myId = this.auth.formatId(this.auth.userEmail()!);
    const data = {
      user_email: this.auth.userEmail(),
      allowed_emails: this.tempAllowedEmails()
    };
    try {
      try {
        await this.auth.databases.updateDocument(this.DB_ID, this.COL_SHARES, myId, data);
      } catch (e: any) {
        if (e.code === 404) {
          await this.auth.databases.createDocument(this.DB_ID, this.COL_SHARES, myId, data);
        }
      }
      this.allowedEmails.set([...this.tempAllowedEmails()]);
    } catch (err) {
      alert("Erreur de sauvegarde");
    } finally {
      this.loading.set(false);
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
  async loadData() {
  this.loading.set(true);
  try {
    const myEmail = this.auth.userEmail();
    
    // 1. Récupérer tous les profils de la collection
    const res = await this.auth.databases.listDocuments(this.DB_ID, this.COL_PROFILES);
    const allDocs = res.documents;

    // 2. Identifier mon profil et mon teamId
    const myProfile = allDocs.find(d => d['email'] === myEmail);
    const myTeam = myProfile ? myProfile['teamId'] : null;

    if (!myTeam) {
      console.warn("Attention : teamId non trouvé pour ce profil.");
      this.allColleagues.set([]); // On vide la liste par sécurité
    } else {
      // 3. Filtrer : même équipe, pas moi-même, et pas de comptes tests/admins sans équipe
      const filtered = allDocs.filter(d => 
        d['email'] !== myEmail && 
        d['teamId'] === myTeam
      );

      this.allColleagues.set(filtered.map(d => {
        const fName = d['firstname'] || '';
        const lName = d['lastname'] || '';
        const fullName = `${lName.toUpperCase()} ${fName.charAt(0).toUpperCase() + fName.slice(1).toLowerCase()}`.trim();
        
        return { 
          email: d['email'], 
          name: fullName || d['email'] 
        };
      }));
    }

    // 4. Charger les permissions de partage actuelles (ta collection 'shares')
    const myId = this.auth.formatId(myEmail!);
    try {
      const shareDoc = await this.auth.databases.getDocument(this.DB_ID, this.COL_SHARES, myId);
      const emails = shareDoc['allowed_emails'] || [];
      this.allowedEmails.set(emails);
      this.tempAllowedEmails.set([...emails]);
    } catch (e: any) {
      if (e.code === 404) {
        this.allowedEmails.set([]);
        this.tempAllowedEmails.set([]);
      }
    }

  } catch (err) {
    console.error("Erreur technique lors du chargement des équipes :", err);
  } finally {
    this.loading.set(false);
  }
}
}