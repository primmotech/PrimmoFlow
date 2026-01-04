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
      // On cherche le profil correspondant par ID
      const profile = profiles.find(p => p.$id === authDoc.$id);
      
      return {
        email: authDoc['email'],
        // Si le profil existe on prend ses data, sinon valeurs par défaut
        nickName: profile?.['nickName'] || authDoc['email'].split('@')[0],
        role: profile?.['role'] || 'Aucun',
        assignable: profile?.['assignable'] ?? false,
        $id: authDoc.$id
      };
    });

    users.sort((a: any, b: any) => a.nickName?.localeCompare(b.nickName));
    this.authorizedUsers.set(users);
  } catch (e) {
    console.error("Erreur chargement users:", e);
  }
}

  async toggleAssignable(user: any) {
    try {
      const newStatus = !user.assignable;
      const id = this.auth.formatId(user.email);
      
      await this.auth.databases.updateDocument(
        this.dbId, 
        this.colProfiles, 
        id, 
        { assignable: newStatus }
      );
      
      // Mise à jour locale immédiate pour la réactivité UI
      this.authorizedUsers.update(users => 
        users.map(u => u.email === user.email ? { ...u, assignable: newStatus } : u)
      );
    } catch (e) {
      console.error("Erreur toggle assignable:", e);
    }
  }

async updateUserRole(email: string, newRole: string) {
  try {
    const id = this.auth.formatId(email);
    await this.auth.databases.updateDocument(this.dbId, this.colProfiles, id, { 
      role: newRole 
    });

    // Mise à jour du signal local pour une interface fluide
    this.authorizedUsers.update(users => 
      users.map(u => u.email === email ? { ...u, role: newRole } : u)
    );

    // Si c'est mon propre rôle, je mets à jour mon AuthService
    if (email === this.auth.userEmail()) {
      this.auth.userRole.set(newRole);
      // Optionnel: recharger les permissions pour voir les changements immédiatement
      // await this.auth.loadPermissions(newRole);
    }
  } catch (e) {
    console.error("Erreur update role:", e);
    alert("Erreur lors de la mise à jour du rôle.");
  }
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
  async loadRoles() {
  try {
    const res = await this.auth.databases.listDocuments(this.dbId, this.colRoles);
    //console.log("Rôles récupérés :", res.documents); // <--- AJOUTE CECI
    this.roles.set(res.documents.map(d => ({ id: d.$id, ...d })));
  } catch (e) { 
    console.error("Erreur lors du chargement des rôles :", e); 
  }
}
async addEmail(emailInput: HTMLInputElement, nameInput: HTMLInputElement, roleInput: HTMLSelectElement) {
  const email = emailInput.value.trim().toLowerCase();
  const nickName = nameInput.value.trim() || email.split('@')[0];
  const selectedRole = roleInput.value; // Récupère le rôle choisi
  const id = this.auth.formatId(email);

  if (!email.includes('@')) return alert("Email invalide");

  try {
    this.loading.set(true);
    
    // 1. Inscription Whitelist
    await this.auth.databases.createDocument(this.dbId, this.colWhitelist, id, { 
      email, addedAt: new Date().toISOString(), hasProfile: false 
    });
    
    // 2. Création du profil avec le rôle choisi directement
    await this.auth.databases.createDocument(this.dbId, this.colProfiles, id, {
      email, 
      nickName, 
      role: selectedRole, // Utilisation du rôle sélectionné
      assignable: false,
      themePreference: 'dark', 
      updatedAt: new Date().toISOString()
    });

    try {
      await this.notificationService.sendWelcomeEmail(email, nickName);
    } catch (mailError) {
      console.warn("Utilisateur ajouté, mais échec mail:", mailError);
    }

    alert(`Utilisateur ${email} autorisé avec le rôle ${selectedRole} !`);
    
    // Reset du formulaire
    emailInput.value = ''; 
    nameInput.value = '';
    roleInput.value = 'Aucun'; 
    
    await this.loadAuthorizedUsers();

  } catch (error: any) { 
    alert("Erreur : " + error.message); 
  } finally { 
    this.loading.set(false); 
  }
}
}