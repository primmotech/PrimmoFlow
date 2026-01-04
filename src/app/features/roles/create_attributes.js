const sdk = require('node-appwrite');

// --- CONFIGURATION ---
const client = new sdk.Client()
    .setEndpoint('https://cloud.appwrite.io/v1') // Ton endpoint
    .setProject('694eb89e001a66c2311f')               // Ton ID de projet
    .setKey('standard_0dd840cdb5120992667c7ede56ab0545f6bdb7823bfad34508aaa3d82d955d97492a56c80ff1dd84ec582698e247abed0b72aeac23b8aaeb0e5849f115b9960b2ce741a1092d9aa7e386541fd6d6186fc27c0744db13020661244d6eaf556b110d9ea47058c9be34780758a67fbc39392925f49ae1ffde5938b0f35a06a66c28');                     // Une clé API avec les droits "collections.write" et "attributes.write"

const databases = new sdk.Databases(client);
const DB_ID = '694eba69001c97d55121';
const COL_ROLES = 'roles';

// --- LISTE DES ATTRIBUTS ---
const attributes = [
    // Dashboard
    'dash_view_all', 'dash_view_contacts', 'dash_view_prices',
    'dash_act_edit', 'dash_act_tasks', 'dash_act_plan', 'dash_act_delete',
    'dash_nav_add', 'dash_nav_details', 'dash_nav_invoice', 'dash_nav_billed',
    'dash_nav_orders', 'dash_nav_archives', 'dash_nav_params',
    // Paramètres
    'param_view_costs',
    'param_edit_name', 'param_edit_nickname', 'param_edit_phone', 
    'param_edit_gps', 'param_edit_costs', 'param_edit_theme',
    // Panel Admin
    'param_panel_equipes', 'param_panel_roles', 'param_panel_whitelist'
];

async function createAttributes() {
    for (const attr of attributes) {
        try {
            await databases.createBooleanAttribute(DB_ID, COL_ROLES, attr, false);
            //console.log(`✅ Attribut créé : ${attr}`);
        } catch (e) {
            if (e.code === 409) {
                //console.log(`⚠️ L'attribut ${attr} existe déjà.`);
            } else {
                console.error(`❌ Erreur sur ${attr}:`, e.message);
            }
        }
    }
    //console.log("\nTerminé ! Attends 1 ou 2 minutes que Appwrite les passe en statut 'available'.");
}

createAttributes();