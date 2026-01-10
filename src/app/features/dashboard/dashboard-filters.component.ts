import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardFilter } from './dashboard';

@Component({
  selector: 'app-dashboard-filters',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stats-header">
      <div class="header-filter-row">
        
        <div class="dropdown-container">
          <div class="filter-trigger-group" [ngClass]="activeFilter.toLowerCase()">
            <button class="filter-trigger" (click)="toggleMenu($event)">
              <ng-container *ngTemplateOutlet="iconTemplate; context: { type: activeFilter }"></ng-container>
            </button>
            
            @if (activeFilter !== 'ALL') {
              <button class="clear-filter" (click)="clearFilter($event)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="4">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            }
          </div>

          @if (isOpen) {
            <div class="filter-menu">
              @for (opt of options; track opt.value) {
                <div class="menu-item" (click)="selectFilter(opt.value)" [class.selected]="activeFilter === opt.value">
                  <div class="item-icon" [ngClass]="opt.value.toLowerCase()">
                    <ng-container *ngTemplateOutlet="iconTemplate; context: { type: opt.value }"></ng-container>
                  </div>
                  <span class="item-label">{{ opt.label }}</span>
                </div>
              }
            </div>
          }
        </div>

        <div class="total-badge">
          {{ totalCount }} fiches
        </div>
      </div>
    </div>

    <ng-template #iconTemplate let-type="type">
      @if (type === 'ALL') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
      } @else if (type === 'WAITING') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      } @else if (type === 'PLANNED') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      } @else if (type === 'DONE') {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      }
    </ng-template>
  `,
  styleUrls: ['./dashboard-filters.scss']
})
export class DashboardFiltersComponent {
  @Input({ required: true }) activeFilter: DashboardFilter = 'ALL';
  @Input({ required: true }) totalCount: number = 0;
  @Output() filterChange = new EventEmitter<DashboardFilter>();

  isOpen = false;
  // On a retiré "Tous" de la liste déroulante
  options: { label: string, value: DashboardFilter }[] = [
    { label: 'En Attente', value: 'WAITING' },
    { label: 'Planifiées', value: 'PLANNED' },
    { label: 'Terminées', value: 'DONE' }
  ];

  toggleMenu(event: Event) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  selectFilter(value: DashboardFilter) {
    this.filterChange.emit(value);
    this.isOpen = false;
  }

  clearFilter(event: Event) {
    event.stopPropagation();
    this.filterChange.emit('ALL');
    this.isOpen = false;
  }

  @HostListener('document:click')
  closeMenu() { this.isOpen = false; }
}