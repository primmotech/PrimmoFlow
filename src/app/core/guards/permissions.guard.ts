import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard = (requiredPermission?: string): CanActivateFn => {
  return async (route) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // 1. On s'assure que la session est chargée
    await authService.checkSession();
    const user = authService.currentUser();

    // Redirection si on tente d'aller sur /login en étant déjà connecté
    if (route.routeConfig?.path === 'login') {
      if (user) {
        router.navigate(['/dashboard']);
        return false;
      }
      return true;
    }

    // Si pas de session -> login
    if (!user) {
      router.navigate(['/login']);
      return false;
    }

    // 2. Chargement du profil si les signaux sont vides (cas du refresh page)
    // On passe bien l'email récupéré du signal currentUser ou userEmail
    const email = authService.userEmail();
    if (!authService.userRole() && email) {
      await authService.loadUserProfile(email); // Paramètre email ajouté ici
    }

    // 3. Vérification de l'accès
    if (!requiredPermission) return true;

    try {
      const userRole = authService.userRole();
      if (!userRole) {
        router.navigate(['/dashboard']);
        return false;
      }

      // On vérifie directement via le service si la permission est présente
      // car loadUserProfile a déjà rempli le signal permissions
      if (authService.hasPerm(requiredPermission)) {
        return true;
      }

      console.warn(`Accès refusé : Permission ${requiredPermission} manquante.`);
      router.navigate(['/dashboard']);
      return false;
    } catch (e) {
      console.error("Erreur de droits :", e);
      router.navigate(['/dashboard']);
      return false;
    }
  };
};