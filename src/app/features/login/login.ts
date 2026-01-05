import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { Router } from '@angular/router';
import { PhoneFormatDirective } from '../../core/directives/phone-format.directive'; // Vérifie le chemin

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, PhoneFormatDirective], // Ajout de la directive ici
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

  // Signaux d'état
  step = signal<'EMAIL' | 'LOGIN' | 'REGISTER'>('EMAIL');
  loading = signal(false);
  errorMessage = signal('');
  showPassword = signal(false);
  
  // Signaux pour le téléphone
  detectedCountry = signal<string>('');
  phoneValid = signal<boolean>(false);

  ngOnInit() { 
    this.themeService.initTheme(); 
  }

  private async clearActiveSessions() {
    try {
      await this.authService['account'].deleteSession('current');
    } catch (e) {
      // Session inexistante : erreur ignorée
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
        this.nickName = ''; 
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

  // Logique de validation mise à jour avec le téléphone
  isRegisterValid(): boolean {
    return (
      this.lastname.trim().length >= 2 &&
      this.firstname.trim().length >= 2 &&
      this.phoneValid() && // Utilisation du signal de la directive
      this.nickName.trim().length >= 2 &&
      this.password.length >= 6 &&
      this.password === this.confirmPassword
    );
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
    this.detectedCountry.set('');
    this.phoneValid.set(false);
  }

  scrollToInput(event: any) {
    setTimeout(() => {
      event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  async onRegister() {
    if (!this.isRegisterValid()) {
      this.errorMessage.set(this.password !== this.confirmPassword ? 
        "Les mots de passe ne correspondent pas." : 
        "Veuillez remplir correctement tous les champs.");
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    await this.clearActiveSessions();

    try {
      const id = this.authService.formatId(this.email);
      const dbId = '694eba69001c97d55121';

      let existingRole = 'Utilisateur';
      try {
        const existingProfile = await this.authService.databases.getDocument(dbId, 'user_profiles', id);
        if (existingProfile && existingProfile['role']) {
          existingRole = existingProfile['role'];
        }
      } catch (e) {}

      try {
        await this.authService.register(this.email, this.password);
      } catch (authError: any) {
        if (authError.code === 409) {
          await this.authService.login(this.email, this.password);
        } else {
          throw authError;
        }
      }

      const profileData = {
        email: this.email,
        lastname: this.lastname.trim().toUpperCase(),
        firstname: this.firstname.trim(),
        phone: this.phone.trim(),
        nickName: this.nickName.trim(),
        role: existingRole, 
        themePreference: 'dark'
      };

      try {
        await this.authService.databases.createDocument(dbId, 'user_profiles', id, profileData);
      } catch (dbError: any) {
        if (dbError.code === 409) {
          await this.authService.databases.updateDocument(dbId, 'user_profiles', id, profileData);
        } else {
          throw dbError;
        }
      }

      await this.authService.databases.updateDocument(dbId, 'authorized_users', id, { hasProfile: true });
      await this.authService.checkSession();
      this.router.navigate(['/dashboard']);

    } catch (error: any) {
      this.errorMessage.set("Erreur : " + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // --- LOGIQUE NICKNAME ---
  onNameChange() {
    this.generateNickName();
  }

  private generateNickName() {
    const p1 = this.firstname.trim().substring(0, 4);
    const part1 = p1 ? p1.charAt(0).toUpperCase() + p1.slice(1).toLowerCase() : '';

    const p2 = this.lastname.trim().substring(0, 3);
    const part2 = p2 ? p2.charAt(0).toUpperCase() + p2.slice(1).toLowerCase() : '';

    this.nickName = `${part1}${part2}`;
  }

  // --- LOGIQUE TELEPHONE ---
  onCountryFound(event: { name: string, code: string }) {
    this.detectedCountry.set(event.name);
  }

  // Cette méthode permet de setter le signal proprement sans erreur TS
  setPhoneValidity(isValid: any) {
    this.phoneValid.set(!!isValid);
  }
}