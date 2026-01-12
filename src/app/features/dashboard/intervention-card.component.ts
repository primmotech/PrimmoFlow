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
      [ngClass]="statusConfig[intervention.status]?.color || ''"
      (click)="cardClick.emit($event)"
    >
@if (canDelete) {
  <button class="btn-delete" (click)="onDelete($event)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
}

      <div class="card-info">
        <span class="city">{{ intervention.adresse.ville || 'VILLE INCONNUE' }}</span>
        <span class="street">{{ intervention.adresse.numero }} {{ intervention.adresse.rue }}</span>

        @if (
        true
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
          true
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
        @if (intervention.status !== 'BILLED' && showActionButton && (isBasicStatus || canPlan)) {
          @if (['WAITING', 'OPEN', 'END'].includes(intervention.status) || canPlan) {
          <button class="btn-details" (click)="onAction($event)">
            @switch (intervention.status) {
              @case ('WAITING') { Détails } 
              @case ('OPEN') { Détails }
              @case ('END') { Histo }
              @default {
                @if (intervention.plannedAt) {
                  <span class="date-text">{{ intervention.plannedAt | date:'EEE dd/MM HH:mm':'':'fr' }}</span>
                } @else { DÉTAILS }
              }
            }
          </button>
           @if (intervention.status == 'OPEN'||intervention.status == 'WAITING') {
                    <button class="btn-details" (click)="onAction2($event)">
    Histo
          </button>
           }
        }
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
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Input() showActionButton = true;
  @Input() canPlan = false;

  @Output() cardClick = new EventEmitter<Event>();
  @Output() actionClick = new EventEmitter<Event>();
   @Output() action2Click = new EventEmitter<Event>();
  @Output() editClick = new EventEmitter<string>();
  @Output() deleteClick = new EventEmitter<string>();
  @Output() callOwner = new EventEmitter<string>();

  onAction(event: Event) {
    event.stopPropagation();
    this.actionClick.emit(event);
  }
    onAction2(event: Event) {
    event.stopPropagation();
    this.action2Click.emit(event);
  }

  onEdit(event: Event) {
    event.stopPropagation();
    this.editClick.emit(this.intervention.id);
  }

  onDelete(event: Event) {
    event.stopPropagation();
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
// Dans intervention-card.component.ts
get isBasicStatus(): boolean {
  const basic = ['WAITING', 'OPEN', 'END'];
  return basic.includes(this.intervention.status);
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