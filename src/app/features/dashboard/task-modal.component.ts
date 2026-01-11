import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Intervention } from './dashboard';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="modal-overlay" (click)="close.emit()">
  <div class="modal-content" (click)="$event.stopPropagation()">
    
    <div class="modal-header">
      <div class="header-titles">
        <h4 class="city-title">{{ intervention.adresse.ville }}</h4>
        <span class="street-subtitle">{{ intervention.adresse.numero }} {{ intervention.adresse.rue }}</span>
      </div>
      <button class="close-btn" (click)="close.emit()">✕</button>
    </div>

    <div class="modal-body">
      @if (intervention.habitants) {
        @let occupants = parseJson(intervention.habitants);
        @if (occupants && occupants.length > 0) {
          <div class="section-card">
            <h5 class="section-label">Habitant(s)</h5>
            <div class="occupants-list">
              @for (habitant of occupants; track $index) {
                <div class="habitant-row">
                 
                  @if (habitant.tel) {
                    <a [href]="'tel:' + habitant.tel" class="habitant-tel">
                      <span class="icon">📞</span> {{ habitant.prenom }} {{ habitant.nom }}
                    </a>
                  }
                  @else { <span class="habitant-name">{{ habitant.prenom }} {{ habitant.nom }}</span>}
                </div>
              }
            </div>
          </div>
        }
      }

      <div class="section-card">
        <h5 class="section-label">Missions</h5>
        @if (intervention.mission && intervention.mission.length > 0) {
          <ul class="task-list">
            @for (task of intervention.mission; track $index) {
              <li class="task-item" [class.is-done]="task.done">
                <div class="task-status">
                  @if (task.done) { <span class="check-icon">✓</span> }
                  @else { <span class="bullet"></span> }
                </div>
                <span class="task-text">{{ task.label }}</span>
              </li>
            }
          </ul>
        } @else {
          <p class="empty-msg">Aucune mission détaillée.</p>
        }
      </div>

      @if (intervention.photos && intervention.photos.length > 0) {
        <div class="section-card">
          <h5 class="section-label">Photos</h5>
          <div class="photo-slider">
            @for (pStr of intervention.photos; track pStr) {
              @let photo = parseJson(pStr);
              <div class="photo-slide">
                <img [src]="photo.url" alt="Photo" loading="lazy">
              </div>
            }
          </div>
        </div>
      }

      @if (intervention.remarques) {
        <div class="section-card remarks-card">
          <h5 class="section-label">Remarques</h5>
          <p class="remarks-text">{{ intervention.remarques }}</p>
        </div>
      }

      <button class="action-btn secondary" >
        Plannifer
      </button>

    </div>
  </div>
</div>

  `,
  styleUrls: ['./task-modal.scss'] // On va créer ce fichier juste après
})
export class TaskModalComponent {
  @Input({ required: true }) intervention!: Intervention;
  @Output() close = new EventEmitter<void>();

  private authService = inject(AuthService);
  private readonly BUCKET_ID = '69502be400074c6f43f5';

 parseJson(jsonString: any) {
  if (!jsonString) return []; // Retourne un tableau vide par défaut pour les habitants
  if (Array.isArray(jsonString) || typeof jsonString === 'object') return jsonString;
  try { 
    return JSON.parse(jsonString); 
  } catch (e) { 
    // Si c'est un ID d'image (cas de tes photos)
    return { url: this.authService.storage.getFileView(this.BUCKET_ID, jsonString) }; 
  }
}
}