import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Intervention } from './dashboard';

@Component({
  selector: 'app-intervention-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div 
      class="intervention-card" 
      [class.pressing]="isPressing"
      [ngClass]="statusConfig[intervention.status]?.color || ''"
      (click)="cardClick.emit($event)"
    >
      <button class="btn-delete" (click)="onDelete($event)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div class="card-info">
        <span class="city">{{ intervention.adresse.ville || 'VILLE INCONNUE' }}</span>
        <span class="street">{{ intervention.adresse.numero }} {{ intervention.adresse.rue }}</span>

        @if (
          intervention.status == 'OPEN' ||
          intervention.status == 'WAITING' ||
          intervention.status == 'BILLED' ||
          intervention.status == 'PAID' ||
          intervention.status == 'END'
        ) {
          @if (intervention.owner && intervention.owner[0]) {
            <span class="created-by">
              Par 
              <span class="author-name" (click)="onCall($event, intervention.owner[0].tel)">
                {{ intervention.owner[0].prenom }} {{ intervention.owner[0].nom }}
              </span>
            </span>
          }
        }

        @if (
          intervention.status == 'PLANNED' ||
          intervention.status == 'STOPPED' ||
          intervention.status == 'STARTED' ||
          intervention.status == 'PAUSED' ||
          intervention.status == 'PAID' ||
          intervention.status == 'END'
        ) {
          @let occupants = parseJson(intervention.habitants);
          @for (habitant of occupants; track $index) {
            <div class="habitant-row">
              @if (habitant.tel) {
                <span class="created-by">
                  Pour 
                  <span class="author-name" (click)="onCall($event, habitant.tel)">
                    {{ habitant.prenom }} {{ habitant.nom }}
                  </span>
                </span>
              }
            </div>
          }
        }
      </div>

      <div class="card-actions">
        @if (intervention.status !== 'BILLED') {
          <button class="btn-details" (click)="onAction($event)">
            @switch (intervention.status) {
              @case ('WAITING') { Détails }
              @case ('OPEN') { Détails }
              @case ('END') { Histo }
              @default {
                @if (intervention.plannedAt) {
                  <span class="date-text">{{ intervention.plannedAt | date:'EEE dd/MM':'':'fr' }}</span>
                } @else { DÉTAILS }
              }
            }
          </button>
        }

        @if (canEdit) {
          <button class="btn-edit" (click)="onEdit($event)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        }
      </div>
    </div>
  `,
  styleUrls: ['./intervention-card.component.scss']
})
export class InterventionCardComponent {
  @Input({ required: true }) intervention!: Intervention;
  @Input({ required: true }) statusConfig: any;
  @Input() isPressing = false;
  @Input() canEdit = false;

  @Output() cardClick = new EventEmitter<Event>();
  @Output() actionClick = new EventEmitter<Event>();
  @Output() editClick = new EventEmitter<string>();
  @Output() deleteClick = new EventEmitter<string>(); // Nouvel Output
  @Output() callOwner = new EventEmitter<string>();

  onAction(event: Event) {
    event.stopPropagation();
    this.actionClick.emit(event);
  }

  onEdit(event: Event) {
    event.stopPropagation();
    this.editClick.emit(this.intervention.id);
  }

  onDelete(event: Event) {
    event.stopPropagation(); // Empêche d'ouvrir les détails en cliquant sur la croix
    if (confirm('Voulez-vous vraiment supprimer cette intervention ?')) {
      this.deleteClick.emit(this.intervention.id);
    }
  }

  onCall(event: Event, phone: string | undefined) {
    event.stopPropagation();
    if (phone) {
      this.callOwner.emit(phone);
    }
  }

  parseJson(jsonString: any) {
    if (!jsonString) return [];
    if (typeof jsonString === 'object') return jsonString;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return [];
    }
  }
}