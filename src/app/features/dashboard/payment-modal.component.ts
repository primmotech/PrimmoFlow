import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="modal-overlay" (click)="close.emit()">
  <div class="modal-content payment-style" (click)="$event.stopPropagation()">
    
    <div class="modal-header">
      <div class="header-titles">
        <h4 class="city-title">Valider le paiement</h4>
        <span class="street-subtitle">{{ address }}</span>
      </div>
      <button class="close-btn" (click)="close.emit()">✕</button>
    </div>

    <div class="modal-body">
      <h5 class="section-label">COMMENTAIRE / RÉFÉRENCE</h5>
      
      <textarea 
        [(ngModel)]="paymentComment" 
        placeholder="Ex: Payé par virement, chèque n°123..."
        class="payment-textarea">
      </textarea>

      <button 
        class="action-btn success" 
        [disabled]="isSaving()"
        (click)="handleConfirm()">
        {{ isSaving() ? 'Enregistrement...' : 'CONFIRMER LE PAIEMENT' }}
      </button>
    </div>
  </div>
</div>
  `,
  styleUrls: ['./task-modal.scss', './payment-modal.scss'] // On réutilise tes styles existants
})
export class PaymentModalComponent {
  @Input({ required: true }) address!: string;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  paymentComment = '';
  isSaving = signal(false);

  handleConfirm() {
    this.isSaving.set(true);
    this.confirm.emit(this.paymentComment);
  }
}