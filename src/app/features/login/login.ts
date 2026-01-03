import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  router = inject(Router);

  email = '';
  password = '';
  step = signal<'EMAIL' | 'LOGIN' | 'REGISTER'>('EMAIL');
  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  ngOnInit() { 
    this.themeService.initTheme(); 
    this.debugCookies("Initialisation Login");
  }

  private debugCookies(context: string) {
    const cookies = document.cookie;
    console.log(`[DEBUG COOKIES - ${context}] :`, cookies || "Aucun cookie trouvé");
  }

  async handleEmailStep() {
    if (!this.email.includes('@')) {
      this.errorMessage.set("Veuillez entrer un email valide.");
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const whitelistDoc = await this.authService.getWhitelistDoc(this.email);

      if (!whitelistDoc) {
        this.errorMessage.set("Accès non autorisé. Contactez un administrateur.");
        return;
      }

      if (whitelistDoc['hasAccount'] === true) {
        this.step.set('LOGIN');
      } else {
        this.step.set('REGISTER');
      }
    } catch (e: any) {
      this.errorMessage.set("Erreur technique : " + e.message);
    } finally {
      this.loading.set(false);
    }
  }

  async onLogin() {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      // Nettoyage préventif pour éviter la 401 de conflit de session
      try { await this.authService['account'].deleteSession('current'); } catch (e) {}

      await this.authService.login(this.email, this.password);
      this.debugCookies("Après Login");
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage.set("Email ou mot de passe incorrect.");
    } finally {
      this.loading.set(false);
    }
  }

async onRegister() {
  this.loading.set(true);
  this.errorMessage.set('');
  try {
    const id = this.authService.formatId(this.email);
    const dbId = '694eba69001c97d55121';

    // 1. Création et Connexion via le service fusionné
    await this.authService.register(this.email, this.password);

    // 2. Création du profil (LoadUserProfile sera appelé automatiquement par le guard au prochain refresh)
    const profileData = {
      email: this.email,
      nickName: this.email.split('@')[0],
      role: 'Aucun',
      themePreference: 'dark'
    };

    try {
      await this.authService.databases.createDocument(dbId, 'user_profiles', id, profileData);
    } catch (error: any) {
      if (error.code === 409) {
        await this.authService.databases.updateDocument(dbId, 'user_profiles', id, profileData);
      } else { throw error; }
    }

    // 3. Signalement à la Whitelist (Attention aux permissions de collection)
    await this.authService.databases.updateDocument(dbId, 'authorized_users', id, { hasAccount: true });
    
    // 4. On rafraîchit la session locale avant de partir pour charger le rôle/permissions
    await this.authService.checkSession();
    
    this.router.navigate(['/dashboard']);
  } catch (error: any) {
    this.errorMessage.set("Erreur : " + error.message);
  } finally {
    this.loading.set(false);
  }
}

  reset() { 
    this.step.set('EMAIL'); 
    this.errorMessage.set(''); 
    this.password = '';
  }
}