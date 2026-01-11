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
            <h4>{{ intervention.adresse.ville }}</h4>
            <span class="subtitle">{{ intervention.adresse.numero }} {{ intervention.adresse.rue }}</span>
          </div>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>
<div class="modal-body">
  @if (intervention.habitants) {
    @let occupants = parseJson(intervention.habitants);
    
    @if (occupants && occupants.length > 0) {
      <div class="occupants-section">
        <div class="occupants-label">Habitant(s) :</div>
        <div class="occupants-list">
          @for (habitant of occupants; track $index) {
            <div class="habitant-item">
              <span class="name">{{ habitant.prenom }} {{ habitant.nom }}</span>
              @if (habitant.tel) {
                <a [href]="'tel:' + habitant.tel" class="phone">{{ habitant.tel }}</a>
              }
            </div>
          }
        </div>
      </div>
      <hr class="modal-divider-light">
    }
  }

          <div class="tasks-section">
            @if (intervention.mission && intervention.mission.length > 0) {
              <ul class="task-list">
                @for (task of intervention.mission; track $index) {
                  <li class="task-item" [class.is-done]="task.done">
                    <div class="task-status-icon">
                      @if (task.done) {
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2ecc71" stroke-width="3">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      } @else { <div class="bullet"></div> }
                    </div>
                    <div class="task-text">{{ task.label }}</div>
                  </li>
                }
              </ul>
            } @else { <p class="no-tasks">Aucune mission détaillée.</p> }
          </div>

          @if (intervention.photos && intervention.photos.length > 0) {
            <hr class="modal-divider">
            <div class="photos-section">
              <h5>Photos d'intervention</h5>
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
            <div class="remarks-section">
              <h5>Remarques :</h5>
              <p>{{ intervention.remarques }}</p>
            </div>
          }
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