import axios from 'axios';

export default async (context) => {
  // 1. Récupération ultra-sécurisée de l'URL
  // On teste toutes les cachettes possibles d'Appwrite
  const googleUrl = 
    context.variables?.['GOOGLE_SCRIPT_URL'] || 
    context.req?.variables?.['GOOGLE_SCRIPT_URL'] || 
    process.env['GOOGLE_SCRIPT_URL'];

  if (!googleUrl) {
    context.error('ERREUR : GOOGLE_SCRIPT_URL est introuvable dans les variables.');
    return context.res.json({ 
      success: false, 
      error: 'Variable GOOGLE_SCRIPT_URL manquante dans les Settings.' 
    }, 500);
  }

  try {
    // 2. Récupération du body
    const body = context.req.body;
    const payload = typeof body === 'string' ? JSON.parse(body || '{}') : body;

    context.log('Tentative d envoi vers : ' + googleUrl);

    // 3. Appel à Google
    const response = await axios.post(googleUrl, {
      email: payload.email || 'primmotech@gmail.com',
      subject: payload.subject || 'Test Notificator',
      message: payload.message || 'Liaison Appwrite réussie !'
    });

    return context.res.json({ 
      success: true, 
      googleStatus: response.status 
    });

  } catch (err) {
    context.error('Erreur : ' + err.message);
    return context.res.json({ 
      success: false, 
      error: err.message 
    }, 400);
  }
};