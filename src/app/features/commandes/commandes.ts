import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme';
import { Query } from 'appwrite';

interface Order {
  id: string;
  name: string;
  status: string;
  price?: number;
}

interface Intervention {
  $id: string;
  adresse: string;
  orders: string[];
  status: string;
  materiels?: string[]; // Ajouté pour le typage
}

interface GroupedOrders {
  address: string;
  interventionId: string;
  orders: Order[];
}

@Component({
  selector: 'app-commandes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './commandes.html',
  styleUrls: ['./commandes.scss']
})
export class CommandesComponent implements OnInit {
  private authService = inject(AuthService);
  public themeService = inject(ThemeService);
  private router = inject(Router);

  private DB_ID = '694eba69001c97d55121';
  private COL_INTERVENTIONS = 'interventions';

  loading = signal(true);
  interventions = signal<Intervention[]>([]);
  priceInputs = new Map<string, number | null>();

  groupedOrders = computed(() => {
    const groups: GroupedOrders[] = [];
    
    this.interventions().forEach(inter => {
      if (inter.orders && inter.orders.length > 0) {
        const parsedOrders: Order[] = inter.orders.map(o => JSON.parse(o));
        
        let displayAddress = inter.adresse;
        try {
          const addr = JSON.parse(inter.adresse);
          displayAddress = `${addr.numero} ${addr.rue}, ${addr.ville}`;
        } catch(e) { /* fallback string */ }

        groups.push({
          address: displayAddress,
          interventionId: inter.$id,
          orders: parsedOrders
        });
      }
    });
    return groups;
  });

  ngOnInit() {
    this.themeService.initTheme();
    this.fetchOrders();
  }

  fetchOrders() {
    this.loading.set(true);
    
    this.authService.databases.listDocuments(
      this.DB_ID,
      this.COL_INTERVENTIONS,
      [
        Query.equal('status', ['OPEN', 'WAITING']),
        Query.limit(100)
      ]
    ).then(response => {
      const docs = response.documents as unknown as Intervention[];
      const withOrders = docs.filter(i => i.orders && i.orders.length > 0);
      this.interventions.set(withOrders);
      this.loading.set(false);
    }).catch(err => {
      console.error("Erreur Appwrite:", err);
      this.loading.set(false);
    });
  }

  onPriceChange(orderId: string, price: number | null) {
    this.priceInputs.set(orderId, price);
  }

  async updateOrderStatus(interventionId: string, orderId: string) {
    const price = this.priceInputs.get(orderId);
    if (price === undefined || price === null) {
      alert("Veuillez entrer un prix d'achat.");
      return;
    }

    try {
      // 1. Récupérer le document
      const doc = await this.authService.databases.getDocument(
        this.DB_ID,
        this.COL_INTERVENTIONS,
        interventionId
      );

      const currentOrders: string[] = doc['orders'] || [];
      const currentMateriels: string[] = doc['materiels'] || [];

      // 2. Trouver l'objet à transférer et filtrer le tableau
      let orderToTransfer: Order | null = null;
      const updatedOrders: string[] = [];

      for (const orderStr of currentOrders) {
        const parsed = JSON.parse(orderStr) as Order;
        if (parsed.id === orderId) {
          orderToTransfer = parsed;
        } else {
          updatedOrders.push(orderStr);
        }
      }

      if (!orderToTransfer) {
        alert("Commande introuvable.");
        return;
      }

      // 3. Préparer le matériel (Cast explicite pour éviter l'erreur 'never')
      const transfer = orderToTransfer as Order;
      const newMateriel = JSON.stringify({
        id: transfer.id,
        description: transfer.name,
        price: price,
        dateAdded: new Date().toISOString()
      });

      // 4. Update Appwrite
      await this.authService.databases.updateDocument(
        this.DB_ID,
        this.COL_INTERVENTIONS,
        interventionId,
        { 
          orders: updatedOrders,
          materials: [...currentMateriels, newMateriel]
        }
      );

      this.priceInputs.delete(orderId);
      this.fetchOrders(); 
      
    } catch (error) {
      console.error("Erreur transfert matériel:", error);
      alert("La mise à jour a échoué.");
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}