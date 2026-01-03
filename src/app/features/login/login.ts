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

  // Champs d'authentification
  email = '';
  password = '';
  confirmPassword = '';

  // Champs du profil (Etape REGISTER)
  lastname = '';
  firstname = '';
  phone = '';
  nickName = '';

  step = signal<'EMAIL' | 'LOGIN' | 'REGISTER'>('EMAIL');
  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);

  ngOnInit() { 
    this.themeService.initTheme(); 
  }

  // Nettoyage des sessions actives pour éviter l'erreur "Creation of a session is prohibited"
  private async clearActiveSessions() {
    try {
      await this.authService['account'].deleteSession('current');
      console.log("Ancienne session nettoyée.");
    } catch (e) {
      // Si aucune session n'existe, Appwrite renvoie une erreur 401 que l'on ignore ici
    }
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

      if (whitelistDoc['hasProfile'] === true) {
        this.step.set('LOGIN');
      } else {
        this.nickName = this.email.split('@')[0];
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
    
    // Protection session fantôme
    await this.clearActiveSessions();

    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      this.errorMessage.set("Email ou mot de passe incorrect.");
    } finally {
      this.loading.set(false);
    }
  }

  isRegisterValid(): boolean {
    return (
      this.lastname.trim().length >= 2 &&
      this.firstname.trim().length >= 2 &&
      this.phone.trim().length >= 10 &&
      this.nickName.trim().length >= 2 &&
      this.password.length >= 6 &&
      this.password === this.confirmPassword
    );
  }

  async onRegister() {
    if (!this.isRegisterValid()) {
      this.errorMessage.set(this.password !== this.confirmPassword ? 
        "Les mots de passe ne correspondent pas." : 
        "Veuillez remplir tous les champs obligatoires.");
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    
    // Protection session fantôme avant de commencer
    await this.clearActiveSessions();

    try {
      const id = this.authService.formatId(this.email);
      const dbId = '694eba69001c97d55121';

      // 1. Inscription avec gestion du compte déjà existant (ton image 1)
      try {
        await this.authService.register(this.email, this.password);
      } catch (authError: any) {
        if (authError.code === 409) {
          // Si le compte existe, on se logue pour pouvoir modifier le profil
          await this.authService.login(this.email, this.password);
        } else {
          throw authError;
        }
      }

      // 2. Préparation des données du profil
      const profileData = {
        email: this.email,
        lastname: this.lastname.trim().toUpperCase(),
        firstname: this.firstname.trim(),
        phone: this.phone.trim(),
        nickName: this.nickName.trim(),
        role: 'Aucun',
        themePreference: 'dark'
      };

      // 3. Upsert (Create ou Update) du profil
      try {
        await this.authService.databases.createDocument(dbId, 'user_profiles', id, profileData);
      } catch (dbError: any) {
        if (dbError.code === 409) {
          await this.authService.databases.updateDocument(dbId, 'user_profiles', id, profileData);
        } else {
          throw dbError;
        }
      }

      // 4. Mise à jour de la Whitelist
      await this.authService.databases.updateDocument(dbId, 'authorized_users', id, { hasProfile: true });
      
      // 5. Finalisation
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
    this.confirmPassword = '';
    this.lastname = '';
    this.firstname = '';
    this.phone = '';
    this.nickName = '';
  }
  // Ajoute cette méthode simple
scrollToInput(event: any) {
  setTimeout(() => {
    event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300); // Délai pour laisser le temps au clavier de finir son animation
}
}