import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-whitelist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './whitelist.html',
  styleUrls: ['./whitelist.scss']
})
export class Whitelist implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  public auth = inject(AuthService);

  authorizedUsers = signal<any[]>([]);
  roles = signal<any[]>([]);
  loading = signal(true);
  private unsubscribe: any;

  private dbId = '694eba69001c97d55121';
  private colWhitelist = 'authorized_users';
  private colProfiles = 'user_profiles';
  private colRoles = 'roles';

  ngOnInit() {
    this.themeService.initTheme();
    this.loadInitialData();
    this.subscribeToChanges();
  }

  ngOnDestroy() { if (this.unsubscribe) this.unsubscribe(); }

  subscribeToChanges() {
    this.unsubscribe = this.auth.client.subscribe(
      [`databases.${this.dbId}.collections.${this.colProfiles}.documents`,
       `databases.${this.dbId}.collections.${this.colWhitelist}.documents`],
      () => this.loadAuthorizedUsers()
    );
  }

  async loadInitialData() {
    await Promise.all([this.loadRoles(), this.loadAuthorizedUsers()]);
    this.loading.set(false);
  }

  async loadRoles() {
    try {
      const res = await this.auth.databases.listDocuments(this.dbId, this.colRoles);
      this.roles.set(res.documents.map(d => ({ id: d.$id, ...d })));
    } catch (e) { console.error(e); }
  }

  async loadAuthorizedUsers() {
    try {
      const authSnap = await this.auth.databases.listDocuments(this.dbId, this.colWhitelist);
      const authorizedIds = authSnap.documents.map(d => d.$id);
      const profileSnap = await this.auth.databases.listDocuments(this.dbId, this.colProfiles);
      
      const users = profileSnap.documents
        .filter(u => authorizedIds.includes(u.$id))
        .map(d => ({ 
          email: d['email'], 
          nickName: d['nickName'], 
          role: d['role'], 
          ...d 
        }));

      users.sort((a: any, b: any) => a.nickName?.localeCompare(b.nickName));
      this.authorizedUsers.set(users);
    } catch (e) { console.error(e); }
  }





  async updateUserRole(email: string, newRole: string) {
    try {
      await this.auth.databases.updateDocument(this.dbId, this.colProfiles, this.auth.formatId(email), { role: newRole });
      if (email === this.auth.userEmail()) this.auth.userRole.set(newRole);
    } catch (e) { console.error(e); }
  }

  async editNickName(user: any) {
    const newName = prompt("Pseudo :", user.nickName);
    if (newName?.trim()) {
      try {
        await this.auth.databases.updateDocument(this.dbId, this.colProfiles, this.auth.formatId(user.email), { nickName: newName.trim() });
        if (user.email === this.auth.userEmail()) this.auth.userNickName.set(newName.trim());
        this.loadAuthorizedUsers();
      } catch (e) { console.error(e); }
    }
  }
 

  /**
   * Suppression complète d'un utilisateur
   * Note : La suppression de l'Auth nécessite une Appwrite Function pour être 100% automatisée.
   * standard_a91ce1af77eb2a192dbea14f6b06e6ccdc7d439777fb82aabb8799717d812275e8bd3a7bcf521361b106adfc631d39ffd53c4e9dbe1ef18f89fe063f0df616d7b457b3f4edef4a02c0080ba1163fd24d007a263696035cf03a6f7c1ea6b59f37b24598b3c1c8ce20d55dacf28d9b34c089c7fba76340503f079939b99ed94994
   *databases.694eba69001c97d55121.collections.authorized_users.documents.*.delete
   */
  async deleteEmail(email: string) {
    if (email === this.auth.userEmail()) return alert("Vous ne pouvez pas vous supprimer vous-même.");
    
    if (confirm(`⚠️ Supprimer définitivement ${email} ?\nCela révoquera l'accès et effacera le profil.`)) {
      try {
        this.loading.set(true);
        const id = this.auth.formatId(email);

        // 1. Supprimer de la Whitelist (Bloque l'accès immédiat)
        await this.auth.databases.deleteDocument(this.dbId, this.colWhitelist, id);

        // 2. Supprimer le Profil (Efface les données personnelles)
        try {
          await this.auth.databases.deleteDocument(this.dbId, this.colProfiles, id);
        } catch (e) {
          console.warn("Profil déjà inexistant ou erreur de suppression.");
        }

        // 3. Information importante
        alert(`Accès révoqué pour ${email}. \nNote: Pensez à supprimer manuellement le compte dans la console Appwrite (onglet Auth) pour effacer définitivement les identifiants.`);
        
        await this.loadAuthorizedUsers();
      } catch (e: any) {
        alert("Erreur lors de la suppression : " + e.message);
      } finally {
        this.loading.set(false);
      }
    }
  }

  /**
   * Ajout d'un utilisateur avec initialisation du flag hasAccount
   */
  async addEmail(emailInput: HTMLInputElement, nameInput: HTMLInputElement) {
    const email = emailInput.value.trim().toLowerCase();
    const nickName = nameInput.value.trim();
    const id = this.auth.formatId(email);

    if (!email.includes('@')) return alert("Email invalide");

    try {
      this.loading.set(true);
      const tempPass = "ChangeMe!" + Math.random().toString(36).slice(-8);
      
      // 1. Création Compte Auth (Si inexistant)
      try { 
        await this.auth.account.create(id, email, tempPass); 
      } catch (e: any) { 
        if (e.code !== 409) throw e; 
      }

      // 2. Ajout Whitelist avec le flag hasAccount à false
      await this.auth.databases.createDocument(this.dbId, this.colWhitelist, id, { 
        email, 
        addedAt: new Date().toISOString(),
        hasAccount: false // L'utilisateur devra se loguer pour passer à true
      });

      // 3. Création/Update Profil
      try {
        await this.auth.databases.createDocument(this.dbId, this.colProfiles, id, {
          email, 
          nickName: nickName || email.split('@')[0], 
          role: 'Technicien', 
          themePreference: 'dark', 
          updatedAt: new Date().toISOString()
        });
      } catch (e: any) {
        if (e.code === 409) {
          await this.auth.databases.updateDocument(this.dbId, this.colProfiles, id, { 
            nickName: nickName || email.split('@')[0] 
          });
        }
      }

      alert(`Utilisateur autorisé !\nIdentifiants temporaires :\nEmail: ${email}\nMDP: ${tempPass}`);
      emailInput.value = ''; nameInput.value = '';
      await this.loadAuthorizedUsers();
    } catch (error: any) { 
      alert("Erreur lors de l'ajout : " + error.message); 
    } finally { 
      this.loading.set(false); 
    }
  }

  // ... (reste des méthodes : loadRoles, loadAuthorizedUsers, etc.)
} 
