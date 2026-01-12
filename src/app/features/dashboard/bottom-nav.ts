import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="bottom-nav">
      <div class="nav-items-container">


        @if (authService.hasPerm('dash_nav_orders')) {
          <a (click)="router.navigate(['/commandes'])" class="nav-item">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <span>Commandes</span>
          </a>
        }


        @if (authService.hasPerm('dash_nav_archives')) {
          <a (click)="router.navigate(['/archives'])" class="nav-item">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            <span>Archives</span>
          </a>
        }
        
        <div class="nav-item-gap"></div>
        @if (authService.hasPerm('dash_nav_params')) {
          <a (click)="router.navigate(['/parameters'])" class="nav-item">
             <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="12" cy="12" r="3"></circle>
               <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
             </svg>
             <span>Paramètres</span>
          </a>
        }
        <a class="nav-item" (click)="authService.logout()">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#e74c3c" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span style="color: #e74c3c;">Sortie</span>
        </a>
      </div>

      @if (authService.hasPerm('dash_nav_add')) {
        <div class="btn-halo-container">
          <div class="halo"></div>
          <button class="main-add-btn" (click)="router.navigate(['/add-intervention'])">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="white" stroke-width="3">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      }
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 75px;
      background: var(--card-bg);
      border-top: 1px solid var(--border-color);
      z-index: 1000;
      padding-bottom: env(safe-area-inset-bottom);
      display: flex;
    }

    .nav-items-container {
      display: flex;
      width: 100%;
      justify-content: space-around;
      align-items: center;
    }

    .nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      color: var(--text-secondary);
      gap: 5px;
      cursor: pointer;
      text-decoration: none;
      
      span {
        font-size: 0.6rem;
        font-weight: 800;
        text-transform: uppercase;
      }
    }

    /* Crée l'espace nécessaire au milieu pour le bouton flottant */
    .nav-item-gap {
      width: 70px;
      flex-shrink: 0;
    }

    .btn-halo-container {
      position: absolute;
      left: 50%;
      top: -30px;
      transform: translateX(-50%);
      width: 65px;
      height: 65px;
      z-index: 1001;
    }

    .main-add-btn {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: var(--accent-blue, #3498db);
      border: 4px solid var(--card-bg);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2;
    }

    /* L'EFFET HALO LUMINEUX */
    .halo {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      border-radius: 50%;
      background: var(--accent-blue, #3498db);
      opacity: 0.6;
      z-index: 1;
      animation: pulse-halo 2s infinite;
    }

    @keyframes pulse-halo {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }

    .main-add-btn:active {
      transform: scale(0.9);
    }
  `]
})
export class BottomNavComponent {
  authService = inject(AuthService);
  router = inject(Router);
}