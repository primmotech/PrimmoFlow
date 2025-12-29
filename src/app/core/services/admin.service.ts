import { inject, Injectable } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, getDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private firestore = inject(Firestore);

  /**
   * Récupère la liste des utilisateurs autorisés
   */
  getAuthorizedUsers(): Observable<any[]> {
    const usersRef = collection(this.firestore, 'authorized_users');
    return collectionData(usersRef, { idField: 'email' });
  }

  /**
   * Ajoute ou met à jour un utilisateur autorisé
   * Gère la collection 'authorized_users' (Sécurité/Whitelist)
   */


  /**
   * Supprime l'autorisation d'un utilisateur
   * NOTE : On supprime l'accès (authorized_users) mais on peut choisir 
   * de garder le profil (user_profiles) pour l'historique des données.
   */
  async removeAuthorization(email: string) {
    const emailClean = email.toLowerCase().trim();
    const userAuthRef = doc(this.firestore, `authorized_users/${emailClean}`);
    return await deleteDoc(userAuthRef);
  }

  /**
   * Gestion des Équipes
   */
  getTeams(): Observable<any[]> {
    const teamsRef = collection(this.firestore, 'teams');
    return collectionData(teamsRef, { idField: 'id' });
  }

async authorizeUser(email: string, nickName: string) {
  const emailClean = email.toLowerCase().trim();
  
  // 1. Whitelist : Uniquement l'email pour la porte d'entrée
  await setDoc(doc(this.firestore, `authorized_users/${emailClean}`), { 
    email: emailClean,
    updatedAt: new Date()
  }, { merge: true });

  // 2. Profil : On y met le NickName ET le Role
  const profileRef = doc(this.firestore, `user_profiles/${emailClean}`);
  await setDoc(profileRef, {
    nickName: nickName,
    role: 'Technicien', // Source de vérité pour le rôle ici
    themePreference: 'dark',
    updatedAt: new Date()
  }, { merge: true });
}
}