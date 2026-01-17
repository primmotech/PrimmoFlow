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
      [class.neon-mode]="isNeonStatus"
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

        @if (intervention.owner && intervention.owner[0]) {
          <span class="created-by">
            Par 
            <span class="author-name" (click)="onCall($event, intervention.owner[0])">
              {{ intervention.owner[0].prenom }} {{ intervention.owner[0].nom }}
            </span>
          </span>
        }

        @let occupants = parseJson(intervention.habitants);
        @for (habitant of occupants; track $index) {
          <div class="habitant-row">
            @if (habitant.tel) {
              <span class="created-by">
                Pour 
                <span class="author-name" (click)="onCall($event, habitant)">
                  {{ habitant.prenom }} {{ habitant.nom }}
                </span>
              </span>
            }
          </div>
        }
      </div>

<div class="card-actions">
  @if (intervention.status !== 'BILLED' && isBasicStatus) {
      <button class="btn-details" (click)="onAction($event)">
         {{ intervention.status === 'END' ? 'Histo' : 'Détails' }}
      </button>
      @if (intervention.status == 'OPEN' || intervention.status == 'WAITING') {
        <button class="btn-details" (click)="onAction2($event)">Histo</button>
      }
  }
  
  @if (intervention.plannedAt && !isBasicStatus && intervention.status !== 'BILLED') {
    <button 
      class="btn-details" 
      [class.read-only]="!canPlan"
      [disabled]="!canPlan"
      (click)="onAction($event)">
      <span class="date-text">{{ intervention.plannedAt | date:'EEE dd/MM HH:mm':'':'fr' }}</span>
    </button>
  }

  @if (canEdit) {
    <button class="btn-details" (click)="onEdit($event)">
    Modif
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
  @Output() callOwner = new EventEmitter<any>(); // Transmet l'objet complet
/**
   * Détermine si la carte doit afficher l'effet Néon
   */
  get isNeonStatus(): boolean {
    // Liste des statuts qui activent l'effet lumineux
    const neonList = ['WAITING', 'STOPPED', 'STARTED', 'PAUSED', 'BILLED'];
    
    // On vérifie si le statut actuel est dans la liste
    return this.intervention && neonList.includes(this.intervention.status);
  }
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

  onCall(event: Event, person: any) {
    event.stopPropagation();
    // On vérifie si l'objet contient un téléphone avant d'émettre
    if (person && person.tel) {
      this.callOwner.emit(person);
    }
  }

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