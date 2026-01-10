import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
// On importe directement depuis dashboard.ts qui est au même niveau
import { Intervention, STATUS_CONFIG } from './dashboard';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-intervention-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="intervention-card pending-horizontal" 
         [ngClass]="getStatusClass(intervention.status)"
         (click)="cardClick.emit()">
      
      <div class="card-info">
        <span class="city">{{ intervention.adresse.ville || 'VILLE INCONNUE' }}</span>
        <span class="street">{{ intervention.adresse.numero }} {{ intervention.adresse.rue }}</span>

        @if (showContacts()) {
          @let contact = getPrimaryContact();
          @if (contact) {
            <div class="creator-info">
              <span class="creator-text">
                {{ intervention.status === 'PLANNED' ? 'Hab :' : 'Par' }}
                <a [href]="'tel:' + contact.tel" (click)="$event.stopPropagation()" class="creator-link">
                  {{ contact.prenom }} {{ contact.nom || contact.email }}
                </a>
              </span>
            </div>
          }
        }
      </div>

      <div class="card-actions-horizontal">
        @if (canEdit()) {
          <button class="icon-btn-edit" (click)="$event.stopPropagation(); edit.emit(intervention.id)">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        }

        <button class="btn-details-link" (click)="handleAction($event)">
          @if (intervention.status === 'PLANNED' && intervention.plannedAt) {
            <span class="date-text">{{ intervention.plannedAt | date:'EEE dd/MM HH:mm' }}</span>
          } @else if (intervention.status === 'END' || intervention.status === 'BILLED') {
             {{ intervention.status === 'BILLED' ? 'Payé ?' : 'Facture' }}
          } @else if (intervention.status === 'WAITING' || intervention.status === 'OPEN') {
            Détails
          }
        </button>

        @if (showPrices() && (intervention.status === 'END' || intervention.status === 'BILLED')) {
          <div [class]="intervention.status === 'END' ? 'price-hintr' : 'price-hintv'">
            {{ intervention.totalFinal || 0 | number:'1.2-2' }}€
          </div>
        }
      </div>
    </div>
  `,
    styleUrls: ['./intervention-card.scss']
})
export class InterventionCardComponent {
  @Input({ required: true }) intervention!: Intervention;
  @Output() edit = new EventEmitter<string>();
  @Output() cardClick = new EventEmitter<void>();
  @Output() actionClick = new EventEmitter<Event>();

  authService = inject(AuthService);

  getStatusClass(status: string) { return STATUS_CONFIG[status]?.color || ''; }
  showContacts() { return this.authService.hasPerm('dash_view_contacts'); }
  showPrices() { return this.authService.hasPerm('dash_view_prices'); }

  canEdit() {
    // Si planifié, on check dash_view_all (ton code actuel), sinon dash_act_edit
    return this.intervention.status === 'PLANNED' 
      ? this.authService.hasPerm('dash_view_all') 
      : this.authService.hasPerm('dash_act_edit');
  }

  getPrimaryContact() {
    if (this.intervention.status === 'PLANNED' && this.intervention.habitants?.length) {
      return this.intervention.habitants[0];
    }
    return this.intervention.owner?.length ? this.intervention.owner[0] : null;
  }

  handleAction(event: Event) {
    event.stopPropagation();
    this.actionClick.emit(event);
  }
}