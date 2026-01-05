const sdk = require('node-appwrite');

module.exports = async function (context) {
    // Récupération des variables avec fallback
    const endpoint = process.env.APPWRITE_FUNCTION_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!endpoint || !projectId || !apiKey) {
        context.error("Variables manquantes : Check l'onglet Settings > Variables");
        return context.res.json({ error: "Configuration incomplete" }, 500);
    }

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const users = new sdk.Users(client);
    
    // Récupération de l'ID via le document supprimé
    const userId = context.req.body.$id;

    if (!userId) {
        context.log("Aucun ID trouvé dans le payload (test manuel ?)");
        return context.res.json({ error: "No user ID" }, 400);
    }

    try {
        await users.delete(userId);
        context.log(`Utilisateur ${userId} supprimé de l'Auth avec succès.`);
        return context.res.json({ message: "Success" });
    } catch (err) {
        context.error(`Erreur SDK : ${err.message}`);
        return context.res.json({ error: err.message }, 500);
    }
};