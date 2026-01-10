import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardFilter } from './dashboard';

@Component({
  selector: 'app-dashboard-filters',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stats-header">
      <div class="header-filter-row">
        <div class="filter-pills">
          <button [class.active]="activeFilter === 'ALL'" (click)="filterChange.emit('ALL')">Tous</button>
          <button [class.active]="activeFilter === 'WAITING'" (click)="filterChange.emit('WAITING')">Attente</button>
          <button [class.active]="activeFilter === 'PLANNED'" (click)="filterChange.emit('PLANNED')">Plannif.</button>
          <button [class.active]="activeFilter === 'DONE'" (click)="filterChange.emit('DONE')">Terminées</button>
        </div>
        <div class="total-badge">
          {{ totalCount }} fiches
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard-filters.scss']
})
export class DashboardFiltersComponent {
  @Input({ required: true }) activeFilter: DashboardFilter = 'ALL';
  @Input({ required: true }) totalCount: number = 0;
  @Output() filterChange = new EventEmitter<DashboardFilter>();
}