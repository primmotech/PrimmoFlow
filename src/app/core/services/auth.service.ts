import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Client, Account, Databases, Models, ID, Query, Storage } from 'appwrite';
import { ThemeService } from './theme';

const APPWRITE_CONFIG = {
  dbId: '694eba69001c97d55121',
  colWhitelist: 'authorized_users',
  colProfiles: 'user_profiles',
  colRoles: 'roles'
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private themeService = inject(ThemeService);

  public client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('694eb89e001a66c2311f');

  public account = new Account(this.client);
  public databases = new Databases(this.client);
  public storage = new Storage(this.client); // Ajouté pour les photos

  currentUser = signal<Models.User<Models.Preferences> | null>(null);
  userNickName = signal<string | null>(null);
  userEmail = signal<string | null>(null);
  userRole = signal<string | null>(null);
  permissions = signal<string[]>([]);

  constructor() {
    this.checkSession();
  }

  public formatId(email: string): string {
    return email.toLowerCase().trim().replace(/[:@.+=]/g, '_');
  }

  hasPerm(permId: string): boolean {
    return this.permissions().includes(permId);
  }

  // --- AUTH & SESSION ---

  async checkSession(): Promise<boolean> {
    try {
      const user = await this.account.get();
      if (user && user.email) {
        const email = user.email.toLowerCase().trim();
        const isAllowed = await this.checkWhitelist(email);

        if (isAllowed) {
          await this.loadUserProfile(email);
          this.userEmail.set(email);
          this.currentUser.set(user);
          return true;
        } else {
          await this.logout();
          return false;
        }
      }
      return false;
    } catch (error) {
      this.resetSignals();
      return false;
    }
  }

  async login(email: string, pass: string) {
    const session = await this.account.createEmailPasswordSession(email, pass);
    await this.checkSession();
    return session;
  }

  async register(email: string, pass: string) {
    const userId = this.formatId(email);
    const result = await this.account.create(userId, email, pass);
    await this.login(email, pass);
    return result;
  }

  async logout() {
    try { await this.account.deleteSession('current'); } catch {}
    this.resetSignals();
    this.router.navigate(['/login']);
  }

  // --- PROFILS & BASE DE DONNÉES ---

  async getUserProfile(email: string): Promise<any> {
    try {
      return await this.databases.getDocument(
        APPWRITE_CONFIG.dbId, 
        APPWRITE_CONFIG.colProfiles, 
        this.formatId(email)
      );
    } catch (error) { 
      return null; 
    }
  }

  async loadUserProfile(email: string): Promise<any> {
    const profile = await this.getUserProfile(email);
    if (profile) {
      this.userNickName.set(profile['nickName'] || email.split('@')[0]);
      const role = profile['role'] || 'Aucun';
      this.userRole.set(role);
      await this.loadPermissions(role);
      this.themeService.initTheme(profile['themePreference'] || 'dark');
    }
    return profile;
  }

  async updateUserProfile(email: string, data: any): Promise<void> {
    const docId = this.formatId(email);
    await this.databases.updateDocument(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.colProfiles, docId, data);
    
    if (data.nickName) this.userNickName.set(data.nickName);
    if (data.themePreference) this.themeService.initTheme(data.themePreference);
    if (data.role) {
      this.userRole.set(data.role);
      await this.loadPermissions(data.role);
    }
  }

  async doesAccountExist(email: string): Promise<boolean> {
    try {
      const result = await this.databases.listDocuments(
        APPWRITE_CONFIG.dbId, 
        APPWRITE_CONFIG.colProfiles, 
        [Query.equal('email', email.toLowerCase().trim())]
      );
      return result.total > 0;
    } catch { return false; }
  }

  // --- PERMISSIONS ---

  private async loadPermissions(roleName: string) {
    try {
      const roleData = await this.databases.getDocument(
        APPWRITE_CONFIG.dbId, 
        APPWRITE_CONFIG.colRoles, 
        roleName
      );
      const allowedPerms = Object.keys(roleData)
        .filter(key => !key.startsWith('$') && roleData[key] === true);
      this.permissions.set(allowedPerms);
    } catch { 
      this.permissions.set([]); 
    }
  }

  // --- WHITELIST ---

  async getWhitelistDoc(email: string): Promise<any> {
    try {
      return await this.databases.getDocument(
        APPWRITE_CONFIG.dbId, 
        APPWRITE_CONFIG.colWhitelist, 
        this.formatId(email)
      );
    } catch { 
      return null; 
    }
  }

  async checkWhitelist(email: string): Promise<boolean> {
    const doc = await this.getWhitelistDoc(email);
    return !!doc; 
  }

  // --- UTILS ---

  private resetSignals() {
    this.currentUser.set(null);
    this.userNickName.set(null);
    this.userEmail.set(null);
    this.userRole.set(null);
    this.permissions.set([]);
    this.themeService.initTheme('dark');
  }
}