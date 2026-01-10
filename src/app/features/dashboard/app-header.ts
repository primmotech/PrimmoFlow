import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="brand">
        <h1>PrimmoFlow</h1>
      </div>
      <div class="header-user">
        <span class="username">{{ authService.userNickName() || 'Profil' }}</span>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 20px;
      background: var(--card-bg);
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 1px solid var(--border-color);

      .brand h1 { 
        font-size: 1.3rem; 
        font-weight: 800; 
        margin: 0; 
        color: var(--text-primary);
        letter-spacing: -0.5px;
      }

      .username { 
        font-size: 0.85rem; 
        color: var(--accent-color); 
        font-weight: 700; 
        text-transform: uppercase; 
      }
    }
  `]
})
export class AppHeaderComponent {
  authService = inject(AuthService);
}