import { inject, Injectable, signal } from '@angular/core';
import { DashboardFilter } from '../../features/dashboard/dashboard';



@Injectable({ providedIn: 'root' })
export class DashboardService {
  activeFilter = signal<DashboardFilter>('ALL');
  selectedOwnerId = signal<string | null>(null);
}