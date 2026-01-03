import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../core/services/theme';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

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
  private notificationService = inject(NotificationService);

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
 

async addEmail(emailInput: HTMLInputElement, nameInput: HTMLInputElement) {
  const email = emailInput.value.trim().toLowerCase();
  const nickName = nameInput.value.trim() || email.split('@')[0];
  const id = this.auth.formatId(email);

  if (!email.includes('@')) return alert("Email invalide");

  try {
    this.loading.set(true);
    
    // 1. Enregistrement BDD
    await this.auth.databases.createDocument(this.dbId, this.colWhitelist, id, { 
      email, addedAt: new Date().toISOString(), hasProfile: false 
    });
    
    await this.auth.databases.createDocument(this.dbId, this.colProfiles, id, {
      email, nickName, role: 'Aucun', themePreference: 'dark', updatedAt: new Date().toISOString()
    });

    // 2. Envoi Email stylé via le service
    try {
      await this.notificationService.sendWelcomeEmail(email, nickName);
    } catch (mailError) {
      console.warn("Utilisateur ajouté, mais échec mail:", mailError);
    }

    alert(`Utilisateur ${email} autorisé !`);
    emailInput.value = ''; nameInput.value = '';
    await this.loadAuthorizedUsers();

  } catch (error: any) { 
    alert("Erreur : " + error.message); 
  } finally { 
    this.loading.set(false); 
  }
}

async deleteEmail(user: any) {
  const email = user.email;
  if (email === this.auth.userEmail()) return alert("Vous ne pouvez pas vous supprimer vous-même.");
  
  if (confirm(`⚠️ Supprimer définitivement ${email} ?`)) {
    try {
      this.loading.set(true);
      const id = this.auth.formatId(email);

      await this.auth.databases.deleteDocument(this.dbId, this.colWhitelist, id);
      try { await this.auth.databases.deleteDocument(this.dbId, this.colProfiles, id); } catch(e){}

      // Envoi Email de révocation via le service
      try {
        await this.notificationService.sendRevocationEmail(email, user.nickName || email);
      } catch (mailError) {
        console.warn("Accès supprimé, mais échec notification mail.");
      }

      alert(`Accès révoqué pour ${email}.`);
      await this.loadAuthorizedUsers();

    } catch (e: any) {
      alert("Erreur suppression : " + e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
} 
