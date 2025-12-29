import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InterventionService {
  
  // Données de secours pour le développement
  private mockInterventions = [
    {
      id: '1',
      status: 'DONE',
      createdBy: 'admin@primmo.com',
      habitants: [{ nom: 'Dupont' }],
      adresse: { numero: '10', rue: 'Rue de la Paix', ville: 'Paris' }
    }
  ];

  async getInterventionById(id: string): Promise<any> {
    const stored = localStorage.getItem('interventions');
    const interventions = stored ? JSON.parse(stored) : this.mockInterventions;
    // Comparaison souple (==) pour gérer string/number id
    return interventions.find((i: any) => i.id == id);
  }

  async updateInterventionStatus(id: string, status: string): Promise<void> {
    const stored = localStorage.getItem('interventions');
    let interventions = stored ? JSON.parse(stored) : this.mockInterventions;
    
    const index = interventions.findIndex((i: any) => i.id == id);
    if (index !== -1) {
      interventions[index].status = status;
      localStorage.setItem('interventions', JSON.stringify(interventions));
    }
  }
}