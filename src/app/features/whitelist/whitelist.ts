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

  async loadAuthorizedUsers() {
    try {
      const authSnap = await this.auth.databases.listDocuments(this.dbId, this.colWhitelist);
      const profileSnap = await this.auth.databases.listDocuments(this.dbId, this.colProfiles);
      const profiles = profileSnap.documents;

      const users = authSnap.documents.map(authDoc => {
        const profile = profiles.find(p => p.$id === authDoc.$id);
        return {
          email: authDoc['email'],
          role: profile?.['role'] || 'Aucun',
          assignable: profile?.['assignable'] ?? false,
          $id: authDoc.$id
        };
      });

      users.sort((a: any, b: any) => a.email.localeCompare(b.email));
      console.log("Loaded users:", users);
      this.authorizedUsers.set(users);
    } catch (e) {
      console.error("Erreur chargement users:", e);
    }
  }

  async toggleAssignable(user: any) {
    try {
      const newStatus = !user.assignable;
      const id = this.auth.formatId(user.email);
      await this.auth.databases.updateDocument(this.dbId, this.colProfiles, id, { assignable: newStatus });
      this.authorizedUsers.update(users => 
        users.map(u => u.email === user.email ? { ...u, assignable: newStatus } : u)
      );
    } catch (e) { console.error(e); }
  }

  async updateUserRole(email: string, newRole: string) {
    try {
      const id = this.auth.formatId(email);
      await this.auth.databases.updateDocument(this.dbId, this.colProfiles, id, { role: newRole });
      this.authorizedUsers.update(users => 
        users.map(u => u.email === email ? { ...u, role: newRole } : u)
      );
      if (email === this.auth.userEmail()) this.auth.userRole.set(newRole);
    } catch (e) { console.error(e); }
  }

  async deleteEmail(user: any) {
    const email = user.email;
    if (email === this.auth.userEmail()) return alert("Action impossible.");
    
    if (confirm(`Supprimer définitivement ${email} ?`)) {
      try {
        this.loading.set(true);
        const id = this.auth.formatId(email);
        await this.auth.databases.deleteDocument(this.dbId, this.colWhitelist, id);
        try { await this.auth.databases.deleteDocument(this.dbId, this.colProfiles, id); } catch(e){}
        
        await this.notificationService.sendRevocationEmail(email, email);
        await this.loadAuthorizedUsers();
      } catch (e: any) { alert(e.message); } finally { this.loading.set(false); }
    }
  }

  async loadRoles() {
    try {
      const res = await this.auth.databases.listDocuments(this.dbId, this.colRoles);
      this.roles.set(res.documents.map(d => ({ id: d.$id, ...d })));
    } catch (e) { console.error(e); }
  }

  async addEmail(emailInput: HTMLInputElement, roleInput: HTMLSelectElement) {
    const email = emailInput.value.trim().toLowerCase();
    const selectedRole = roleInput.value;
    const id = this.auth.formatId(email);

    if (!email.includes('@')) return alert("Email invalide");

    try {
      this.loading.set(true);
      await this.auth.databases.createDocument(this.dbId, this.colWhitelist, id, { 
        email, addedAt: new Date().toISOString(), hasProfile: false 
      });
      
      await this.auth.databases.createDocument(this.dbId, this.colProfiles, id, {
        email, 
        role: selectedRole,
        assignable: false,
        themePreference: 'dark', 
        updatedAt: new Date().toISOString()
      });

      await this.notificationService.sendWelcomeEmail(email, email);
      emailInput.value = ''; 
      roleInput.value = 'Aucun'; 
      await this.loadAuthorizedUsers();
    } catch (error: any) { alert(error.message); } finally { this.loading.set(false); }
  }
}