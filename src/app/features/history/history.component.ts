import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  interventionId: string | null = null;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.interventionId = params.get('id');
      // Here you would typically load the history for this interventionId
      console.log('Loading history for intervention:', this.interventionId);
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
