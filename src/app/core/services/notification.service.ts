import { inject, Injectable } from '@angular/core';
import { Functions } from 'appwrite';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private authService = inject(AuthService);
  private functions = new Functions(this.authService.client);

  private readonly NOTIFICATOR_ID = '6957b41400311755ce31';
  private readonly APP_URL = 'https://primmo-flow.vercel.app';

  /**
   * Envoie l'email de bienvenue (Ajout Whitelist)
   */
  async sendWelcomeEmail(to: string, nickName: string) {
    const subject = "Accès autorisé - primmoFlow";
    const html = `
      <div style="font-family: sans-serif; background-color: #f9fafb; padding: 20px; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 30px; text-align: center; color: white;">
            <span style="font-size: 24px; font-weight: bold;">Primmo<span style="color: #3b82f6;">Flow</span></span>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #111827; margin-top: 0;">Bienvenue ${nickName} !</h2>
            <p>Ton accès à l'application a été activé avec succès.</p>
            <p>Tu peux maintenant créer ton mot de passe en cliquant sur le bouton ci-dessous :</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${this.APP_URL}/login" style="background: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Créer mon compte</a>
            </div>
            <p style="font-size: 0.8em; color: #6b7280; text-align: center;">Ceci est un message automatique de primmoFlow.</p>
          </div>
        </div>
      </div>`;
    return this.executeMail(to, subject, html);
  }

  /**
   * Envoie l'email de révocation (Suppression Whitelist)
   */
  async sendRevocationEmail(to: string, nickName: string) {
    const subject = "Révocation d'accès - primmoFlow";
    const html = `
      <div style="font-family: sans-serif; background-color: #fef2f2; padding: 20px; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #fee2e2;">
          <div style="background: #991b1b; padding: 20px; text-align: center; color: white;">
            <span style="font-size: 20px; font-weight: bold;">primmoFlow | Sécurité</span>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #991b1b; margin-top: 0;">Accès Révoqué</h2>
            <p>Bonjour <strong>${nickName}</strong>,</p>
            <p>Nous vous informons que vos accès à l'application <strong>primmoFlow</strong> ont été révoqués par un administrateur.</p>
            <p>Vous ne pourrez plus vous connecter à la plateforme à compter de ce jour.</p>
          </div>
        </div>
      </div>`;
    return this.executeMail(to, subject, html);
  }

  /**
   * Exécute l'appel à la fonction Appwrite
   */
  private async executeMail(to: string, subject: string, message: string) {
    try {
      const payload = { email: to, subject: subject, message: message };
      return await this.functions.createExecution(this.NOTIFICATOR_ID, JSON.stringify(payload));
    } catch (error) {
      console.error("Erreur NotificationService:", error);
      throw error;
    }
  }
  /**
 * Envoie la notification de paiement reçu
 */
async sendPaymentNotification(to: string, technicianName: string, amount: number, city: string) {
  const subject = `Paiement Disponible - ${city}`;
  const html = `
    <div style="font-family: sans-serif; background-color: #111; padding: 20px; color: #fff;">
      <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; overflow: hidden; border: 1px solid #333;">
        <div style="background: #3498db; padding: 30px; text-align: center; color: white;">
          <span style="font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Paiement Disponible chez ${technicianName}</span>
        </div>
        <div style="padding: 30px; line-height: 1.6;">
          <h2 style="color: #3498db; margin-top: 0;">Bonjour ${to},</h2>
          <p>Le paiement pour l'intervention à <strong>${city}</strong> a été validé.</p>
          
          <div style="background: #222; padding: 20px; border-radius: 12px; text-align: center; margin: 25px 0; border: 1px solid #333;">
            <span style="color: #888; font-size: 12px; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 5px;">Montant de la recette</span>
            <span style="font-size: 32px; font-weight: 900; color: #ffffff;">${amount.toFixed(2)}€</span>
          </div>

          
        </div>
        <div style="background: #111; padding: 15px; text-align: center;">
           <p style="font-size: 11px; color: #555; margin: 0;">Ceci est une notification automatique de PrimmoFlow.</p>
        </div>
      </div>
    </div>`;
   
  return this.executeMail(to, subject, html);
}
}