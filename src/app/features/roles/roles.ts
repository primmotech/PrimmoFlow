import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; // Ton service Appwrite corrigé
import { ThemeService } from '../../core/services/theme';
import { PERMISSION_STRUCTURE } from './roles-structure'; 

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './roles.html',
  styleUrls: ['./roles.scss']
})
export class Roles implements OnInit {
  private router = inject(Router);
  public themeService = inject(ThemeService);
  public authService = inject(AuthService); // Utilise maintenant les signaux Appwrite

  // Configuration IDs Appwrite
  private readonly DB_ID = '694eba69001c97d55121';
  private readonly COL_ROLES = 'roles';

  roles = signal<any[]>([]);
  loading = signal(true);
  editing = signal(false);
  permissionGroups = PERMISSION_STRUCTURE;

  roleForm = {
    name: '',
    permissions: {} as { [key: string]: boolean }
  };

  ngOnInit() {



    
    this.themeService.initTheme();
    this.initPermissions();
    this.loadRoles();
  }

  initPermissions() {
    const p: any = {};
    this.permissionGroups.forEach(group => {
      group.perms.forEach(perm => p[perm.id] = false);
    });
    this.roleForm.permissions = p;
  }

  /**
   * Chargement des rôles depuis Appwrite
   */
  async loadRoles() {
    try {
      const response = await this.authService.databases.listDocuments(this.DB_ID, this.COL_ROLES);
      this.roles.set(response.documents.map(d => ({ id: d.$id, ...d })));
    } catch (e) {
      console.error("Erreur chargement rôles Appwrite:", e);
    } finally {
      this.loading.set(false);
    }
  }

  editRole(role: any) {
    this.editing.set(true);
    this.roleForm.name = role.name || role.id;
    
    const permsOnly: any = {};
    this.permissionGroups.forEach(group => {
      group.perms.forEach(p => {
        // Appwrite renvoie les booleens tels quels
        permsOnly[p.id] = role[p.id] === true;
      });
    });

    this.roleForm.permissions = permsOnly;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editing.set(false);
    this.roleForm.name = '';
    this.initPermissions();
  }

  /**
   * Sauvegarde ou Création dans Appwrite
   */
  async saveRole() {
    const roleId = this.roleForm.name.trim();
    if (!roleId) return;

    this.loading.set(true);
    try {
      // Dans Appwrite, on utilise l'ID du document comme nom du rôle (ex: "Admin")
      const data = {
        ...this.roleForm.permissions,
        name: roleId,
        updatedAt: new Date().toISOString()
      };

      try {
        // On tente une mise à jour
        await this.authService.databases.updateDocument(this.DB_ID, this.COL_ROLES, roleId, data);
      } catch (e: any) {
        // Si le document n'existe pas (404), on le crée
        if (e.code === 404) {
          await this.authService.databases.createDocument(this.DB_ID, this.COL_ROLES, roleId, data);
        } else {
          throw e;
        }
      }
      
      this.cancelEdit();
      await this.loadRoles(); // On rafraîchit la liste
    } catch (e) {
      console.error("Erreur sauvegarde rôle Appwrite:", e);
      alert("Erreur. Vérifiez que tous les attributs Booleens existent dans Appwrite.");
    } finally {
      this.loading.set(false);
    }
  }

  async deleteRole(id: string) {
    if (id === 'Administrateur' || id === 'Admin') {
      alert("Le rôle Administrateur est protégé.");
      return;
    }
    
    if (confirm(`Supprimer le rôle "${id}" ?`)) {
      try {
        await this.authService.databases.deleteDocument(this.DB_ID, this.COL_ROLES, id);
        await this.loadRoles();
      } catch (e) {
        console.error("Erreur suppression:", e);
      }
    }
  }

  getPermCount(role: any): number {
    // On filtre les clés système Appwrite ($id, $collectionId, etc.)
    return Object.keys(role).filter(key => 
      !key.startsWith('$') && key !== 'name' && key !== 'updatedAt' && role[key] === true
    ).length;
  }

  toggleSection(groupKey: string, value: boolean) {
    const group = this.permissionGroups.find(g => g.key === groupKey);
    if (group) {
      group.perms.forEach(p => {
        this.roleForm.permissions[p.id] = value;
      });
      this.roleForm.permissions = { ...this.roleForm.permissions };
    }
  }

  goBack() { this.router.navigate(['/dashboard']); }
}